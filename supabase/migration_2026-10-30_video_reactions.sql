-- SkillPost: likes and comments on channel videos (2026-10-30). Idempotent; safe to run more than once.
-- Run AFTER migration_2026-10-30_moderators.sql and migration_2026-10-30_confirmed_members.sql
-- (needs is_admin(), is_moderator(), is_banned(), is_suspended(), block_banned_user(), is_staff_user(),
-- mod_require(), mod_write_log()).
begin;

-- 1) Tables
create table if not exists public.video_likes (
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index if not exists video_likes_user_idx on public.video_likes(user_id);

create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
-- FK name video_comments_user_id_fkey is used in PostgREST embeds.
create index if not exists video_comments_video_idx on public.video_comments(video_id, created_at);
create index if not exists video_comments_user_idx on public.video_comments(user_id);

alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;

-- 2) Grants (column level, like posts)
revoke all on public.video_likes, public.video_comments from anon, authenticated;
grant select on public.video_likes, public.video_comments to anon, authenticated;
grant insert(video_id, user_id), delete on public.video_likes to authenticated;
grant insert(video_id, user_id, body), delete on public.video_comments to authenticated;

-- 3) Policies: anyone reads; signed-in, non-banned, non-suspended users write their own rows
drop policy if exists video_like_read on public.video_likes;
create policy video_like_read on public.video_likes for select using (true);
drop policy if exists video_like_insert on public.video_likes;
create policy video_like_insert on public.video_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()) and not (select public.is_suspended()));
drop policy if exists video_like_delete on public.video_likes;
create policy video_like_delete on public.video_likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists video_comment_read on public.video_comments;
create policy video_comment_read on public.video_comments for select using (true);
drop policy if exists video_comment_insert on public.video_comments;
create policy video_comment_insert on public.video_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()) and not (select public.is_suspended()));
drop policy if exists video_comment_delete on public.video_comments;
create policy video_comment_delete on public.video_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or (select public.is_moderator()));

-- 4) Same ban/suspension trigger as posts and comments (clear error message)
drop trigger if exists video_likes_block_banned on public.video_likes;
create trigger video_likes_block_banned before insert on public.video_likes
  for each row execute function public.block_banned_user();
drop trigger if exists video_comments_block_banned on public.video_comments;
create trigger video_comments_block_banned before insert on public.video_comments
  for each row execute function public.block_banned_user();

-- 5) Moderator/admin delete with a logged reason (same rules as mod_delete_content)
create or replace function public.mod_delete_video_comment(comment_id uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_reason text;
begin
  if not public.is_moderator() then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  v_reason := public.mod_require(reason);
  select user_id into v_owner from public.video_comments where id = comment_id;
  if v_owner is null then
    raise exception 'المحتوى غير موجود (ربما حُذف).' using errcode = 'P0001';
  end if;
  if public.is_staff_user(v_owner) and not public.is_admin() then
    raise exception 'لا يمكن للمشرف التصرف في محتوى مدير أو مشرف.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_owner and is_admin) and v_owner <> auth.uid() then
    raise exception 'لا يمكن حذف محتوى مدير من هنا.' using errcode = '42501';
  end if;
  delete from public.video_comments where id = comment_id;
  perform public.mod_write_log('delete_video_comment', 'video_comment', comment_id, v_reason);
end; $$;
revoke all on function public.mod_delete_video_comment(uuid, text) from public, anon;
grant execute on function public.mod_delete_video_comment(uuid, text) to authenticated;

-- 6) Unconfirmed-signup cleanup: video comments and likes count as content
create or replace function public.cleanup_unconfirmed_users() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 with del as (
  delete from auth.users u
   where u.email_confirmed_at is null
     and u.created_at < now() - interval '7 days'
     and not exists (select 1 from public.posts x where x.user_id = u.id)
     and not exists (select 1 from public.projects x where x.user_id = u.id)
     and not exists (select 1 from public.comments x where x.user_id = u.id)
     and not exists (select 1 from public.post_comments x where x.user_id = u.id)
     and not exists (select 1 from public.video_comments x where x.user_id = u.id)
     and not exists (select 1 from public.messages x where x.sender_id = u.id or x.recipient_id = u.id)
  returning 1)
 select count(*) into n from del;
 return n;
end; $$;
revoke all on function public.cleanup_unconfirmed_users() from public, anon, authenticated;

commit;
