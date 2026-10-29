-- Messages between friends (idempotent, non-destructive)
begin;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);
create index if not exists messages_recipient_idx on public.messages(recipient_id, read_at, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert(sender_id, recipient_id, body) on public.messages to authenticated;
grant update(read_at) on public.messages to authenticated;

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists messages_insert_friends on public.messages;
create policy messages_insert_friends on public.messages for insert to authenticated
  with check (
    messages.sender_id = (select auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = messages.sender_id and f.addressee_id = messages.recipient_id)
          or (f.requester_id = messages.recipient_id and f.addressee_id = messages.sender_id))
    )
  );

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Anti-spam: max 20 messages per minute per sender
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  new.read_at := null;
  return new;
end; $$;
revoke all on function public.messages_before_insert() from public, anon, authenticated;
drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute procedure public.messages_before_insert();

-- Realtime delivery
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

commit;
