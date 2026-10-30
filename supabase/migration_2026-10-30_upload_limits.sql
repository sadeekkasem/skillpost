-- SkillPost: upload limits (2026-10-30). Safe to run more than once.

-- 1) Bucket size limits (images are compressed in the browser before upload)
update storage.buckets set file_size_limit = 2097152 where id = 'project-files';
update storage.buckets set file_size_limit = 1048576 where id = 'avatars';
update storage.buckets set file_size_limit = 1048576 where id = 'post-images';

-- 2) Excel/CSV quota per account (3 free; admin raises it after a paid extra)
alter table public.profiles add column if not exists excel_quota int not null default 3;
do $$ begin
  alter table public.profiles add constraint profiles_excel_quota_check check (excel_quota between 0 and 100);
exception when duplicate_object then null; end $$;
revoke update(excel_quota) on public.profiles from anon, authenticated;

create or replace function public.set_excel_quota(target uuid, quota int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.profiles set excel_quota = quota where id = target;
end;
$$;
revoke all on function public.set_excel_quota(uuid, int) from public, anon;
grant execute on function public.set_excel_quota(uuid, int) to authenticated;

create or replace function public.attachments_excel_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name ~* '\.(xlsx|csv)$' then
    perform pg_advisory_xact_lock(hashtext('excel_limit:' || new.owner_id::text));
    if (select count(*) from public.attachments a
        where a.owner_id = new.owner_id and a.name ~* '\.(xlsx|csv)$')
       >= coalesce((select p.excel_quota from public.profiles p where p.id = new.owner_id), 3) then
      raise exception 'excel_limit: Excel quota reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attachments_excel_limit on public.attachments;
create trigger attachments_excel_limit
  before insert on public.attachments
  for each row execute function public.attachments_excel_limit();

-- Block renaming a file into an Excel name to get around the limit
create or replace function public.attachments_keep_extension()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(substring(new.name from '\.([^.]+)$')) is distinct from lower(substring(old.name from '\.([^.]+)$')) then
    raise exception 'cannot change file extension' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists attachments_keep_extension on public.attachments;
create trigger attachments_keep_extension
  before update of name on public.attachments
  for each row execute function public.attachments_keep_extension();
