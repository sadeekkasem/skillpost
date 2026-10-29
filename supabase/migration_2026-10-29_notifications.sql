-- Notifications (idempotent, non-destructive). Requires profiles, projects, comments, likes, friendships, posts, post_comments, post_likes.
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('post_like','post_comment','project_like','project_comment','friend_request','friend_accept')),
  post_id uuid references public.posts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
-- FK name used in PostgREST embed: notifications_actor_id_fkey
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

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

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid, p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications(user_id, actor_id, type, post_id, project_id)
  values (p_user, p_actor, p_type, p_post, p_project);
end; $$;
revoke all on function public.notify(uuid,uuid,text,uuid,uuid) from public, anon, authenticated;

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

revoke all on function public.notify_post_like() from public, anon, authenticated;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
revoke all on function public.notify_project_like() from public, anon, authenticated;
revoke all on function public.notify_project_comment() from public, anon, authenticated;
revoke all on function public.notify_friendship() from public, anon, authenticated;

commit;
