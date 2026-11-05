-- SkillPost Phase B: like timestamps, project ratings, real challenges. Idempotent; safe to re-run.
-- Requires earlier migrations (public.is_admin(), public.block_banned_user()).

-- a) likes.created_at
alter table public.likes add column if not exists created_at timestamptz not null default now();
create index if not exists likes_created_at_idx on public.likes(created_at);

-- b) project ratings
create table if not exists public.project_ratings (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_ratings_user_idx on public.project_ratings(user_id);
alter table public.project_ratings enable row level security;

create or replace function public.project_rating_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
    raise exception 'لا يمكنك تقييم مشروعك.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.project_rating_guard() from public, anon, authenticated;
drop trigger if exists project_ratings_guard on public.project_ratings;
create trigger project_ratings_guard before insert or update on public.project_ratings
  for each row execute function public.project_rating_guard();
drop trigger if exists project_ratings_block_banned on public.project_ratings;
create trigger project_ratings_block_banned before insert or update on public.project_ratings
  for each row execute function public.block_banned_user();

drop policy if exists rating_read on public.project_ratings;
create policy rating_read on public.project_ratings for select using (true);
drop policy if exists rating_insert on public.project_ratings;
create policy rating_insert on public.project_ratings for insert to authenticated
  with check (user_id = (select auth.uid())
    and not exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists rating_update on public.project_ratings;
create policy rating_update on public.project_ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists rating_delete on public.project_ratings;
create policy rating_delete on public.project_ratings for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace view public.project_rating_stats with (security_invoker = true) as
  select project_id, round(avg(stars)::numeric, 2) as avg_stars, count(*)::int as ratings_count
  from public.project_ratings group by project_id;
grant select on public.project_rating_stats to anon, authenticated;

-- c) challenges
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title_ar text not null,
  title_en text,
  description_ar text not null default '',
  description_en text,
  level text not null default 'beginner',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  winner_entry_id uuid,
  check (ends_at > starts_at)
);
create table if not exists public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, project_id)
);
create index if not exists challenge_entries_challenge_idx on public.challenge_entries(challenge_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_winner_entry_fk') then
    alter table public.challenges add constraint challenges_winner_entry_fk
      foreign key (winner_entry_id) references public.challenge_entries(id) on delete set null;
  end if;
end $$;

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

drop policy if exists challenge_read on public.challenges;
create policy challenge_read on public.challenges for select using (true);
drop policy if exists challenge_admin_insert on public.challenges;
create policy challenge_admin_insert on public.challenges for insert to authenticated with check ((select public.is_admin()));
drop policy if exists challenge_admin_update on public.challenges;
create policy challenge_admin_update on public.challenges for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists challenge_admin_delete on public.challenges;
create policy challenge_admin_delete on public.challenges for delete to authenticated using ((select public.is_admin()));

drop policy if exists entry_read on public.challenge_entries;
create policy entry_read on public.challenge_entries for select using (true);
drop policy if exists entry_insert on public.challenge_entries;
create policy entry_insert on public.challenge_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.challenges c where c.id = challenge_id and now() between c.starts_at and c.ends_at)
  );
drop policy if exists entry_delete on public.challenge_entries;
create policy entry_delete on public.challenge_entries for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop trigger if exists challenge_entries_block_banned on public.challenge_entries;
create trigger challenge_entries_block_banned before insert on public.challenge_entries
  for each row execute function public.block_banned_user();

-- d) seed the 4 current challenges (slug guards against duplicates)
insert into public.challenges (slug, title_ar, title_en, description_ar, description_en, level, starts_at, ends_at) values
 ('sales-data-cleanup','تنظيف بيانات مبيعات','Clean up sales data',
  'خذ جدول مبيعات فوضوياً (بيانات افتراضية)، وثّق المشكلات والتعديلات، ثم ارفع الملف النظيف.',
  'Take a messy sales sheet (sample data), document the issues and fixes, then upload the clean file.','beginner', now(), now() + interval '30 days'),
 ('excel-invoice','تصميم فاتورة Excel','Design an Excel invoice',
  'صمّم فاتورة احترافية بصيغ حسابية للضريبة والإجمالي وقيم تجريبية.',
  'Design a professional invoice with formulas for tax and totals using sample values.','beginner', now(), now() + interval '30 days'),
 ('portfolio-page','بناء موقع تعريفي','Build a portfolio page',
  'أنشئ صفحة تعريفية تعرض مشروعاً من أعمالك بتصميم واضح.',
  'Create a landing page that presents one of your projects with a clear design.','intermediate', now(), now() + interval '30 days'),
 ('kpi-dashboard','لوحة مؤشرات مالية','Financial KPI dashboard',
  'ابنِ لوحة مؤشرات (Dashboard) تلخّص الإيرادات والمصروفات شهرياً.',
  'Build a dashboard summarising monthly revenue and expenses.','intermediate', now(), now() + interval '30 days')
on conflict (slug) do nothing;
