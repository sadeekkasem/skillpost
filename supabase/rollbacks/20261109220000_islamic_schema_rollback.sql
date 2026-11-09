-- Rollback for 20261109220000_islamic_schema.sql
-- Drops the islamic schema and its public wrappers/views only. Does not touch auth, public app tables, or storage.

DROP VIEW IF EXISTS public.published_lessons;
DROP VIEW IF EXISTS public.published_sheikhs;

DROP FUNCTION IF EXISTS public.islamic_is_admin();
DROP FUNCTION IF EXISTS public.islamic_admin_create_sheikh(text, text, text);
DROP FUNCTION IF EXISTS public.islamic_admin_set_sheikh_status(uuid, text);
DROP FUNCTION IF EXISTS public.islamic_admin_set_lesson_status(uuid, text);
DROP FUNCTION IF EXISTS public.islamic_invite_staff(text, text, uuid);
DROP FUNCTION IF EXISTS public.islamic_revoke_invitation(uuid);
DROP FUNCTION IF EXISTS public.islamic_accept_pending_invitations();
DROP FUNCTION IF EXISTS public.islamic_update_sheikh_page(uuid, text, text);
DROP FUNCTION IF EXISTS public.islamic_add_lesson(uuid, text, text);
DROP FUNCTION IF EXISTS public.islamic_update_lesson(uuid, text, text);
DROP FUNCTION IF EXISTS public.islamic_admin_list_workspace();
DROP FUNCTION IF EXISTS public.islamic_staff_workspace();

DROP SCHEMA IF EXISTS islamic CASCADE;
