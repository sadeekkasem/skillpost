-- Ensure recipients can mark their messages as read (idempotent).
-- App code alone cannot grant DB privileges: if the unread badge returns after
-- refresh, run this in the Supabase SQL editor.
-- تأكد أن المستلم يقدر يعلّم رسائله مقروءة. إذا رجعت الشارة بعد التحديث،
-- شغّل هذا الملف في محرر SQL في Supabase.
begin;

grant update(read_at) on public.messages to authenticated;

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

commit;
