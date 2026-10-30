-- SkillPost: server-side file scan for project-files (2026-10-30). Safe to run more than once.
-- Requires public.is_admin() (migration_2026-10-29.sql). Pair with Edge Function "scan-file".
-- Rule: only the owner and admins can read an object in project-files until its
-- attachments row is scan_status = 'clean'. Only the service role (Edge Function) sets scan fields.

-- 1) Scan columns. Existing rows start as 'pending' and are scanned when the owner/admin opens the project.
alter table public.attachments add column if not exists scan_status text not null default 'pending';
alter table public.attachments add column if not exists scanned_at timestamptz;
alter table public.attachments add column if not exists scan_note text;
do $$ begin
  alter table public.attachments add constraint attachments_scan_status_check
    check (scan_status in ('pending','clean','rejected'));
exception when duplicate_object then null; end $$;
create index if not exists attachments_path_idx on public.attachments(path);

-- 2) Users cannot set scan fields (column-limited grants, same style as schema.sql)
revoke insert, update on public.attachments from anon, authenticated;
grant insert(project_id, owner_id, path, name) on public.attachments to authenticated;
grant update(name) on public.attachments to authenticated;

-- Belt and braces: non-service callers always get 'pending' and cannot change scan fields
create or replace function public.attachments_force_scan_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.scan_status := 'pending';
    new.scanned_at := null;
    new.scan_note := null;
  else
    new.scan_status := old.scan_status;
    new.scanned_at := old.scanned_at;
    new.scan_note := old.scan_note;
    new.path := old.path;
  end if;
  return new;
end;
$$;
drop trigger if exists attachments_force_scan_pending on public.attachments;
create trigger attachments_force_scan_pending
  before insert or update on public.attachments
  for each row execute function public.attachments_force_scan_pending();

-- 3) Storage read: owner folder or admin always; everyone else only for scanned-clean files
drop policy if exists file_read on storage.objects;
create policy file_read on storage.objects for select to authenticated using (
  bucket_id = 'project-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or exists (select 1 from public.attachments a where a.path = name and a.scan_status = 'clean')));

-- 4) Storage insert: same as before, plus no re-upload to a path that already has an
--    attachments row (stops "delete clean file, upload a different one at the same path").
drop policy if exists file_insert on storage.objects;
create policy file_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.projects p
              where p.id::text = (storage.foldername(name))[2] and p.user_id = (select auth.uid()))
  and not exists (select 1 from public.attachments a where a.path = name));
-- file_delete is unchanged. There is intentionally no UPDATE policy on project-files (no overwrite/upsert).
