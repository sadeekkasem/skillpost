import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostAuthor } from "@/lib/types";

export type VideoComment = {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: PostAuthor | null;
};

export type VideoReactions = {
  /** False when the tables are not available yet (migration not run). */
  available: boolean;
  likes: Record<string, string[]>;
  comments: Record<string, VideoComment[]>;
};

export const VIDEO_COMMENT_SELECT = "*,profiles!video_comments_user_id_fkey(id,username,full_name,avatar_path)";

export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /video_(likes|comments)/.test(error.message ?? "") && /schema cache|does not exist/i.test(error.message ?? "");
}

export async function loadVideoReactions(db: SupabaseClient, ids: string[]): Promise<VideoReactions> {
  const empty: VideoReactions = { available: true, likes: {}, comments: {} };
  if (!ids.length) return empty;
  try {
    const [likesRes, commentsRes] = await Promise.all([
      db.from("video_likes").select("video_id,user_id").in("video_id", ids),
      db.from("video_comments").select(VIDEO_COMMENT_SELECT).in("video_id", ids).order("created_at", { ascending: true }),
    ]);
    if (likesRes.error || commentsRes.error) {
      return { ...empty, available: false };
    }
    for (const row of likesRes.data ?? []) (empty.likes[row.video_id] ??= []).push(row.user_id);
    for (const row of (commentsRes.data ?? []) as unknown as VideoComment[]) (empty.comments[row.video_id] ??= []).push(row);
    return empty;
  } catch {
    return { ...empty, available: false };
  }
}
