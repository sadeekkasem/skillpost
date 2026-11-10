-- Drop leftover SkillPost social-app objects from public/storage/auth.
-- Preserves: islamic schema, public.islamic_* wrappers, published_* views,
-- storage bucket islamic-site and its policies, pg_trgm extension functions,
-- and auth.users rows.

-- 1. Stop the leftover nightly cleanup before dropping the function it calls.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE command ILIKE '%cleanup_unconfirmed_users%';

-- 2. Detach auth.users from public.profiles so staff magic-link login keeps working.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_referral ON auth.users;
DROP TRIGGER IF EXISTS sync_email_confirmed ON auth.users;

-- 3. This trigger runs on every storage.objects write, including islamic-site.
DROP TRIGGER IF EXISTS project_file_size_limit ON storage.objects;

-- 4. Legacy storage policies (keep islamic_site_*).
DROP POLICY IF EXISTS "avatar_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "avatar_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatar_read" ON storage.objects;
DROP POLICY IF EXISTS "avatar_select_own" ON storage.objects;
DROP POLICY IF EXISTS "avatar_update" ON storage.objects;
DROP POLICY IF EXISTS "file_delete" ON storage.objects;
DROP POLICY IF EXISTS "file_delete_moderator" ON storage.objects;
DROP POLICY IF EXISTS "file_insert" ON storage.objects;
DROP POLICY IF EXISTS "file_read" ON storage.objects;
DROP POLICY IF EXISTS "file_read_moderator_orphan" ON storage.objects;
DROP POLICY IF EXISTS "post_image_delete" ON storage.objects;
DROP POLICY IF EXISTS "post_image_delete_moderator" ON storage.objects;
DROP POLICY IF EXISTS "post_image_insert" ON storage.objects;
DROP POLICY IF EXISTS "post_image_read" ON storage.objects;

-- 5. Legacy view that reads project_ratings.
DROP VIEW IF EXISTS public.project_rating_stats;

-- 6. Legacy tables. CASCADE only removes leftovers that depend on these tables
-- (FKs, table policies/triggers). published_* and islamic.* do not depend on them.
DROP TABLE IF EXISTS
  public.challenge_entries,
  public.challenges,
  public.video_comments,
  public.video_likes,
  public.post_comments,
  public.post_likes,
  public.posts,
  public.comments,
  public.likes,
  public.project_ratings,
  public.attachments,
  public.notifications,
  public.messages,
  public.friendships,
  public.reports,
  public.ad_requests,
  public.moderation_log,
  public.member_activity,
  public.profile_view_log,
  public.projects,
  public.profiles
CASCADE;

-- 7. Legacy functions (not islamic_*, not pg_trgm extension helpers).
DROP FUNCTION IF EXISTS public.active_days(uid uuid);
DROP FUNCTION IF EXISTS public.admin_find_profiles(q text);
DROP FUNCTION IF EXISTS public.admin_list_moderators();
DROP FUNCTION IF EXISTS public.admin_set_moderator(target uuid, enabled boolean);
DROP FUNCTION IF EXISTS public.admin_stats();
DROP FUNCTION IF EXISTS public.admin_tiers(ids uuid[]);
DROP FUNCTION IF EXISTS public.apply_referral(uid uuid, code text);
DROP FUNCTION IF EXISTS public.attachments_excel_limit();
DROP FUNCTION IF EXISTS public.attachments_force_scan_pending();
DROP FUNCTION IF EXISTS public.attachments_keep_extension();
DROP FUNCTION IF EXISTS public.block_banned_user();
DROP FUNCTION IF EXISTS public.can_message(sender uuid, recipient uuid);
DROP FUNCTION IF EXISTS public.cleanup_unconfirmed_users();
DROP FUNCTION IF EXISTS public.count_download(att uuid);
DROP FUNCTION IF EXISTS public.create_profile();
DROP FUNCTION IF EXISTS public.diamond_members();
DROP FUNCTION IF EXISTS public.enforce_rate_limit();
DROP FUNCTION IF EXISTS public.excel_usage(uid uuid, tier text);
DROP FUNCTION IF EXISTS public.get_active_ads();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_banned();
DROP FUNCTION IF EXISTS public.is_moderator();
DROP FUNCTION IF EXISTS public.is_staff_user(uid uuid);
DROP FUNCTION IF EXISTS public.is_suspended();
DROP FUNCTION IF EXISTS public.member_tier(uid uuid);
DROP FUNCTION IF EXISTS public.member_tiers(ids uuid[]);
DROP FUNCTION IF EXISTS public.message_has_contact(txt text);
DROP FUNCTION IF EXISTS public.messages_before_insert();
DROP FUNCTION IF EXISTS public.messages_contact_filter();
DROP FUNCTION IF EXISTS public.mod_delete_content(target_type text, target_id uuid, reason text);
DROP FUNCTION IF EXISTS public.mod_delete_video_comment(comment_id uuid, reason text);
DROP FUNCTION IF EXISTS public.mod_require(p_reason text);
DROP FUNCTION IF EXISTS public.mod_resolve_report(report_id uuid, new_status text, reason text);
DROP FUNCTION IF EXISTS public.mod_suspend_user(target uuid, days integer, reason text);
DROP FUNCTION IF EXISTS public.mod_unsuspend_user(target uuid, reason text);
DROP FUNCTION IF EXISTS public.mod_write_log(p_action text, p_type text, p_id uuid, p_reason text);
DROP FUNCTION IF EXISTS public.my_profile_stats();
DROP FUNCTION IF EXISTS public.my_tier_info();
DROP FUNCTION IF EXISTS public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid, p_project uuid);
DROP FUNCTION IF EXISTS public.notify_friendship();
DROP FUNCTION IF EXISTS public.notify_post_comment();
DROP FUNCTION IF EXISTS public.notify_post_like();
DROP FUNCTION IF EXISTS public.notify_project_comment();
DROP FUNCTION IF EXISTS public.notify_project_like();
DROP FUNCTION IF EXISTS public.profiles_referral_code();
DROP FUNCTION IF EXISTS public.project_file_size_limit();
DROP FUNCTION IF EXISTS public.project_rating_guard();
DROP FUNCTION IF EXISTS public.protect_email_confirmed();
DROP FUNCTION IF EXISTS public.protect_profile_privileged_columns();
DROP FUNCTION IF EXISTS public.record_profile_view(target uuid);
DROP FUNCTION IF EXISTS public.referral_count(uid uuid);
DROP FUNCTION IF EXISTS public.search_content(p_tab text, p_term text, p_category text, p_specialty text, p_sort text, p_page integer, p_page_size integer);
DROP FUNCTION IF EXISTS public.search_document(value text);
DROP FUNCTION IF EXISTS public.set_diamond(target uuid, until date);
DROP FUNCTION IF EXISTS public.set_excel_quota(target uuid, quota integer);
DROP FUNCTION IF EXISTS public.set_friendship_updated_at();
DROP FUNCTION IF EXISTS public.set_pinned_project(pid uuid);
DROP FUNCTION IF EXISTS public.set_referrer(code text);
DROP FUNCTION IF EXISTS public.set_user_banned(target uuid, banned boolean);
DROP FUNCTION IF EXISTS public.signup_referral();
DROP FUNCTION IF EXISTS public.site_today();
DROP FUNCTION IF EXISTS public.sync_email_confirmed();
DROP FUNCTION IF EXISTS public.tier_excel_limit(tier text);
DROP FUNCTION IF EXISTS public.touch_activity();
DROP FUNCTION IF EXISTS public.touch_updated_at();

-- 8. Remove empty leftover buckets. project-files is left in place when it
-- still has objects (bytes could not be backed up via SQL).
DO $$
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.buckets b
   WHERE b.id IN ('avatars', 'post-images')
     AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = b.id);
END $$;

NOTIFY pgrst, 'reload schema';
