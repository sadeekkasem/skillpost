-- SkillPost: admin panel (2026-10-30). Idempotent and non-destructive: safe to run more than once.
-- Requires the earlier migrations (is_admin(), posts, messages, friendships, ad_requests, reports,
-- attachments.scan_status). Adds: profiles.is_banned, ban enforcement, set_user_banned(), admin_stats().
begin;

-- 1) Ban flag. Users cannot change it themselves (no column grant); only set_user_banned() does.
alter table public.profiles add column if not exists is_banned boolean not null default false;
revoke update(is_banned) on public.profiles from anon, authenticated;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_banned() from public;
grant execute on function public.is_banned() to anon, authenticated;

-- 2) Banned users cannot create or edit content (applies to the signed-in caller).
create or replace function public.block_banned_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_banned() then
    raise exception 'تم إيقاف حسابك من قبل الإدارة، لا يمكنك النشر أو المراسلة.' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.block_banned_user() from public, anon, authenticated;

drop trigger if exists projects_block_banned on public.projects;
create trigger projects_block_banned before insert or update on public.projects
  for each row execute function public.block_banned_user();
drop trigger if exists posts_block_banned on public.posts;
create trigger posts_block_banned before insert or update on public.posts
  for each row execute function public.block_banned_user();
drop trigger if exists comments_block_banned on public.comments;
create trigger comments_block_banned before insert or update on public.comments
  for each row execute function public.block_banned_user();
drop trigger if exists post_comments_block_banned on public.post_comments;
create trigger post_comments_block_banned before insert on public.post_comments
  for each row execute function public.block_banned_user();
drop trigger if exists messages_block_banned on public.messages;
create trigger messages_block_banned before insert on public.messages
  for each row execute function public.block_banned_user();
drop trigger if exists attachments_block_banned on public.attachments;
create trigger attachments_block_banned before insert on public.attachments
  for each row execute function public.block_banned_user();
drop trigger if exists ad_requests_block_banned on public.ad_requests;
create trigger ad_requests_block_banned before insert on public.ad_requests
  for each row execute function public.block_banned_user();
drop trigger if exists friendships_block_banned on public.friendships;
create trigger friendships_block_banned before insert on public.friendships
  for each row execute function public.block_banned_user();

-- 3) Admin-only ban toggle (admins cannot ban themselves or other admins)
create or replace function public.set_user_banned(target uuid, banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if target = auth.uid() or exists (select 1 from public.profiles where id = target and is_admin) then
    raise exception 'لا يمكن حظر حساب مدير.' using errcode = 'P0001';
  end if;
  update public.profiles set is_banned = coalesce(banned, false) where id = target;
end; $$;
revoke all on function public.set_user_banned(uuid, boolean) from public, anon;
grant execute on function public.set_user_banned(uuid, boolean) to authenticated;

-- 4) Indexes for date filters and counts
create index if not exists profiles_created_idx on public.profiles(created_at desc);
create index if not exists comments_created_idx on public.comments(created_at desc);
create index if not exists post_comments_created_idx on public.post_comments(created_at desc);
create index if not exists messages_created_idx on public.messages(created_at desc);
create index if not exists ad_requests_created_idx on public.ad_requests(created_at desc);

-- 5) Statistics for the admin panel (one call, bypasses RLS, admin only)
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  d1 timestamptz := now() - interval '24 hours';
  d7 timestamptz := now() - interval '7 days';
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return json_build_object(
    'profiles_total',        (select count(*) from public.profiles),
    'profiles_7d',           (select count(*) from public.profiles where created_at > d7),
    'profiles_24h',          (select count(*) from public.profiles where created_at > d1),
    'profiles_banned',       (select count(*) from public.profiles where is_banned),
    'projects_total',        (select count(*) from public.projects),
    'projects_24h',          (select count(*) from public.projects where created_at > d1),
    'posts_total',           (select count(*) from public.posts),
    'posts_24h',             (select count(*) from public.posts where created_at > d1),
    'comments_total',        (select count(*) from public.comments),
    'comments_24h',          (select count(*) from public.comments where created_at > d1),
    'post_comments_total',   (select count(*) from public.post_comments),
    'post_comments_24h',     (select count(*) from public.post_comments where created_at > d1),
    'likes_total',           (select count(*) from public.likes),
    'post_likes_total',      (select count(*) from public.post_likes),
    'attachments_total',     (select count(*) from public.attachments),
    'attachments_clean',     (select count(*) from public.attachments where scan_status = 'clean'),
    'attachments_pending',   (select count(*) from public.attachments where scan_status = 'pending'),
    'attachments_rejected',  (select count(*) from public.attachments where scan_status = 'rejected'),
    'excel_files',           (select count(*) from public.attachments where name ~* '\.(xlsx|csv)$'),
    'friendships_accepted',  (select count(*) from public.friendships where status = 'accepted'),
    'friendships_pending',   (select count(*) from public.friendships where status = 'pending'),
    'messages_total',        (select count(*) from public.messages),
    'messages_24h',          (select count(*) from public.messages where created_at > d1),
    'reports_open',          (select count(*) from public.reports where status = 'open'),
    'reports_total',         (select count(*) from public.reports),
    'ads_pending',           (select count(*) from public.ad_requests where status = 'pending'),
    'ads_approved',          (select count(*) from public.ad_requests where status = 'approved'),
    'ads_active',            (select count(*) from public.ad_requests where status = 'approved' and now() between starts_at and ends_at),
    'ads_24h',               (select count(*) from public.ad_requests where created_at > d1)
  );
end; $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

commit;
