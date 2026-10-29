-- Search, reports and rate limits. Idempotent: safe to re-run. Requires public.is_admin().
begin;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','project','comment','post_comment','profile')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists reports_reporter_idx on public.reports(reporter_id, created_at);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, delete on public.reports to authenticated;
grant update(status) on public.reports to authenticated;

drop policy if exists report_insert_own on public.reports;
create policy report_insert_own on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
drop policy if exists report_select on public.reports;
create policy report_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists report_admin_update on public.reports;
create policy report_admin_update on public.reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists report_admin_delete on public.reports;
create policy report_admin_delete on public.reports for delete to authenticated
  using ((select public.is_admin()));

-- Rate limits. Args: max rows, window interval, owner column, Arabic message.
create index if not exists posts_user_created_idx on public.posts(user_id, created_at);
create index if not exists post_comments_user_created_idx on public.post_comments(user_id, created_at);
create index if not exists comments_user_created_idx on public.comments(user_id, created_at);
create index if not exists ad_requests_user_created_idx on public.ad_requests(user_id, created_at);

create or replace function public.enforce_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int := tg_argv[0]::int;
  v_window interval := tg_argv[1]::interval;
  v_col text := tg_argv[2];
  v_msg text := tg_argv[3];
  v_owner uuid;
  v_count int;
begin
  if public.is_admin() then return new; end if;
  v_owner := (to_jsonb(new) ->> v_col)::uuid;
  if v_owner is null then return new; end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
                 tg_table_schema, tg_table_name, v_col)
    into v_count using v_owner, v_window;
  if v_count >= v_max then
    raise exception '%', v_msg using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_rate_limit() from public, anon, authenticated;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute procedure public.enforce_rate_limit('10', '1 hour', 'user_id', 'تجاوزت الحد المسموح: 10 منشورات في الساعة. حاول لاحقًا.');
drop trigger if exists post_comments_rate_limit on public.post_comments;
create trigger post_comments_rate_limit before insert on public.post_comments
  for each row execute procedure public.enforce_rate_limit('30', '1 hour', 'user_id', 'تجاوزت الحد المسموح: 30 تعليقًا في الساعة. حاول لاحقًا.');
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
  for each row execute procedure public.enforce_rate_limit('30', '1 hour', 'user_id', 'تجاوزت الحد المسموح: 30 تعليقًا في الساعة. حاول لاحقًا.');
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
  for each row execute procedure public.enforce_rate_limit('20', '1 day', 'reporter_id', 'تجاوزت الحد المسموح: 20 بلاغًا في اليوم. حاول غدًا.');
drop trigger if exists ad_requests_rate_limit on public.ad_requests;
create trigger ad_requests_rate_limit before insert on public.ad_requests
  for each row execute procedure public.enforce_rate_limit('5', '1 day', 'user_id', 'تجاوزت الحد المسموح: 5 طلبات إعلان في اليوم. حاول غدًا.');

commit;
