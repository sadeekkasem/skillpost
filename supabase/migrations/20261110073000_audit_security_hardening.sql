-- Audit hardening 2026-11-10: revoke leftover SkillPost API grants, protect
-- privileged profile columns, and pin search_path on three functions.
-- Does not drop tables, views, functions, or storage objects.
-- Does not expose the islamic schema.

-- Keep published_* readable; strip write privileges inherited from defaults.
REVOKE ALL ON TABLE public.published_sheikhs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.published_lessons FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.published_site_content FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.published_sheikhs TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.published_lessons TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.published_site_content TO anon, authenticated, service_role;

-- Legacy social-app tables/views are unused by the Islamic site.
REVOKE ALL ON TABLE public.ad_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.challenge_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.friendships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.likes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_activity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.moderation_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_likes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.posts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profile_view_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_rating_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_ratings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.video_comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.video_likes FROM PUBLIC, anon, authenticated;

-- Leftover SECURITY DEFINER / admin RPCs: remove API execute rights.
DO $$
DECLARE
  r record;
  names text[] := ARRAY[
    'admin_find_profiles',
    'admin_list_moderators',
    'admin_set_moderator',
    'admin_stats',
    'admin_tiers',
    'attachments_excel_limit',
    'can_message',
    'count_download',
    'diamond_members',
    'get_active_ads',
    'member_tier',
    'member_tiers',
    'mod_delete_content',
    'mod_delete_video_comment',
    'mod_resolve_report',
    'mod_suspend_user',
    'mod_unsuspend_user',
    'my_profile_stats',
    'my_tier_info',
    'record_profile_view',
    'search_content',
    'search_document',
    'set_diamond',
    'set_excel_quota',
    'set_friendship_updated_at',
    'set_pinned_project',
    'set_referrer',
    'set_user_banned',
    'touch_activity'
  ];
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.oid::regprocedure);
  END LOOP;
END
$$;

-- Helper functions used only inside leftover RLS policies: hide from anon.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_banned() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_suspended() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_banned() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_suspended() TO authenticated, service_role;

-- Islamic wrappers stay callable by signed-in staff; visitors only need page views.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'islamic\_%' ESCAPE '\'
      AND p.proname <> 'islamic_record_page_view'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.oid::regprocedure);
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION public.islamic_record_page_view(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION islamic.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION islamic.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION islamic.record_page_view(text) TO anon, authenticated, service_role;

-- Even if UPDATE on profiles is granted later, freeze privileged columns
-- unless the updater is a superuser-style role (including SECURITY DEFINER owners).
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  NEW.is_admin := OLD.is_admin;
  NEW.is_moderator := OLD.is_moderator;
  NEW.is_banned := OLD.is_banned;
  NEW.excel_quota := OLD.excel_quota;
  NEW.diamond_until := OLD.diamond_until;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  NEW.email_confirmed := OLD.email_confirmed;
  NEW.suspended_until := OLD.suspended_until;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (
  is_admin,
  is_moderator,
  is_banned,
  excel_quota,
  diamond_until,
  referral_code,
  referred_by,
  email_confirmed,
  suspended_until
) ON public.profiles FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.tier_excel_limit(text) SET search_path TO public;
ALTER FUNCTION public.message_has_contact(text) SET search_path TO public;
ALTER FUNCTION public.search_document(text) SET search_path TO public;

UPDATE islamic.site_content
SET value = 'القرآن الكريم كاملًا بنصّ موثّق مع تفسير الجلالين، وتلاوة اختيارية، وأذكار من حصن المسلم، ومواقيت الصلاة واتجاه القبلة. الزائر لا يحتاج حسابًا، ولا إعلانات في الموقع.',
    updated_at = now()
WHERE key = 'hero_lead';

NOTIFY pgrst, 'reload schema';
