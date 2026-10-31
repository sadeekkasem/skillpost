-- SkillPost notifications, phase 1 upgrade (2026-10-31). Idempotent; safe to run more than once.
-- Builds on migration_2026-10-29_notifications.sql (table, RLS, base triggers already live).
-- Run AFTER migration_2026-10-30_moderators.sql (profiles.suspended_until) and
-- migration_2026-10-30_admin_panel.sql (profiles.is_banned).
-- Adds: 'message' type, like de-duplication, unlike cleanup, skip banned/suspended actors,
-- 90-day retention function. RLS is unchanged: recipients select/update(read_at)/delete
-- their own rows; clients cannot insert (only SECURITY DEFINER triggers do).
begin;

-- 0) Table (no-op when it already exists, kept so this file also works on a fresh database)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- 1) Allowed types (replace whatever type check exists)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.notifications add constraint notifications_type_check check (type in (
  'post_like','post_comment','project_like','project_comment','friend_request','friend_accept','message'
));

-- 2) Core helper: skips self-actions, banned/suspended actors, and duplicate unread
--    notifications for likes, friend requests and messages (same actor + target).
create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid, p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and exists (
    select 1 from public.profiles p
    where p.id = p_actor and (p.is_banned or coalesce(p.suspended_until > now(), false))
  ) then return; end if;
  if p_type in ('post_like','project_like','friend_request','message') and exists (
    select 1 from public.notifications n
    where n.user_id = p_user and n.actor_id is not distinct from p_actor and n.type = p_type
      and n.post_id is not distinct from p_post and n.project_id is not distinct from p_project
      and n.read_at is null
  ) then return; end if;
  insert into public.notifications(user_id, actor_id, type, post_id, project_id)
  values (p_user, p_actor, p_type, p_post, p_project);
end; $$;
revoke all on function public.notify(uuid,uuid,text,uuid,uuid) from public, anon, authenticated;

-- 3) Insert triggers (functions from 2026-10-29 are re-declared so this file is self-contained)
create or replace function public.notify_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'post_like', new.post_id, null);
  return new;
end; $$;
drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify after insert on public.post_likes
  for each row execute procedure public.notify_post_like();

create or replace function public.notify_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'post_comment', new.post_id, null);
  return new;
end; $$;
drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute procedure public.notify_post_comment();

create or replace function public.notify_project_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.projects where id = new.project_id), new.user_id, 'project_like', null, new.project_id);
  return new;
end; $$;
drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes
  for each row execute procedure public.notify_project_like();

create or replace function public.notify_project_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.projects where id = new.project_id), new.user_id, 'project_comment', null, new.project_id);
  return new;
end; $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute procedure public.notify_project_comment();

create or replace function public.notify_friendship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.addressee_id, new.requester_id, 'friend_request', null, null);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.notify(new.requester_id, new.addressee_id, 'friend_accept', null, null);
  end if;
  return new;
end; $$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update of status on public.friendships
  for each row execute procedure public.notify_friendship();

create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.recipient_id, new.sender_id, 'message', null, null);
  return new;
end; $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute procedure public.notify_message();

-- 4) Unlike: remove the matching unread like notification
create or replace function public.unnotify_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
  where type = 'post_like' and actor_id = old.user_id and post_id = old.post_id and read_at is null;
  return old;
end; $$;
drop trigger if exists post_likes_unnotify on public.post_likes;
create trigger post_likes_unnotify after delete on public.post_likes
  for each row execute procedure public.unnotify_post_like();

create or replace function public.unnotify_project_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
  where type = 'project_like' and actor_id = old.user_id and project_id = old.project_id and read_at is null;
  return old;
end; $$;
drop trigger if exists likes_unnotify on public.likes;
create trigger likes_unnotify after delete on public.likes
  for each row execute procedure public.unnotify_project_like();

revoke all on function public.notify_post_like() from public, anon, authenticated;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
revoke all on function public.notify_project_like() from public, anon, authenticated;
revoke all on function public.notify_project_comment() from public, anon, authenticated;
revoke all on function public.notify_friendship() from public, anon, authenticated;
revoke all on function public.notify_message() from public, anon, authenticated;
revoke all on function public.unnotify_post_like() from public, anon, authenticated;
revoke all on function public.unnotify_project_like() from public, anon, authenticated;

-- 5) Retention: delete notifications older than 90 days. Returns rows deleted.
create or replace function public.purge_old_notifications(p_days int default 90) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.notifications where created_at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.purge_old_notifications(int) from public, anon, authenticated;

-- Schedule daily at 03:30 UTC when pg_cron is installed; otherwise skip silently.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge_old_notifications';
    perform cron.schedule('purge_old_notifications', '30 3 * * *', 'select public.purge_old_notifications(90)');
  end if;
end $$;

commit;
