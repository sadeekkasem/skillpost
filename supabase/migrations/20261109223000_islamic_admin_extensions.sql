-- Phase 4: admin extensions (audit read, accounts, site content, page views)
-- and direct publish for a sheikh and that sheikh's assistant.
-- Apply only after explicit approval. This file is not applied to production by this change.

-- ---------------------------------------------------------------------------
-- Direct publish: owners (sheikh or assistant) may set status on their own
-- page and lessons. Admin publish/hide is unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION islamic.admin_set_sheikh_status(p_sheikh_id uuid, p_status islamic.publish_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() AND NOT islamic.can_edit_sheikh(p_sheikh_id) THEN
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
DECLARE
  v_sheikh uuid;
BEGIN
  SELECT sheikh_id INTO v_sheikh FROM islamic.lessons WHERE id = p_lesson_id;
  IF v_sheikh IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF NOT islamic.is_admin() AND NOT islamic.can_edit_sheikh(v_sheikh) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE islamic.lessons SET status = p_status, updated_at = now() WHERE id = p_lesson_id;
  PERFORM islamic.write_audit('set_lesson_status', 'lesson', p_lesson_id, jsonb_build_object('status', p_status, 'sheikh_id', v_sheikh));
END;
$$;

-- New lessons go live immediately. Hide remains available to owner and admin.
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
  VALUES (p_sheikh_id, trim(p_title), p_video_id, 'published', auth.uid())
  RETURNING id INTO v_id;
  PERFORM islamic.write_audit('add_lesson', 'lesson', v_id, jsonb_build_object('sheikh_id', p_sheikh_id, 'status', 'published'));
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Site content (homepage texts + hero image URL)
-- Seeded with the current public homepage wording, copied verbatim.
-- ---------------------------------------------------------------------------
CREATE TABLE islamic.site_content (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  value text NOT NULL DEFAULT '' CHECK (char_length(value) <= 2000),
  published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO islamic.site_content (key, value, published) VALUES
  ('hero_eyebrow', 'قراءة وذكر، بخطوات مطمئنة', true),
  ('hero_title', E'مساحة هادئة.\nللقرآن والذكر.', true),
  ('hero_lead', 'القرآن الكريم كاملًا بنصّ موثّق مع تفسير الجلالين، وتلاوة اختيارية، وأذكار من حصن المسلم، ومواقيت الصلاة واتجاه القبلة — بلا حسابات ولا إعلانات.', true),
  ('hero_image_url', '/img/kaaba-800.webp', true),
  ('hero_image_alt', 'الكعبة والمسجد الحرام في مكة المكرمة عند الغسق', true),
  ('hero_caption_place', 'مكة المكرمة', true),
  ('hero_caption_title', 'الكعبة · المسجد الحرام', true),
  ('hero_caption_credit', 'تصوير Neo Evenger / Pexels', true);

-- Cookieless daily page-view counters. No IP, user-agent, or personal data.
CREATE TABLE islamic.page_views (
  day date NOT NULL,
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 200),
  views int NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, path)
);

CREATE TABLE islamic.page_view_windows (
  window_start timestamptz NOT NULL,
  path text NOT NULL,
  n int NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (window_start, path)
);

ALTER TABLE islamic.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.page_view_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_content_public_read ON islamic.site_content
  FOR SELECT TO anon, authenticated
  USING (published);

CREATE POLICY site_content_admin_read ON islamic.site_content
  FOR SELECT TO authenticated
  USING (islamic.is_admin());

CREATE VIEW public.published_site_content
WITH (security_invoker = true) AS
SELECT key, value
FROM islamic.site_content
WHERE published;

-- ---------------------------------------------------------------------------
-- Admin-only readers and writers
-- ---------------------------------------------------------------------------
CREATE FUNCTION islamic.admin_list_audit(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n int := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 300);
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x))
    FROM (
      SELECT a.id, a.actor_id, a.actor_email, a.action, a.entity_type, a.entity_id, a.meta, a.created_at
      FROM islamic.audit_log a
      ORDER BY a.created_at DESC
      LIMIT n
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION islamic.admin_list_accounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.role, x.email)
    FROM (
      SELECT
        ae.email,
        'admin'::text AS role,
        NULL::uuid AS sheikh_id,
        ae.created_at,
        u.last_sign_in_at,
        u.id AS user_id
      FROM islamic.admin_emails ae
      LEFT JOIN LATERAL (
        SELECT uu.id, uu.last_sign_in_at
        FROM auth.users uu
        WHERE lower(uu.email) = ae.email
        ORDER BY uu.last_sign_in_at DESC NULLS LAST
        LIMIT 1
      ) u ON true
      UNION ALL
      SELECT
        lower(u.email) AS email,
        sr.role::text,
        sr.sheikh_id,
        sr.created_at,
        u.last_sign_in_at,
        sr.user_id
      FROM islamic.staff_roles sr
      JOIN auth.users u ON u.id = sr.user_id
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION islamic.admin_list_site_content()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'key', c.key, 'value', c.value, 'published', c.published, 'updated_at', c.updated_at
    ) ORDER BY c.key)
    FROM islamic.site_content c
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION islamic.admin_upsert_site_content(p_key text, p_value text, p_published boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := trim(p_key);
  v_value text := COALESCE(p_value, '');
  allowed text[] := ARRAY[
    'hero_eyebrow', 'hero_title', 'hero_lead', 'hero_image_url', 'hero_image_alt',
    'hero_caption_place', 'hero_caption_title', 'hero_caption_credit'
  ];
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_key = ANY (allowed)) THEN
    RAISE EXCEPTION 'invalid key';
  END IF;
  IF char_length(v_value) > 2000 THEN
    RAISE EXCEPTION 'value too long';
  END IF;
  IF v_key = 'hero_image_url' AND v_value !~ '^(/img/[A-Za-z0-9._-]+|/hero-image)$' THEN
    RAISE EXCEPTION 'invalid image url';
  END IF;
  INSERT INTO islamic.site_content (key, value, published, updated_at, updated_by)
  VALUES (v_key, v_value, COALESCE(p_published, true), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        published = EXCLUDED.published,
        updated_at = now(),
        updated_by = auth.uid();
  PERFORM islamic.write_audit('upsert_site_content', 'site_content', NULL, jsonb_build_object('key', v_key, 'published', COALESCE(p_published, true)));
END;
$$;

CREATE FUNCTION islamic.record_page_view(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_path text;
  v_day date := (timezone('utc', now()))::date;
  v_window timestamptz := date_trunc('minute', timezone('utc', now()));
  v_n int;
BEGIN
  v_path := left(split_part(COALESCE(p_path, ''), '?', 1), 200);
  IF v_path IS NULL OR v_path !~ '^/[A-Za-z0-9/_-]*$' THEN
    RETURN;
  END IF;
  IF v_path <> '/' THEN
    v_path := regexp_replace(v_path, '/+$', '');
  END IF;

  DELETE FROM islamic.page_view_windows WHERE window_start < timezone('utc', now()) - interval '2 hours';

  INSERT INTO islamic.page_view_windows (window_start, path, n)
  VALUES (v_window, v_path, 1)
  ON CONFLICT (window_start, path) DO UPDATE
    SET n = islamic.page_view_windows.n + 1
  RETURNING n INTO v_n;

  IF v_n > 90 THEN
    RETURN;
  END IF;

  INSERT INTO islamic.page_views (day, path, views)
  VALUES (v_day, v_path, 1)
  ON CONFLICT (day, path) DO UPDATE
    SET views = islamic.page_views.views + 1;
END;
$$;

CREATE FUNCTION islamic.admin_page_views(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d int := LEAST(GREATEST(COALESCE(p_days, 14), 1), 60);
  since date := (timezone('utc', now()))::date - (d - 1);
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'source', 'counters',
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', x.day, 'views', x.views) ORDER BY x.day)
      FROM (
        SELECT day, SUM(views)::int AS views
        FROM islamic.page_views
        WHERE day >= since
        GROUP BY day
      ) x
    ), '[]'::jsonb),
    'paths', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', x.path, 'views', x.views) ORDER BY x.views DESC, x.path)
      FROM (
        SELECT path, SUM(views)::int AS views
        FROM islamic.page_views
        WHERE day >= since
        GROUP BY path
        ORDER BY SUM(views) DESC, path
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for the hero image (skipped on local Postgres without storage)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('islamic-site', 'islamic-site', true, 524288, ARRAY['image/webp'])
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'islamic_site_public_read'
    ) THEN
      CREATE POLICY islamic_site_public_read ON storage.objects
        FOR SELECT TO anon, authenticated
        USING (bucket_id = 'islamic-site');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'islamic_site_admin_insert'
    ) THEN
      CREATE POLICY islamic_site_admin_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'islamic-site' AND islamic.is_admin());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'islamic_site_admin_update'
    ) THEN
      CREATE POLICY islamic_site_admin_update ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = 'islamic-site' AND islamic.is_admin())
        WITH CHECK (bucket_id = 'islamic-site' AND islamic.is_admin());
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Grants and public wrappers
-- ---------------------------------------------------------------------------
GRANT SELECT ON islamic.site_content TO anon, authenticated;
GRANT SELECT ON public.published_site_content TO anon, authenticated, service_role;

CREATE FUNCTION public.islamic_admin_list_audit(p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_list_audit(p_limit) $$;

CREATE FUNCTION public.islamic_admin_list_accounts()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_list_accounts() $$;

CREATE FUNCTION public.islamic_admin_list_site_content()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_list_site_content() $$;

CREATE FUNCTION public.islamic_admin_upsert_site_content(p_key text, p_value text, p_published boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_upsert_site_content(p_key, p_value, p_published) $$;

CREATE FUNCTION public.islamic_record_page_view(p_path text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.record_page_view(p_path) $$;

CREATE FUNCTION public.islamic_admin_page_views(p_days int DEFAULT 14)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_page_views(p_days) $$;

REVOKE ALL ON FUNCTION islamic.admin_list_audit(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_list_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_list_site_content() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_upsert_site_content(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.record_page_view(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_page_views(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION islamic.admin_list_audit(int) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_list_site_content() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_upsert_site_content(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.record_page_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_page_views(int) TO authenticated;

REVOKE ALL ON FUNCTION public.islamic_admin_list_audit(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_list_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_list_site_content() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_upsert_site_content(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_record_page_view(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_page_views(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.islamic_admin_list_audit(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_site_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_upsert_site_content(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_record_page_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_page_views(int) TO authenticated;
