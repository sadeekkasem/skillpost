-- Rollback for 20261110073000_audit_security_hardening
-- Restores anon/authenticated grants recorded on 2026-11-10 before hardening.
-- Does not drop the privileged-column trigger; drop it separately if needed:
--   DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
--   DROP FUNCTION IF EXISTS public.protect_profile_privileged_columns();

GRANT SELECT ON TABLE islamic.lessons, islamic.sheikhs, islamic.site_content TO anon, authenticated;
GRANT SELECT ON TABLE islamic.staff_roles TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.ad_requests TO authenticated;
GRANT SELECT ON TABLE public.attachments TO anon;
GRANT SELECT, DELETE ON TABLE public.attachments TO authenticated;
GRANT ALL ON TABLE public.challenge_entries TO anon, authenticated;
GRANT ALL ON TABLE public.challenges TO anon, authenticated;
GRANT SELECT ON TABLE public.comments TO anon;
GRANT SELECT, DELETE ON TABLE public.comments TO authenticated;
GRANT SELECT, DELETE ON TABLE public.friendships TO authenticated;
GRANT SELECT ON TABLE public.likes TO anon;
GRANT SELECT, DELETE ON TABLE public.likes TO authenticated;
GRANT SELECT ON TABLE public.member_activity TO authenticated;
GRANT SELECT ON TABLE public.messages TO authenticated;
GRANT SELECT ON TABLE public.moderation_log TO authenticated;
GRANT SELECT, DELETE ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.post_comments TO anon;
GRANT SELECT, DELETE ON TABLE public.post_comments TO authenticated;
GRANT SELECT ON TABLE public.post_likes TO anon;
GRANT SELECT, DELETE ON TABLE public.post_likes TO authenticated;
GRANT SELECT ON TABLE public.posts TO anon;
GRANT SELECT, DELETE ON TABLE public.posts TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT ALL ON TABLE public.project_rating_stats TO anon, authenticated;
GRANT ALL ON TABLE public.project_ratings TO anon, authenticated;
GRANT SELECT ON TABLE public.projects TO anon;
GRANT SELECT, DELETE ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.published_lessons TO anon, authenticated;
GRANT ALL ON TABLE public.published_sheikhs TO anon, authenticated;
GRANT ALL ON TABLE public.published_site_content TO anon, authenticated;
GRANT SELECT ON TABLE public.published_lessons, public.published_sheikhs, public.published_site_content TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.reports TO authenticated;
GRANT SELECT ON TABLE public.video_comments TO anon;
GRANT SELECT, DELETE ON TABLE public.video_comments TO authenticated;
GRANT SELECT ON TABLE public.video_likes TO anon;
GRANT SELECT, DELETE ON TABLE public.video_likes TO authenticated;

GRANT EXECUTE ON FUNCTION public.islamic_accept_pending_invitations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_add_lesson(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_create_sheikh(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_accounts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_audit(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_site_content() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_list_workspace() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_page_views(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_set_lesson_status(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_set_sheikh_status(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_admin_upsert_site_content(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_invite_staff(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_record_page_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_revoke_invitation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_staff_workspace() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_update_lesson(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.islamic_update_sheikh_page(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION islamic.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION islamic.record_page_view(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
