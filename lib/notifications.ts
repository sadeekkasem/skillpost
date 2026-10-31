import type { SupabaseClient } from "@supabase/supabase-js";
import type { DictKey, Lang } from "@/lib/i18n";

export type NotificationType =
  | "post_like" | "post_comment" | "project_like" | "project_comment"
  | "friend_request" | "friend_accept" | "message";

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
  actor?: { username: string | null; full_name: string | null; avatar_path: string | null } | null;
};

export const TEXT_KEY: Record<NotificationType, DictKey> = {
  post_like: "notif.post_like",
  post_comment: "notif.post_comment",
  project_like: "notif.project_like",
  project_comment: "notif.project_comment",
  friend_request: "notif.friend_request",
  friend_accept: "notif.friend_accept",
  message: "notif.message",
};

const SELECT = "*,actor:profiles!notifications_actor_id_fkey(username,full_name,avatar_path)";

/** True when the notifications table/feature is missing or not accessible: hide the UI silently. */
export function isUnavailable(error: { code?: string } | null | undefined): boolean {
  return !!error && ["42P01", "PGRST205", "PGRST200", "42501", "42703"].includes(error.code ?? "");
}

export async function fetchNotifications(db: SupabaseClient, uid: string, limit: number, before?: string) {
  let q = db.from("notifications").select(SELECT).eq("user_id", uid)
    .order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  return q;
}

export function fetchUnreadCount(db: SupabaseClient, uid: string) {
  return db.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", uid).is("read_at", null);
}

export function markRead(db: SupabaseClient, id: string) {
  return db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export function markAllRead(db: SupabaseClient, uid: string) {
  return db.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", uid).is("read_at", null);
}

export function avatarUrl(db: SupabaseClient, path: string | null | undefined): string {
  return path ? db.storage.from("avatars").getPublicUrl(path).data.publicUrl : "";
}

/** Where a notification leads. Messages open the chat widget instead of navigating. */
export function targetOf(n: NotificationRow): { href?: string; chatWith?: string } {
  if (n.type === "message" && n.actor_id) return { chatWith: n.actor_id };
  if (n.project_id) return { href: `/projects/${n.project_id}` };
  if (n.type === "friend_request" || n.type === "friend_accept") return { href: "/friends" };
  if (n.post_id) return { href: `/profile/${n.user_id}` };
  if (n.actor_id) return { href: `/profile/${n.actor_id}` };
  return { href: "/" };
}

export function relativeTime(value: string, lang: Lang): string {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  if (Number.isNaN(diff)) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / 2592000), "month");
}
