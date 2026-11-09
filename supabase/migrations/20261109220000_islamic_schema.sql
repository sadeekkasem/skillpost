-- Phase 3: islamic schema for staff, sheikhs, invitations, and lessons.
-- Apply only after explicit approval. This file is not applied to production by this change.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA islamic;

CREATE TYPE islamic.staff_role AS ENUM ('admin', 'sheikh', 'student');
CREATE TYPE islamic.publish_status AS ENUM ('draft', 'published', 'hidden');

CREATE TABLE islamic.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_emails_lowercase CHECK (email = lower(email))
);

INSERT INTO islamic.admin_emails (email) VALUES ('sadeekkasem@gmail.com');

CREATE TABLE islamic.sheikhs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9\u0600-\u06FF]+(-[a-z0-9\u0600-\u06FF]+)*$'),
  youtube_channel_url text,
  status islamic.publish_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE islamic.sheikh_contacts (
  sheikh_id uuid PRIMARY KEY REFERENCES islamic.sheikhs(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE islamic.staff_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role islamic.staff_role NOT NULL,
  sheikh_id uuid REFERENCES islamic.sheikhs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_roles_sheikh_required CHECK (
    (role = 'admin' AND sheikh_id IS NULL)
    OR (role IN ('sheikh', 'student') AND sheikh_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX staff_roles_one_sheikh ON islamic.staff_roles (sheikh_id) WHERE role = 'sheikh';
CREATE UNIQUE INDEX staff_roles_one_student ON islamic.staff_roles (sheikh_id) WHERE role = 'student';

CREATE TABLE islamic.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role islamic.staff_role NOT NULL CHECK (role IN ('sheikh', 'student')),
  sheikh_id uuid NOT NULL REFERENCES islamic.sheikhs(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX invitations_one_pending_email
  ON islamic.invitations (email)
  WHERE revoked_at IS NULL AND accepted_at IS NULL;

CREATE UNIQUE INDEX invitations_one_pending_student
  ON islamic.invitations (sheikh_id)
  WHERE role = 'student' AND revoked_at IS NULL AND accepted_at IS NULL;

CREATE TABLE islamic.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheikh_id uuid NOT NULL REFERENCES islamic.sheikhs(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  youtube_video_id text NOT NULL CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  status islamic.publish_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX lessons_sheikh_idx ON islamic.lessons (sheikh_id, status);

CREATE TABLE islamic.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- JWT helpers. Confirmation is taken from the JWT when present, otherwise auth.users.
CREATE FUNCTION islamic.jwt_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

CREATE FUNCTION islamic.email_is_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(NULLIF(auth.jwt() ->> 'email_confirmed_at', '') IS NOT NULL, false)
    OR COALESCE(auth.jwt() ->> 'email_verified', '') IN ('true', 't', 'yes')
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.email_confirmed_at IS NOT NULL
        AND lower(u.email) = islamic.jwt_email()
        AND islamic.jwt_email() <> ''
    );
$$;

CREATE FUNCTION islamic.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT islamic.email_is_confirmed()
    AND islamic.jwt_email() <> ''
    AND EXISTS (
      SELECT 1
      FROM islamic.admin_emails ae
      WHERE ae.email = islamic.jwt_email()
    );
$$;

CREATE FUNCTION islamic.can_edit_sheikh(p_sheikh_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT islamic.is_admin()
    OR EXISTS (
      SELECT 1
      FROM islamic.staff_roles sr
      WHERE sr.user_id = auth.uid()
        AND sr.sheikh_id = p_sheikh_id
        AND sr.role IN ('sheikh', 'student')
    );
$$;

CREATE FUNCTION islamic.slugify(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  s text;
BEGIN
  s := lower(trim(p_name));
  s := regexp_replace(s, '[^\w\u0600-\u06FF]+', '-', 'g');
  s := trim(both '-' from s);
  IF s IS NULL OR s = '' THEN
    s := 'page';
  END IF;
  RETURN left(s, 80);
END;
$$;

CREATE FUNCTION islamic.write_audit(p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO islamic.audit_log (actor_id, actor_email, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), NULLIF(islamic.jwt_email(), ''), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb));
END;
$$;

CREATE FUNCTION islamic.unique_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base text := islamic.slugify(p_name);
  candidate text := base;
  n int := 2;
BEGIN
  WHILE EXISTS (SELECT 1 FROM islamic.sheikhs s WHERE s.slug = candidate) LOOP
    candidate := left(base, 70) || '-' || n::text;
    n := n + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE FUNCTION islamic.admin_create_sheikh(p_name text, p_email text, p_channel_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_channel text := nullif(trim(p_channel_url), '');
  v_inv uuid;
  v_raw text;
  v_hash text;
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  INSERT INTO islamic.sheikhs (name, slug, youtube_channel_url, status, created_by)
  VALUES (trim(p_name), islamic.unique_slug(p_name), v_channel, 'draft', auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO islamic.sheikh_contacts (sheikh_id, email) VALUES (v_id, v_email);
  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_raw, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO islamic.invitations (email, role, sheikh_id, token_hash, expires_at, created_by)
  VALUES (v_email, 'sheikh', v_id, v_hash, now() + interval '7 days', auth.uid())
  RETURNING id INTO v_inv;
  PERFORM islamic.write_audit('create_sheikh', 'sheikh', v_id, jsonb_build_object('invitation_id', v_inv));
  RETURN jsonb_build_object('sheikh_id', v_id, 'invitation_id', v_inv, 'slug', (SELECT slug FROM islamic.sheikhs WHERE id = v_id));
END;
$$;

CREATE FUNCTION islamic.admin_set_sheikh_status(p_sheikh_id uuid, p_status islamic.publish_status)
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

CREATE FUNCTION islamic.admin_set_lesson_status(p_lesson_id uuid, p_status islamic.publish_status)
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

CREATE FUNCTION islamic.invite_staff(p_email text, p_role islamic.staff_role, p_sheikh_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_inv uuid;
  v_raw text;
  v_hash text;
  v_is_sheikh boolean;
BEGIN
  IF p_role NOT IN ('sheikh', 'student') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  v_is_sheikh := EXISTS (
    SELECT 1 FROM islamic.staff_roles sr
    WHERE sr.user_id = auth.uid() AND sr.role = 'sheikh' AND sr.sheikh_id = p_sheikh_id
  );
  IF NOT islamic.is_admin() THEN
    IF NOT (p_role = 'student' AND v_is_sheikh) THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_role = 'student' AND (
    EXISTS (SELECT 1 FROM islamic.staff_roles sr WHERE sr.sheikh_id = p_sheikh_id AND sr.role = 'student')
    OR EXISTS (
      SELECT 1 FROM islamic.invitations i
      WHERE i.sheikh_id = p_sheikh_id AND i.role = 'student' AND i.revoked_at IS NULL AND i.accepted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'student already present';
  END IF;
  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_raw, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO islamic.invitations (email, role, sheikh_id, token_hash, expires_at, created_by)
  VALUES (v_email, p_role, p_sheikh_id, v_hash, now() + interval '7 days', auth.uid())
  RETURNING id INTO v_inv;
  PERFORM islamic.write_audit('invite', 'invitation', v_inv, jsonb_build_object('role', p_role, 'sheikh_id', p_sheikh_id));
  RETURN jsonb_build_object('invitation_id', v_inv);
END;
$$;

CREATE FUNCTION islamic.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v islamic.invitations%ROWTYPE;
  v_is_sheikh boolean;
BEGIN
  SELECT * INTO v FROM islamic.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  v_is_sheikh := EXISTS (
    SELECT 1 FROM islamic.staff_roles sr
    WHERE sr.user_id = auth.uid() AND sr.role = 'sheikh' AND sr.sheikh_id = v.sheikh_id
  );
  IF NOT islamic.is_admin() AND NOT v_is_sheikh THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF v.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already accepted';
  END IF;
  UPDATE islamic.invitations SET revoked_at = now() WHERE id = p_invitation_id AND revoked_at IS NULL;
  PERFORM islamic.write_audit('revoke', 'invitation', p_invitation_id, '{}'::jsonb);
END;
$$;

CREATE FUNCTION islamic.accept_pending_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r islamic.invitations%ROWTYPE;
  n int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT islamic.email_is_confirmed() OR islamic.jwt_email() = '' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  FOR r IN
    SELECT * FROM islamic.invitations
    WHERE email = islamic.jwt_email()
      AND revoked_at IS NULL
      AND accepted_at IS NULL
      AND expires_at > now()
  LOOP
    INSERT INTO islamic.staff_roles (user_id, role, sheikh_id)
    VALUES (auth.uid(), r.role, r.sheikh_id)
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role, sheikh_id = EXCLUDED.sheikh_id;
    UPDATE islamic.invitations SET accepted_at = now() WHERE id = r.id;
    n := n + 1;
    PERFORM islamic.write_audit('accept', 'invitation', r.id, jsonb_build_object('role', r.role));
  END LOOP;
  RETURN jsonb_build_object('accepted', n);
END;
$$;

CREATE FUNCTION islamic.update_sheikh_page(p_sheikh_id uuid, p_name text, p_channel_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF islamic.is_admin() OR NOT islamic.can_edit_sheikh(p_sheikh_id) THEN
    -- admin may also edit content; sheikh/student may edit their page
    IF NOT islamic.can_edit_sheikh(p_sheikh_id) THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF char_length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  UPDATE islamic.sheikhs
  SET name = trim(p_name),
      youtube_channel_url = nullif(trim(p_channel_url), ''),
      updated_at = now()
  WHERE id = p_sheikh_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  PERFORM islamic.write_audit('update_page', 'sheikh', p_sheikh_id, '{}'::jsonb);
END;
$$;

CREATE FUNCTION islamic.add_lesson(p_sheikh_id uuid, p_title text, p_video_id text)
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

CREATE FUNCTION islamic.update_lesson(p_lesson_id uuid, p_title text, p_video_id text)
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
  IF NOT islamic.can_edit_sheikh(v_sheikh) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_video_id !~ '^[A-Za-z0-9_-]{11}$' THEN
    RAISE EXCEPTION 'invalid video id';
  END IF;
  UPDATE islamic.lessons
  SET title = trim(p_title), youtube_video_id = p_video_id, updated_at = now()
  WHERE id = p_lesson_id;
  PERFORM islamic.write_audit('update_lesson', 'lesson', p_lesson_id, '{}'::jsonb);
END;
$$;

CREATE FUNCTION islamic.admin_list_workspace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT islamic.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'sheikhs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug,
        'youtube_channel_url', s.youtube_channel_url, 'status', s.status,
        'email', c.email, 'updated_at', s.updated_at
      ) ORDER BY s.created_at)
      FROM islamic.sheikhs s
      LEFT JOIN islamic.sheikh_contacts c ON c.sheikh_id = s.id
    ), '[]'::jsonb),
    'lessons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'sheikh_id', l.sheikh_id, 'title', l.title,
        'youtube_video_id', l.youtube_video_id, 'status', l.status
      ) ORDER BY l.created_at)
      FROM islamic.lessons l
    ), '[]'::jsonb),
    'invitations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'role', i.role, 'sheikh_id', i.sheikh_id,
        'expires_at', i.expires_at, 'revoked_at', i.revoked_at, 'accepted_at', i.accepted_at
      ) ORDER BY i.created_at)
      FROM islamic.invitations i
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION islamic.staff_workspace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role islamic.staff_role;
  v_sheikh uuid;
BEGIN
  IF islamic.is_admin() THEN
    RETURN islamic.admin_list_workspace() || jsonb_build_object('role', 'admin');
  END IF;
  SELECT sr.role, sr.sheikh_id INTO v_role, v_sheikh
  FROM islamic.staff_roles sr
  WHERE sr.user_id = auth.uid();
  IF v_sheikh IS NULL THEN
    RETURN jsonb_build_object('role', null);
  END IF;
  RETURN jsonb_build_object(
    'role', v_role,
    'sheikh', (
      SELECT jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug,
        'youtube_channel_url', s.youtube_channel_url, 'status', s.status
      ) FROM islamic.sheikhs s WHERE s.id = v_sheikh
    ),
    'lessons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'sheikh_id', l.sheikh_id, 'title', l.title,
        'youtube_video_id', l.youtube_video_id, 'status', l.status
      ) ORDER BY l.created_at)
      FROM islamic.lessons l WHERE l.sheikh_id = v_sheikh
    ), '[]'::jsonb),
    'invitations', CASE WHEN v_role = 'sheikh' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'role', i.role, 'sheikh_id', i.sheikh_id,
        'expires_at', i.expires_at, 'revoked_at', i.revoked_at, 'accepted_at', i.accepted_at
      ) ORDER BY i.created_at)
      FROM islamic.invitations i
      WHERE i.sheikh_id = v_sheikh AND i.role = 'student'
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

-- Public read views (security invoker so islamic RLS applies).
CREATE VIEW public.published_sheikhs
WITH (security_invoker = true) AS
SELECT id, name, slug, youtube_channel_url, status, created_at
FROM islamic.sheikhs
WHERE status = 'published';

CREATE VIEW public.published_lessons
WITH (security_invoker = true) AS
SELECT id, sheikh_id, title, youtube_video_id, status, created_at
FROM islamic.lessons
WHERE status = 'published';

-- Invoker wrappers so PostgREST (public schema) can call islamic functions
-- without exposing the islamic schema in API settings.
CREATE FUNCTION public.islamic_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.is_admin() $$;

CREATE FUNCTION public.islamic_admin_create_sheikh(p_name text, p_email text, p_channel_url text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_create_sheikh(p_name, p_email, p_channel_url) $$;

CREATE FUNCTION public.islamic_admin_set_sheikh_status(p_sheikh_id uuid, p_status text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_set_sheikh_status(p_sheikh_id, p_status::islamic.publish_status) $$;

CREATE FUNCTION public.islamic_admin_set_lesson_status(p_lesson_id uuid, p_status text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_set_lesson_status(p_lesson_id, p_status::islamic.publish_status) $$;

CREATE FUNCTION public.islamic_invite_staff(p_email text, p_role text, p_sheikh_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.invite_staff(p_email, p_role::islamic.staff_role, p_sheikh_id) $$;

CREATE FUNCTION public.islamic_revoke_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.revoke_invitation(p_invitation_id) $$;

CREATE FUNCTION public.islamic_accept_pending_invitations()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.accept_pending_invitations() $$;

CREATE FUNCTION public.islamic_update_sheikh_page(p_sheikh_id uuid, p_name text, p_channel_url text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.update_sheikh_page(p_sheikh_id, p_name, p_channel_url) $$;

CREATE FUNCTION public.islamic_add_lesson(p_sheikh_id uuid, p_title text, p_video_id text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.add_lesson(p_sheikh_id, p_title, p_video_id) $$;

CREATE FUNCTION public.islamic_update_lesson(p_lesson_id uuid, p_title text, p_video_id text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.update_lesson(p_lesson_id, p_title, p_video_id) $$;

CREATE FUNCTION public.islamic_admin_list_workspace()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.admin_list_workspace() $$;

CREATE FUNCTION public.islamic_staff_workspace()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT islamic.staff_workspace() $$;

-- RLS
ALTER TABLE islamic.admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.sheikhs ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.sheikh_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE islamic.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sheikhs_public_read ON islamic.sheikhs
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY sheikhs_staff_read ON islamic.sheikhs
  FOR SELECT TO authenticated
  USING (islamic.is_admin() OR islamic.can_edit_sheikh(id));

CREATE POLICY sheikhs_staff_update ON islamic.sheikhs
  FOR UPDATE TO authenticated
  USING (islamic.can_edit_sheikh(id) AND NOT islamic.is_admin())
  WITH CHECK (islamic.can_edit_sheikh(id) AND NOT islamic.is_admin());

CREATE POLICY lessons_public_read ON islamic.lessons
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (SELECT 1 FROM islamic.sheikhs s WHERE s.id = sheikh_id AND s.status = 'published')
  );

CREATE POLICY lessons_staff_read ON islamic.lessons
  FOR SELECT TO authenticated
  USING (islamic.is_admin() OR islamic.can_edit_sheikh(sheikh_id));

CREATE POLICY lessons_staff_insert ON islamic.lessons
  FOR INSERT TO authenticated
  WITH CHECK (islamic.can_edit_sheikh(sheikh_id) AND NOT islamic.is_admin());

CREATE POLICY lessons_staff_update ON islamic.lessons
  FOR UPDATE TO authenticated
  USING (islamic.can_edit_sheikh(sheikh_id) AND NOT islamic.is_admin())
  WITH CHECK (islamic.can_edit_sheikh(sheikh_id) AND NOT islamic.is_admin());

CREATE POLICY staff_roles_self_read ON islamic.staff_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR islamic.is_admin());

-- No direct policies on contacts, invitations, admin_emails, audit_log:
-- those are function-only (no GRANT to anon/authenticated).

GRANT USAGE ON SCHEMA islamic TO anon, authenticated, service_role;

GRANT SELECT ON islamic.sheikhs TO anon, authenticated;
GRANT SELECT ON islamic.lessons TO anon, authenticated;
GRANT SELECT ON islamic.staff_roles TO authenticated;

GRANT UPDATE (name, youtube_channel_url, updated_at) ON islamic.sheikhs TO authenticated;
GRANT INSERT (id, sheikh_id, title, youtube_video_id, created_at, updated_at, created_by) ON islamic.lessons TO authenticated;
GRANT UPDATE (title, youtube_video_id, updated_at) ON islamic.lessons TO authenticated;

GRANT SELECT ON public.published_sheikhs TO anon, authenticated, service_role;
GRANT SELECT ON public.published_lessons TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION islamic.jwt_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.email_is_confirmed() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.can_edit_sheikh(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_create_sheikh(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_set_sheikh_status(uuid, islamic.publish_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_set_lesson_status(uuid, islamic.publish_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.invite_staff(text, islamic.staff_role, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.revoke_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.accept_pending_invitations() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.update_sheikh_page(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.add_lesson(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.update_lesson(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.admin_list_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.staff_workspace() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION islamic.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION islamic.can_edit_sheikh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.jwt_email() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.email_is_confirmed() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_create_sheikh(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_set_sheikh_status(uuid, islamic.publish_status) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_set_lesson_status(uuid, islamic.publish_status) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.invite_staff(text, islamic.staff_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.accept_pending_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.update_sheikh_page(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.add_lesson(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.update_lesson(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.admin_list_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION islamic.staff_workspace() TO authenticated;

REVOKE ALL ON FUNCTION public.islamic_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_create_sheikh(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_set_sheikh_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_set_lesson_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_invite_staff(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_revoke_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_accept_pending_invitations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_update_sheikh_page(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_add_lesson(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_update_lesson(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_admin_list_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.islamic_staff_workspace() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.islamic_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_create_sheikh(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_set_sheikh_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_set_lesson_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_invite_staff(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_accept_pending_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_update_sheikh_page(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_add_lesson(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_update_lesson(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_staff_workspace() TO authenticated;

REVOKE ALL ON FUNCTION islamic.write_audit(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION islamic.unique_slug(text) FROM PUBLIC;
