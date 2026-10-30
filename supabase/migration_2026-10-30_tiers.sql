-- SkillPost: membership tiers (2026-10-30). Idempotent and non-destructive: safe to run more than once.
-- Requires the earlier migrations (is_admin(), is_banned, excel_quota, messages, friendships, attachments).
-- Tiers: bronze (everyone) < silver (10 confirmed referrals) < gold (50 active days in last 60)
--        < diamond (set by admin until a date; falls back automatically after expiry).
-- Banned members always count as bronze and get no extra benefits.
begin;

-- 1) Columns. Users cannot write any of them directly (no column grants); only the functions below do.
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists diamond_until date;
alter table public.profiles add column if not exists pinned_project_id uuid references public.projects(id) on delete set null;
alter table public.profiles add column if not exists profile_views int not null default 0;
revoke update(referral_code, referred_by, diamond_until, pinned_project_id, profile_views) on public.profiles from anon, authenticated;
do $$ begin
  alter table public.profiles add constraint profiles_referred_not_self check (referred_by is distinct from id);
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_referral_code_key on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

alter table public.attachments add column if not exists created_at timestamptz not null default now();
alter table public.attachments add column if not exists downloads int not null default 0;
revoke update(created_at, downloads) on public.attachments from anon, authenticated;
create index if not exists attachments_owner_created_idx on public.attachments(owner_id, created_at);

-- Local "today" for the site (Finland)
create or replace function public.site_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Helsinki')::date;
$$;

-- 2) Referral codes: short code per profile, filled for new and existing rows
create or replace function public.profiles_referral_code() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.referral_code is null then
    new.referral_code := substr(md5(new.id::text), 1, 8);
  end if;
  return new;
end; $$;
drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code before insert on public.profiles
  for each row execute function public.profiles_referral_code();
update public.profiles set referral_code = substr(md5(id::text), 1, 8) where referral_code is null;

-- Save the referrer once. Only for new accounts (first 7 days), never self, never changed later.
create or replace function public.apply_referral(uid uuid, code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare ref uuid;
begin
  if uid is null or coalesce(btrim(code), '') = '' then return false; end if;
  select id into ref from public.profiles where referral_code = lower(btrim(code));
  if ref is null or ref = uid then return false; end if;
  update public.profiles set referred_by = ref
   where id = uid and referred_by is null and created_at > now() - interval '7 days';
  return found;
end; $$;
revoke all on function public.apply_referral(uuid, text) from public, anon, authenticated;

create or replace function public.set_referrer(code text) returns boolean
language sql security definer set search_path = public as $$
  select public.apply_referral(auth.uid(), code);
$$;
revoke all on function public.set_referrer(text) from public, anon;
grant execute on function public.set_referrer(text) to authenticated;

-- Signup with options.data.ref also records the referrer (runs after the profile is created)
create or replace function public.signup_referral() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_referral(new.id, new.raw_user_meta_data->>'ref');
  return new;
end; $$;
revoke all on function public.signup_referral() from public, anon, authenticated;
drop trigger if exists on_auth_user_referral on auth.users;
create trigger on_auth_user_referral after insert on auth.users
  for each row execute procedure public.signup_referral();

-- Confirmed, existing, not banned members brought by uid
create or replace function public.referral_count(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles p join auth.users u on u.id = p.id
   where p.referred_by = uid and not p.is_banned and u.email_confirmed_at is not null;
$$;
revoke all on function public.referral_count(uuid) from public, anon, authenticated;

-- 3) Daily activity
create table if not exists public.member_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.member_activity enable row level security;
revoke all on public.member_activity from anon, authenticated;
grant select on public.member_activity to authenticated;
drop policy if exists member_activity_own on public.member_activity;
create policy member_activity_own on public.member_activity for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_activity() returns void
language sql security definer set search_path = public as $$
  insert into public.member_activity(user_id, day)
  select auth.uid(), public.site_today()
   where auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid())
  on conflict do nothing;
$$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

create or replace function public.active_days(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.member_activity
   where user_id = uid and day > public.site_today() - 60 and day <= public.site_today();
$$;
revoke all on function public.active_days(uuid) from public, anon, authenticated;

-- 4) Effective tier (computed on read, so diamond expiry needs no job)
create or replace function public.member_tier(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.id is null or p.is_banned then 'bronze'
    when p.diamond_until >= public.site_today() then 'diamond'
    when public.active_days(p.id) >= 50 then 'gold'
    when public.referral_count(p.id) >= 10 then 'silver'
    else 'bronze' end
  from (select 1) x left join public.profiles p on p.id = uid;
$$;
revoke all on function public.member_tier(uuid) from public;
grant execute on function public.member_tier(uuid) to anon, authenticated;

create or replace function public.tier_excel_limit(tier text) returns int
language sql immutable as $$
  select case tier when 'diamond' then 30 when 'gold' then 6 when 'silver' then 4 else 3 end;
$$;

-- Badges for many members in one call
create or replace function public.member_tiers(ids uuid[]) returns table(id uuid, tier text)
language sql stable security definer set search_path = public as $$
  select p.id, public.member_tier(p.id) from public.profiles p
   where p.id = any(ids[1:200]);
$$;
revoke all on function public.member_tiers(uuid[]) from public;
grant execute on function public.member_tiers(uuid[]) to anon, authenticated;

-- Current diamond members (for featuring their projects)
create or replace function public.diamond_members() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where diamond_until >= public.site_today() and not is_banned;
$$;
revoke all on function public.diamond_members() from public;
grant execute on function public.diamond_members() to anon, authenticated;

-- Excel usage with the tier rules: diamond counts this calendar month, others lifetime
create or replace function public.excel_usage(uid uuid, tier text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.attachments a
   where a.owner_id = uid and a.name ~* '\.(xlsx|csv)$'
     and (tier <> 'diamond'
          or (a.created_at at time zone 'Europe/Helsinki') >= date_trunc('month', public.site_today()::timestamp));
$$;
revoke all on function public.excel_usage(uuid, text) from public, anon, authenticated;

create or replace function public.my_tier_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t text;
  p public.profiles;
begin
  select * into p from public.profiles where id = uid;
  if p.id is null then return null; end if;
  t := public.member_tier(uid);
  return json_build_object(
    'tier', t,
    'referral_code', p.referral_code,
    'referred', p.referred_by is not null,
    'referrals', public.referral_count(uid),
    'active_days', public.active_days(uid),
    'diamond_until', p.diamond_until,
    'excel_limit', greatest(p.excel_quota, public.tier_excel_limit(t)),
    'excel_used', public.excel_usage(uid, t),
    'excel_monthly', t = 'diamond',
    'max_file_mb', case when t = 'diamond' then 10 else 2 end,
    'pinned_project_id', p.pinned_project_id
  );
end; $$;
revoke all on function public.my_tier_info() from public, anon;
grant execute on function public.my_tier_info() to authenticated;

-- 5) Admin: set, extend or remove diamond
create or replace function public.set_diamond(target uuid, until date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.profiles set diamond_until = until where id = target;
end; $$;
revoke all on function public.set_diamond(uuid, date) from public, anon;
grant execute on function public.set_diamond(uuid, date) to authenticated;

create or replace function public.admin_tiers(ids uuid[]) returns table(id uuid, tier text, diamond_until date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query select p.id, public.member_tier(p.id), p.diamond_until
    from public.profiles p where p.id = any(ids);
end; $$;
revoke all on function public.admin_tiers(uuid[]) from public, anon;
grant execute on function public.admin_tiers(uuid[]) to authenticated;

-- 6) Excel limit per tier: greatest(excel_quota, tier limit). Admin raises via set_excel_quota still work.
create or replace function public.attachments_excel_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare t text;
begin
  new.created_at := now();
  new.downloads := 0;
  if new.name ~* '\.(xlsx|csv)$' then
    perform pg_advisory_xact_lock(hashtext('excel_limit:' || new.owner_id::text));
    t := public.member_tier(new.owner_id);
    if public.excel_usage(new.owner_id, t)
       >= greatest(coalesce((select p.excel_quota from public.profiles p where p.id = new.owner_id), 3),
                   public.tier_excel_limit(t)) then
      raise exception 'excel_limit: Excel quota reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- 7) Chat: friends, any member when the sender is diamond, or a reply to someone who wrote to you. Contact filter + rate limit stay.
create or replace function public.can_message(sender uuid, recipient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sender = auth.uid() and (exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = sender and f.addressee_id = recipient)
          or (f.requester_id = recipient and f.addressee_id = sender)))
    or public.member_tier(sender) = 'diamond'
    or exists (select 1 from public.messages m where m.sender_id = recipient and m.recipient_id = sender));
$$;
revoke all on function public.can_message(uuid, uuid) from public, anon;
grant execute on function public.can_message(uuid, uuid) to authenticated;

drop policy if exists messages_insert_friends on public.messages;
create policy messages_insert_friends on public.messages for insert to authenticated
  with check (
    messages.sender_id = (select auth.uid())
    and public.can_message(messages.sender_id, messages.recipient_id)
  );

-- 8) Counters: profile views (one per viewer per day) and file downloads
create table if not exists public.profile_view_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (profile_id, viewer_id, day)
);
alter table public.profile_view_log enable row level security;
revoke all on public.profile_view_log from anon, authenticated;

create or replace function public.record_profile_view(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or target is null or target = auth.uid() then return; end if;
  insert into public.profile_view_log(profile_id, viewer_id, day)
  select target, auth.uid(), public.site_today()
   where exists (select 1 from public.profiles where id = target)
     and exists (select 1 from public.profiles where id = auth.uid())
  on conflict do nothing;
  if found then
    update public.profiles set profile_views = profile_views + 1 where id = target;
  end if;
end; $$;
revoke all on function public.record_profile_view(uuid) from public, anon;
grant execute on function public.record_profile_view(uuid) to authenticated;

create or replace function public.count_download(att uuid) returns void
language sql security definer set search_path = public as $$
  update public.attachments set downloads = downloads + 1
   where id = att and owner_id is distinct from auth.uid();
$$;
revoke all on function public.count_download(uuid) from public;
grant execute on function public.count_download(uuid) to anon, authenticated;

-- Owner stats (diamond only)
create or replace function public.my_profile_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if public.member_tier(uid) <> 'diamond' then return null; end if;
  return json_build_object(
    'views', (select profile_views from public.profiles where id = uid),
    'downloads', (select coalesce(sum(downloads), 0) from public.attachments where owner_id = uid),
    'likes', (select count(*) from public.likes l join public.projects pr on pr.id = l.project_id where pr.user_id = uid)
  );
end; $$;
revoke all on function public.my_profile_stats() from public, anon;
grant execute on function public.my_profile_stats() to authenticated;

-- 9) Pinned project: diamond only, own project only (null removes it)
create or replace function public.set_pinned_project(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if pid is not null then
    if public.member_tier(uid) <> 'diamond' then
      raise exception 'تثبيت مشروع ميزة خاصة بأعضاء ماسي.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.projects where id = pid and user_id = uid) then
      raise exception 'يمكنك تثبيت مشاريعك فقط.' using errcode = 'P0001';
    end if;
  end if;
  update public.profiles set pinned_project_id = pid where id = uid;
end; $$;
revoke all on function public.set_pinned_project(uuid) from public, anon;
grant execute on function public.set_pinned_project(uuid) to authenticated;

-- 10) File size: bucket allows 10 MB; non-diamond members stay at 2 MB (checked when storage records the size)
update storage.buckets set file_size_limit = 10485760 where id = 'project-files';

create or replace function public.project_file_size_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bucket_id = 'project-files'
     and coalesce((new.metadata->>'size')::bigint, 0) > 2097152
     and public.member_tier(new.owner) <> 'diamond' then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.project_file_size_limit() from public, anon, authenticated;
do $$ begin
  execute 'drop trigger if exists project_file_size_limit on storage.objects';
  execute 'create trigger project_file_size_limit before insert or update on storage.objects
           for each row execute function public.project_file_size_limit()';
exception when others then
  raise notice 'storage size trigger skipped: %', sqlerrm;
end $$;

-- 11) Admin stats: same keys as before plus tier counts
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
    from (select public.member_tier(id) t from public.profiles) x;
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
    'ads_24h',               (select count(*) from public.ad_requests where created_at > d1),
    'tier_diamond',          tiers->'tier_diamond',
    'tier_gold',             tiers->'tier_gold',
    'tier_silver',           tiers->'tier_silver',
    'tier_bronze',           tiers->'tier_bronze'
  );
end; $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

commit;
