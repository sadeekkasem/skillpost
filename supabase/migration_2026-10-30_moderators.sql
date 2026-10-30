-- SkillPost: moderators (2026-10-30). Idempotent and non-destructive: safe to run more than once.
-- Run AFTER all earlier migrations (needs is_admin(), is_banned, block_banned_user(), reports, posts,
-- post_comments, attachments). Adds: profiles.is_moderator, profiles.suspended_until, is_moderator(),
-- moderation_log, admin RPCs to manage moderators, moderator RPCs (reports, delete content, suspend).
-- Moderators can never act on admins or other moderators, ban permanently, or grant roles.
begin;

-- 1) Columns. Users cannot change them (no column grant); only the functions below do.
alter table public.profiles add column if not exists is_moderator boolean not null default false;
alter table public.profiles add column if not exists suspended_until timestamptz;
revoke update(is_moderator, suspended_until) on public.profiles from anon, authenticated;
create index if not exists profiles_moderator_idx on public.profiles(id) where is_moderator;

-- 2) Helpers
create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_moderator or p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated;

-- true when uid is an admin or a moderator (internal only)
create or replace function public.is_staff_user(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin or p.is_moderator from public.profiles p where p.id = uid), false);
$$;
revoke all on function public.is_staff_user(uuid) from public, anon, authenticated;

create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.suspended_until > now() from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_suspended() from public;
grant execute on function public.is_suspended() to anon, authenticated;

-- 3) Suspended users are blocked by the same triggers as banned users
--    (projects, posts, comments, post_comments, messages, attachments, ad_requests, friendships).
create or replace function public.block_banned_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if public.is_banned() then
    raise exception 'تم إيقاف حسابك من قبل الإدارة، لا يمكنك النشر أو المراسلة.' using errcode = 'P0001';
  end if;
  select p.suspended_until into v_until from public.profiles p where p.id = auth.uid();
  if v_until is not null and v_until > now() then
    raise exception 'حسابك موقوف مؤقتًا حتى %، لا يمكنك النشر أو التعليق أو الرفع حاليًا.',
      to_char(v_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"') using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.block_banned_user() from public, anon, authenticated;

-- 4) Moderation log (insert only through the security definer functions below)
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id uuid,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists moderation_log_created_idx on public.moderation_log(created_at desc);
create index if not exists moderation_log_actor_idx on public.moderation_log(actor_id, created_at desc);
alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;
drop policy if exists moderation_log_read on public.moderation_log;
create policy moderation_log_read on public.moderation_log for select to authenticated
  using ((select public.is_admin()) or (actor_id = (select auth.uid()) and (select public.is_moderator())));

create or replace function public.mod_write_log(p_action text, p_type text, p_id uuid, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into public.moderation_log(actor_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, p_type, p_id, left(coalesce(p_reason, ''), 500));
$$;
revoke all on function public.mod_write_log(text, text, uuid, text) from public, anon, authenticated;

-- Reason is required for every moderator action
create or replace function public.mod_require(p_reason text) returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'اكتب سبب الإجراء (3 أحرف على الأقل).' using errcode = 'P0001';
  end if;
  return left(trim(p_reason), 500);
end; $$;
revoke all on function public.mod_require(text) from public, anon, authenticated;

-- 5) Moderators can read reports (resolving goes through mod_resolve_report)
drop policy if exists report_select_moderator on public.reports;
create policy report_select_moderator on public.reports for select to authenticated
  using ((select public.is_moderator()));

-- 6) Admin: grant / revoke moderator
create or replace function public.admin_set_moderator(target uuid, enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if target is null or target = auth.uid() then
    raise exception 'لا يمكنك تغيير صلاحياتك بنفسك.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'العضو غير موجود.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = target and is_admin) then
    raise exception 'هذا الحساب مدير بالفعل.' using errcode = 'P0001';
  end if;
  update public.profiles set is_moderator = coalesce(enabled, false) where id = target;
  perform public.mod_write_log(case when coalesce(enabled, false) then 'grant_moderator' else 'revoke_moderator' end,
                               'profile', target, '');
end; $$;
revoke all on function public.admin_set_moderator(uuid, boolean) from public, anon;
grant execute on function public.admin_set_moderator(uuid, boolean) to authenticated;

-- Admin: list moderators (with email from auth.users)
create or replace function public.admin_list_moderators()
returns table (id uuid, username text, full_name text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.full_name, u.email::text, p.created_at
      from public.profiles p left join auth.users u on u.id = p.id
     where p.is_moderator and not p.is_admin
     order by p.username;
end; $$;
revoke all on function public.admin_list_moderators() from public, anon;
grant execute on function public.admin_list_moderators() to authenticated;

-- Admin: find existing members by username, name or email
create or replace function public.admin_find_profiles(q text)
returns table (id uuid, username text, full_name text, email text, is_admin boolean, is_moderator boolean)
language plpgsql stable security definer set search_path = public as $$
declare v text := '%' || replace(replace(replace(trim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(q, ''))) < 2 then return; end if;
  return query
    select p.id, p.username, p.full_name, u.email::text, p.is_admin, p.is_moderator
      from public.profiles p left join auth.users u on u.id = p.id
     where p.username ilike ltrim(v, '@') or p.username ilike v or p.full_name ilike v or u.email ilike v
     order by p.username limit 20;
end; $$;
revoke all on function public.admin_find_profiles(text) from public, anon;
grant execute on function public.admin_find_profiles(text) to authenticated;

-- 7) Moderator: resolve / dismiss all open reports on the same target
create or replace function public.mod_resolve_report(report_id uuid, new_status text, reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports; v_reason text;
begin
  if not public.is_moderator() then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  v_reason := public.mod_require(reason);
  if new_status not in ('resolved', 'dismissed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select * into r from public.reports where id = report_id;
  if not found then
    raise exception 'البلاغ غير موجود.' using errcode = 'P0001';
  end if;
  update public.reports set status = new_status
   where target_type = r.target_type and target_id = r.target_id and status = 'open';
  perform public.mod_write_log(case when new_status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
                               'report', report_id, v_reason);
end; $$;
revoke all on function public.mod_resolve_report(uuid, text, text) from public, anon;
grant execute on function public.mod_resolve_report(uuid, text, text) to authenticated;

-- 8) Moderator: delete a post, project (with attachments), project comment or post comment.
-- Returns {"bucket": ..., "paths": [...]} so the client can remove the now-orphaned files.
create or replace function public.mod_delete_content(target_type text, target_id uuid, reason text)
returns json language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_reason text; v_bucket text; v_paths text[] := '{}';
begin
  if not public.is_moderator() then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  v_reason := public.mod_require(reason);
  if target_type = 'post' then
    select user_id, case when image_path is null then '{}'::text[] else array[image_path] end
      into v_owner, v_paths from public.posts where id = target_id;
    v_bucket := 'post-images';
  elsif target_type = 'project' then
    select user_id into v_owner from public.projects where id = target_id;
    select coalesce(array_agg(path), '{}') into v_paths from public.attachments where project_id = target_id;
    v_bucket := 'project-files';
  elsif target_type = 'comment' then
    select user_id into v_owner from public.comments where id = target_id;
  elsif target_type = 'post_comment' then
    select user_id into v_owner from public.post_comments where id = target_id;
  else
    raise exception 'invalid target type' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'المحتوى غير موجود (ربما حُذف).' using errcode = 'P0001';
  end if;
  if public.is_staff_user(v_owner) and not public.is_admin() then
    raise exception 'لا يمكن للمشرف التصرف في محتوى مدير أو مشرف.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_owner and is_admin) and v_owner <> auth.uid() then
    raise exception 'لا يمكن حذف محتوى مدير من هنا.' using errcode = '42501';
  end if;
  if target_type = 'post' then delete from public.posts where id = target_id;
  elsif target_type = 'project' then delete from public.projects where id = target_id;
  elsif target_type = 'comment' then delete from public.comments where id = target_id;
  else delete from public.post_comments where id = target_id;
  end if;
  update public.reports r set status = 'resolved'
   where r.target_type = mod_delete_content.target_type and r.target_id = mod_delete_content.target_id
     and r.status = 'open';
  perform public.mod_write_log('delete_' || target_type, target_type, target_id, v_reason);
  return json_build_object('bucket', v_bucket, 'paths', to_json(coalesce(v_paths, '{}')));
end; $$;
revoke all on function public.mod_delete_content(text, uuid, text) from public, anon;
grant execute on function public.mod_delete_content(text, uuid, text) to authenticated;

-- Moderators may remove storage files only once they are orphaned (row already deleted above)
-- and only when the uploader is not an admin or moderator.
drop policy if exists file_delete_moderator on storage.objects;
create policy file_delete_moderator on storage.objects for delete to authenticated using (
  bucket_id = 'project-files' and (select public.is_moderator())
  and not exists (select 1 from public.attachments a where a.path = storage.objects.name)
  and not exists (select 1 from public.profiles s where s.id::text = (storage.foldername(storage.objects.name))[1]
                  and (s.is_admin or s.is_moderator)));
-- Deleting needs the row to be visible; project-files are private, so moderators may see orphans only.
drop policy if exists file_read_moderator_orphan on storage.objects;
create policy file_read_moderator_orphan on storage.objects for select to authenticated using (
  bucket_id = 'project-files' and (select public.is_moderator())
  and not exists (select 1 from public.attachments a where a.path = storage.objects.name)
  and not exists (select 1 from public.profiles s where s.id::text = (storage.foldername(storage.objects.name))[1]
                  and (s.is_admin or s.is_moderator)));
drop policy if exists post_image_delete_moderator on storage.objects;
create policy post_image_delete_moderator on storage.objects for delete to authenticated using (
  bucket_id = 'post-images' and (select public.is_moderator())
  and not exists (select 1 from public.posts p where p.image_path = storage.objects.name)
  and not exists (select 1 from public.profiles s where s.id::text = (storage.foldername(storage.objects.name))[1]
                  and (s.is_admin or s.is_moderator)));

-- 9) Moderator: temporary suspension (1, 7 or 30 days) and lifting it
create or replace function public.mod_suspend_user(target uuid, days int, reason text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_reason text; v_until timestamptz;
begin
  if not public.is_moderator() then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  v_reason := public.mod_require(reason);
  if days is null or days not in (1, 7, 30) then
    raise exception 'مدة الإيقاف يجب أن تكون 1 أو 7 أو 30 يومًا.' using errcode = '22023';
  end if;
  if target is null or target = auth.uid() then
    raise exception 'لا يمكنك إيقاف حسابك.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'العضو غير موجود.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = target and is_admin)
     or (public.is_staff_user(target) and not public.is_admin()) then
    raise exception 'لا يمكن إيقاف حساب مدير أو مشرف.' using errcode = '42501';
  end if;
  v_until := now() + make_interval(days => days);
  update public.profiles set suspended_until = v_until where id = target;
  perform public.mod_write_log('suspend_' || days || 'd', 'profile', target, v_reason);
  return v_until;
end; $$;
revoke all on function public.mod_suspend_user(uuid, int, text) from public, anon;
grant execute on function public.mod_suspend_user(uuid, int, text) to authenticated;

create or replace function public.mod_unsuspend_user(target uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_reason text;
begin
  if not public.is_moderator() then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  v_reason := public.mod_require(reason);
  if target is null or (public.is_staff_user(target) and not public.is_admin()) then
    raise exception 'لا يمكن التصرف في حساب مدير أو مشرف.' using errcode = '42501';
  end if;
  update public.profiles set suspended_until = null where id = target;
  perform public.mod_write_log('unsuspend', 'profile', target, v_reason);
end; $$;
revoke all on function public.mod_unsuspend_user(uuid, text) from public, anon;
grant execute on function public.mod_unsuspend_user(uuid, text) to authenticated;

commit;
