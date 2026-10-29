-- Security hardening 2026-10-29: safe URLs, ad text limits, posts privileges.
-- Idempotent and non-destructive (no rows deleted). Requires posts + ad_requests migrations.
begin;

-- 1) Neutralize bad existing URLs (target_url is NOT NULL, so use '')
update public.ad_requests set target_url = '' where target_url !~* '^https://';
update public.profiles set website_url = null where website_url is not null and website_url !~* '^https?://';
update public.profiles set linkedin_url = null where linkedin_url is not null and linkedin_url !~* '^https?://';

-- 2) URL checks (ad check is NOT VALID: enforced for new/updated rows; old '' rows stay)
alter table public.ad_requests drop constraint if exists ad_requests_target_url_https;
alter table public.ad_requests add constraint ad_requests_target_url_https
  check (target_url ~* '^https://') not valid;
alter table public.profiles drop constraint if exists profiles_website_url_http;
alter table public.profiles add constraint profiles_website_url_http
  check (website_url is null or website_url ~* '^https?://');
alter table public.profiles drop constraint if exists profiles_linkedin_url_http;
alter table public.profiles add constraint profiles_linkedin_url_http
  check (linkedin_url is null or linkedin_url ~* '^https?://');

-- 3) Ad text length limits (NOT VALID so older long rows don't block the migration)
alter table public.ad_requests drop constraint if exists ad_requests_business_name_len;
alter table public.ad_requests add constraint ad_requests_business_name_len
  check (char_length(business_name) between 1 and 120) not valid;
alter table public.ad_requests drop constraint if exists ad_requests_title_len;
alter table public.ad_requests add constraint ad_requests_title_len
  check (char_length(title) between 1 and 120) not valid;
alter table public.ad_requests drop constraint if exists ad_requests_description_len;
alter table public.ad_requests add constraint ad_requests_description_len
  check (char_length(description) between 1 and 2000) not valid;

-- 4) Posts privileges: reset Supabase default ALL, re-grant least privilege.
-- Post edit (components/PostCard.tsx) updates only content + updated_at.
revoke all on public.posts, public.post_comments, public.post_likes from anon, authenticated;
grant select on public.posts, public.post_comments, public.post_likes to anon, authenticated;
grant insert(user_id,content,image_path), update(content,updated_at), delete on public.posts to authenticated;
grant insert(post_id,user_id,content), delete on public.post_comments to authenticated;
grant insert(post_id,user_id), delete on public.post_likes to authenticated;

commit;