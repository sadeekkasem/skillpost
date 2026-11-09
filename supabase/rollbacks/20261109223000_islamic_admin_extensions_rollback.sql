-- Rollback for 20261109223000_islamic_admin_extensions.sql
-- Restores phase-3 publish rules (admin-only status, lessons insert as draft)
-- and drops phase-4 objects. Does not drop islamic.audit_log or other phase-3 tables.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS islamic_site_public_read ON storage.objects;
    DROP POLICY IF EXISTS islamic_site_admin_insert ON storage.objects;
    DROP POLICY IF EXISTS islamic_site_admin_update ON storage.objects;
    DELETE FROM storage.objects WHERE bucket_id = 'islamic-site';
    DELETE FROM storage.buckets WHERE id = 'islamic-site';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.islamic_admin_list_audit(int);
DROP FUNCTION IF EXISTS public.islamic_admin_list_accounts();
DROP FUNCTION IF EXISTS public.islamic_admin_list_site_content();
DROP FUNCTION IF EXISTS public.islamic_admin_upsert_site_content(text, text, boolean);
DROP FUNCTION IF EXISTS public.islamic_record_page_view(text);
DROP FUNCTION IF EXISTS public.islamic_admin_page_views(int);

DROP FUNCTION IF EXISTS islamic.admin_list_audit(int);
DROP FUNCTION IF EXISTS islamic.admin_list_accounts();
DROP FUNCTION IF EXISTS islamic.admin_list_site_content();
DROP FUNCTION IF EXISTS islamic.admin_upsert_site_content(text, text, boolean);
DROP FUNCTION IF EXISTS islamic.record_page_view(text);
DROP FUNCTION IF EXISTS islamic.admin_page_views(int);

DROP VIEW IF EXISTS public.published_site_content;
DROP TABLE IF EXISTS islamic.page_view_windows;
DROP TABLE IF EXISTS islamic.page_views;
DROP TABLE IF EXISTS islamic.site_content;

CREATE OR REPLACE FUNCTION islamic.admin_set_sheikh_status(p_sheikh_id uuid, p_status islamic.publish_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE islamic.sheikhs SET status = p_status, updated_at = now() WHERE id = p_sheikh_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  PERFORM islamic.write_audit('set_sheikh_status', 'sheikh', p_sheikh_id, jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION islamic.admin_set_lesson_status(p_lesson_id uuid, p_status islamic.publish_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE islamic.lessons SET status = p_status, updated_at = now() WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  PERFORM islamic.write_audit('set_lesson_status', 'lesson', p_lesson_id, jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION islamic.add_lesson(p_sheikh_id uuid, p_title text, p_video_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT islamic.can_edit_sheikh(p_sheikh_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_video_id !~ '^[A-Za-z0-9_-]{11}$' THEN
    RAISE EXCEPTION 'invalid video id';
  END IF;
  INSERT INTO islamic.lessons (sheikh_id, title, youtube_video_id, status, created_by)
  VALUES (p_sheikh_id, trim(p_title), p_video_id, 'draft', auth.uid())
  RETURNING id INTO v_id;
  PERFORM islamic.write_audit('add_lesson', 'lesson', v_id, jsonb_build_object('sheikh_id', p_sheikh_id));
  RETURN v_id;
END;
$$;
