-- Idempotent: safe to re-run on new or existing project (no data deleted). No real personal data during testing.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null,
 full_name text not null default '' check(char_length(full_name)<=80),
 bio text not null default '' check(char_length(bio)<=1000),
 created_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 120),
 description text not null check(char_length(trim(description)) between 1 and 10000),
 category text not null check(category in ('Excel','محاسبة','برمجة','تصميم','لغات','أعمال')),
 created_at timestamptz not null default now()
);
create table if not exists public.comments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 content text not null check(char_length(trim(content)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create table if not exists public.likes (
 user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 primary key(user_id,project_id)
);
create table if not exists public.attachments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 path text unique not null,
 name text not null check(char_length(name) between 1 and 255)
);
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists projects_date_idx on public.projects(created_at desc);
create index if not exists comments_project_idx on public.comments(project_id);
create index if not exists attachments_project_idx on public.attachments(project_id);
create index if not exists likes_project_idx on public.likes(project_id);
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,full_name) values(new.id,'user_'||replace(new.id::text,'-',''),'عضو جديد');
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile();
revoke all on function public.create_profile() from public,anon,authenticated;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.attachments enable row level security;
-- Least-privilege grants; email remains inside auth.users.
revoke all on public.profiles,public.projects,public.comments,public.likes,public.attachments from anon,authenticated;
grant select on public.profiles,public.projects,public.comments,public.likes,public.attachments to anon,authenticated;
grant update(full_name,bio) on public.profiles to authenticated;
grant insert(user_id,title,description,category),delete on public.projects to authenticated;
grant insert(project_id,user_id,content),delete on public.comments to authenticated;
grant insert(user_id,project_id),delete on public.likes to authenticated;
grant insert(project_id,owner_id,path,name),delete on public.attachments to authenticated;
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select using(true);
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists project_read on public.projects;
create policy project_read on public.projects for select using(true);
drop policy if exists project_insert on public.projects;
create policy project_insert on public.projects for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists project_delete on public.projects;
create policy project_delete on public.projects for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists comment_read on public.comments;
create policy comment_read on public.comments for select using(true);
drop policy if exists comment_insert on public.comments;
create policy comment_insert on public.comments for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists comment_delete on public.comments;
create policy comment_delete on public.comments for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists like_read on public.likes;
create policy like_read on public.likes for select using(true);
drop policy if exists like_insert on public.likes;
create policy like_insert on public.likes for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists like_delete on public.likes;
create policy like_delete on public.likes for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists attachment_read on public.attachments;
create policy attachment_read on public.attachments for select using(true);
drop policy if exists attachment_insert on public.attachments;
create policy attachment_insert on public.attachments for insert to authenticated with check(
 owner_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
 and path like owner_id::text||'/'||project_id::text||'/%'
);
drop policy if exists attachment_delete on public.attachments;
create policy attachment_delete on public.attachments for delete to authenticated using(owner_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,10485760,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf','image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
drop policy if exists file_insert on storage.objects;
create policy file_insert on storage.objects for insert to authenticated with check(
 bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=(select auth.uid()))
);
drop policy if exists file_read on storage.objects;
create policy file_read on storage.objects for select to authenticated using(
 bucket_id='project-files' and ( (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.attachments a where a.path=name))
);
drop policy if exists file_delete on storage.objects;
create policy file_delete on storage.objects for delete to authenticated using(bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- ===== Additions 2026-10-29 (same as migration_2026-10-29.sql) =====

-- 1) Profiles: new columns used by the app
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists specialty text check (specialty is null or char_length(specialty) <= 120);
alter table public.profiles add column if not exists website_url text check (website_url is null or char_length(website_url) <= 500);
alter table public.profiles add column if not exists linkedin_url text check (linkedin_url is null or char_length(linkedin_url) <= 500);
alter table public.profiles add column if not exists contact_email text check (contact_email is null or char_length(contact_email) <= 254);
-- Users may edit their own profile fields, but NOT is_admin (column-level grant).
grant update(full_name,bio,specialty,website_url,linkedin_url,contact_email,avatar_path) on public.profiles to authenticated;

-- 2) Admin helper
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3) Projects: owner edit (used by ProjectDetail) + admin update/delete
grant update(title,description,category) on public.projects to authenticated;
drop policy if exists project_update on public.projects;
create policy project_update on public.projects for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists project_delete on public.projects;
create policy project_delete on public.projects for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 4) Comments: admin update/delete
grant update(content) on public.comments to authenticated;
drop policy if exists comment_update on public.comments;
create policy comment_update on public.comments for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists comment_delete on public.comments;
create policy comment_delete on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 5) Attachments: admin update/delete
grant update(name) on public.attachments to authenticated;
drop policy if exists attachment_update on public.attachments;
create policy attachment_update on public.attachments for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists attachment_delete on public.attachments;
create policy attachment_delete on public.attachments for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- 6) Storage: project-files admin read/delete; avatars bucket (public, getPublicUrl)
drop policy if exists file_read on storage.objects;
create policy file_read on storage.objects for select to authenticated using (
  bucket_id = 'project-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.attachments a where a.path = name)
    or (select public.is_admin())));
drop policy if exists file_delete on storage.objects;
create policy file_delete on storage.objects for delete to authenticated using (
  bucket_id = 'project-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
-- Avatar paths are "<uid>/<uuid>.<ext>" (components/Account.tsx:301)
drop policy if exists avatar_read on storage.objects;
create policy avatar_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())))
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- 7) Friendships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
-- FK names must be friendships_requester_id_fkey / friendships_addressee_id_fkey (app/friends/page.tsx:64)
create unique index if not exists friendships_pair_uidx on public.friendships
  (least(requester_id,addressee_id), greatest(requester_id,addressee_id));
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists friendships_touch on public.friendships;
create trigger friendships_touch before update on public.friendships
  for each row execute procedure public.touch_updated_at();
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select, delete on public.friendships to authenticated;
grant insert(requester_id,addressee_id,status) on public.friendships to authenticated;
grant update(status) on public.friendships to authenticated;
drop policy if exists friendship_read on public.friendships;
create policy friendship_read on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id) or (select public.is_admin()));
drop policy if exists friendship_insert on public.friendships;
create policy friendship_insert on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists friendship_update on public.friendships;
create policy friendship_update on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
drop policy if exists friendship_delete on public.friendships;
create policy friendship_delete on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id) or (select public.is_admin()));

-- 8) Ad requests
create table if not exists public.ad_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  contact_info text not null,
  title text not null,
  description text not null,
  target_url text not null,
  duration_days int not null check (duration_days in (7,14,30)),
  status text not null default 'pending' check (status in ('pending','approved','rejected','stopped')),
  price numeric(10,2),
  currency text not null default 'USD' check (currency in ('USD','ILS','JOD')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ad_requests_user_idx on public.ad_requests(user_id);
create index if not exists ad_requests_status_idx on public.ad_requests(status, starts_at, ends_at);
alter table public.ad_requests enable row level security;
revoke all on public.ad_requests from anon, authenticated;
grant select, insert, delete on public.ad_requests to authenticated;
grant update(status,price,currency,starts_at,ends_at) on public.ad_requests to authenticated;
drop policy if exists ad_insert_own on public.ad_requests;
create policy ad_insert_own on public.ad_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and price is null
              and starts_at is null and ends_at is null);
drop policy if exists ad_select on public.ad_requests;
create policy ad_select on public.ad_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists ad_admin_update on public.ad_requests;
create policy ad_admin_update on public.ad_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists ad_admin_delete on public.ad_requests;
create policy ad_admin_delete on public.ad_requests for delete to authenticated
  using ((select public.is_admin()));

create or replace function public.get_active_ads()
returns table (id uuid, title text, description text, target_url text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.description, a.target_url, a.starts_at, a.ends_at
  from public.ad_requests a
  where a.status = 'approved' and now() between a.starts_at and a.ends_at
  order by a.starts_at desc;
$$;
revoke all on function public.get_active_ads() from public;
grant execute on function public.get_active_ads() to anon, authenticated;

commit;