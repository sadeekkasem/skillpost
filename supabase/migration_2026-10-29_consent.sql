-- Consent 2026-10-29: terms, age (18+), marketing opt-in. Idempotent, non-destructive.
begin;

alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists marketing_opt_in_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists age_confirmed_at timestamptz;

-- Users may change only their marketing choice (terms/age timestamps are set by the signup trigger).
grant update(marketing_opt_in, marketing_opt_in_at) on public.profiles to authenticated;

-- Signup trigger reads consent from auth signUp options.data (raw_user_meta_data).
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare
 meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
 opt_in boolean := coalesce(meta->>'marketing_opt_in', '') = 'true';
begin
 insert into public.profiles(id, username, full_name, terms_accepted_at, age_confirmed_at, marketing_opt_in, marketing_opt_in_at)
 values(
  new.id,
  'user_'||replace(new.id::text,'-',''),
  'عضو جديد',
  case when coalesce(meta->>'terms_accepted', '') = 'true' then now() end,
  case when coalesce(meta->>'age_confirmed', '') = 'true' then now() end,
  opt_in,
  case when opt_in then now() end
 );
 return new;
end; $$;
revoke all on function public.create_profile() from public, anon, authenticated;

commit;