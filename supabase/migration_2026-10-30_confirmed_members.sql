-- 2026-10-30: confirmed members only + signup name + auto-cleanup of unconfirmed signups
-- Idempotent; safe to run more than once.
begin;

-- 1) Column + backfill
alter table public.profiles add column if not exists email_confirmed boolean not null default false;
update public.profiles p
   set email_confirmed = (u.email_confirmed_at is not null)
  from auth.users u
 where u.id = p.id and p.email_confirmed is distinct from (u.email_confirmed_at is not null);
create index if not exists profiles_email_confirmed_idx on public.profiles(email_confirmed);

-- 2) create_profile: name from metadata (2..50 chars trimmed), consent logic unchanged
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare
 meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
 opt_in boolean := coalesce(meta->>'marketing_opt_in', '') = 'true';
 nm text := btrim(coalesce(meta->>'full_name', ''));
begin
 if char_length(nm) < 2 or char_length(nm) > 50 then nm := 'عضو جديد'; end if;
 insert into public.profiles(id, username, full_name, terms_accepted_at, age_confirmed_at, marketing_opt_in, marketing_opt_in_at, email_confirmed)
 values(
  new.id,
  'user_'||replace(new.id::text,'-',''),
  nm,
  case when coalesce(meta->>'terms_accepted', '') = 'true' then now() end,
  case when coalesce(meta->>'age_confirmed', '') = 'true' then now() end,
  opt_in,
  case when opt_in then now() end,
  new.email_confirmed_at is not null
 );
 return new;
end; $$;
revoke all on function public.create_profile() from public, anon, authenticated;

-- 3) Keep email_confirmed in sync with auth.users
create or replace function public.sync_email_confirmed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.profiles
    set email_confirmed = (new.email_confirmed_at is not null)
  where id = new.id and email_confirmed is distinct from (new.email_confirmed_at is not null);
 return new;
end; $$;
revoke all on function public.sync_email_confirmed() from public, anon, authenticated;
drop trigger if exists sync_email_confirmed on auth.users;
create trigger sync_email_confirmed after insert or update of email_confirmed_at on auth.users
 for each row execute function public.sync_email_confirmed();

-- 4) Users cannot flip their own flag (only definer functions / admins may)
create or replace function public.protect_email_confirmed() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.email_confirmed is distinct from old.email_confirmed
    and current_user in ('anon','authenticated') then
   new.email_confirmed := old.email_confirmed;
 end if;
 return new;
end; $$;
drop trigger if exists protect_email_confirmed on public.profiles;
create trigger protect_email_confirmed before update on public.profiles
 for each row execute function public.protect_email_confirmed();

-- 5) Admin stats: member counts only confirmed accounts (+ unconfirmed count)
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  d1 timestamptz := now() - interval '24 hours';
  d7 timestamptz := now() - interval '7 days';
  tiers json;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select json_build_object(
    'tier_diamond', count(*) filter (where t = 'diamond'),
    'tier_gold',    count(*) filter (where t = 'gold'),
    'tier_silver',  count(*) filter (where t = 'silver'),
    'tier_bronze',  count(*) filter (where t = 'bronze'))
    into tiers
    from (select public.member_tier(id) t from public.profiles where email_confirmed) x;
  return json_build_object(
    'profiles_total',        (select count(*) from public.profiles where email_confirmed),
    'profiles_7d',           (select count(*) from public.profiles where email_confirmed and created_at > d7),
    'profiles_24h',          (select count(*) from public.profiles where email_confirmed and created_at > d1),
    'profiles_unconfirmed',  (select count(*) from public.profiles where not email_confirmed),
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
    'ads_24h',               (select count(*) from public.ad_requests where created_at > d1),
    'tier_diamond',          tiers->'tier_diamond',
    'tier_gold',             tiers->'tier_gold',
    'tier_silver',           tiers->'tier_silver',
    'tier_bronze',           tiers->'tier_bronze'
  );
end; $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 6) Cleanup of unconfirmed signups older than 7 days with no content.
-- profiles.id -> auth.users on delete cascade; all tables referencing profiles cascade.
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
     and not exists (select 1 from public.messages x where x.sender_id = u.id or x.recipient_id = u.id)
  returning 1)
 select count(*) into n from del;
 return n;
end; $$;
revoke all on function public.cleanup_unconfirmed_users() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$ begin
 if exists (select 1 from cron.job where jobname = 'cleanup-unconfirmed-users') then
   perform cron.unschedule('cleanup-unconfirmed-users');
 end if;
 perform cron.schedule('cleanup-unconfirmed-users', '30 3 * * *', 'select public.cleanup_unconfirmed_users();');
end $$;

commit;
