-- ===== Additions 2026-10-29: Facebook-style posts (same as migration_2026-10-29_posts.sql) =====
-- Idempotent and non-destructive: safe to re-run. Requires public.is_admin() from migration_2026-10-29.sql.
begin;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- FK names: posts_user_id_fkey, post_comments_user_id_fkey (used in PostgREST embeds)
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id, created_at desc);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_id_idx on public.post_comments(post_id, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;

-- Column-level grants
grant select on public.posts, public.post_comments, public.post_likes to anon, authenticated;
grant insert(user_id,content,image_path), update(content,updated_at), delete on public.posts to authenticated;
grant insert(post_id,user_id,content), delete on public.post_comments to authenticated;
grant insert(post_id,user_id), delete on public.post_likes to authenticated;

-- Posts
drop policy if exists post_read on public.posts;
create policy post_read on public.posts for select using (true);
drop policy if exists post_insert on public.posts;
create policy post_insert on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists post_update on public.posts;
create policy post_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists post_delete on public.posts;
create policy post_delete on public.posts for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Post comments
drop policy if exists post_comment_read on public.post_comments;
create policy post_comment_read on public.post_comments for select using (true);
drop policy if exists post_comment_insert on public.post_comments;
create policy post_comment_insert on public.post_comments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists post_comment_delete on public.post_comments;
create policy post_comment_delete on public.post_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Post likes
drop policy if exists post_like_read on public.post_likes;
create policy post_like_read on public.post_likes for select using (true);
drop policy if exists post_like_insert on public.post_likes;
create policy post_like_insert on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists post_like_delete on public.post_likes;
create policy post_like_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Storage: public post-images bucket, paths "<uid>/<uuid>.<ext>"
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-images','post-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
drop policy if exists post_image_read on storage.objects;
create policy post_image_read on storage.objects for select using (bucket_id = 'post-images');
drop policy if exists post_image_insert on storage.objects;
create policy post_image_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists post_image_delete on storage.objects;
create policy post_image_delete on storage.objects for delete to authenticated using (
  bucket_id = 'post-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

commit;
