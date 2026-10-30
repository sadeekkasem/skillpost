-- SkillPost: block phone numbers, emails, links and outside apps in chat (2026-10-30). Safe to re-run.
create or replace function public.message_has_contact(txt text)
returns boolean
language sql
immutable
as $$
  with n as (
    select translate(coalesce(txt, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789') as t
  )
  select
    regexp_replace(t, '[\s\-.()+/_]', '', 'g') ~ '\d{7,}'
    or t ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(\.|dot)\s*[a-z]{2,}'
    or t ~* '(https?://|www\.|wa\.me|t\.me|[a-z0-9-]+\.(com|net|org|fi|io|me|co|info|biz|app|dev|site|store|shop)([^a-z]|$))'
    or t ~* '(whats\s*app|واتس|telegram|تلغرام|تليغرام|تيليجرام|تلجرام|viber|فايبر|signal|سيغنال|gmail|hotmail|outlook|yahoo)'
  from n;
$$;

create or replace function public.messages_contact_filter()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.message_has_contact(new.body) then
    raise exception 'contact_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_contact_filter on public.messages;
create trigger messages_contact_filter
  before insert on public.messages
  for each row execute function public.messages_contact_filter();
