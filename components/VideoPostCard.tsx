"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLanguage } from "@/components/LanguageProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import TierBadge from "./TierBadge";
import type { ChannelVideo } from "@/lib/youtube/feed";
import { isMissingTable, VIDEO_COMMENT_SELECT, type VideoComment } from "@/lib/youtube/reactions";

type Props = {
  video: ChannelVideo;
  db?: SupabaseClient | null;
  viewerId?: string;
  isAdmin?: boolean;
  /** False when likes/comments are not available (counts are hidden). */
  available?: boolean;
  initialLikes?: string[];
  initialComments?: VideoComment[];
};

export default function VideoPostCard({
  video,
  db = null,
  viewerId = "",
  isAdmin = false,
  available = true,
  initialLikes = [],
  initialComments = [],
}: Props) {
  const { t, lang } = useLanguage();
  const [likes, setLikes] = useState<string[]>(initialLikes);
  const [comments, setComments] = useState<VideoComment[]>(initialComments);
  const [enabled, setEnabled] = useState(available && Boolean(db));
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const fmt = (value: string, withTime: boolean) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(lang, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  };
  const date = fmt(video.published, false);
  const liked = Boolean(viewerId && likes.includes(viewerId));

  async function run(action: (client: SupabaseClient) => Promise<void>) {
    if (!db || !enabled) {
      setMessage(t("video.reactionsUnavailable"));
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action(db);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      if (isMissingTable(e)) {
        setEnabled(false);
        setMessage(t("video.reactionsUnavailable"));
      } else {
        setMessage(e?.message || t("video.error"));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function toggleLike() {
    if (!enabled) return setMessage(t("video.reactionsUnavailable"));
    if (!viewerId) return setMessage(t("video.signInToLike"));
    void run(async (c) => {
      if (liked) {
        const { error } = await c.from("video_likes").delete().eq("video_id", video.id).eq("user_id", viewerId);
        if (error) throw error;
        setLikes((cur) => cur.filter((id) => id !== viewerId));
      } else {
        const { error } = await c.from("video_likes").insert({ video_id: video.id, user_id: viewerId });
        if (error) throw error;
        setLikes((cur) => [...cur, viewerId]);
      }
    });
  }

  function toggleComments() {
    if (!enabled) return setMessage(t("video.reactionsUnavailable"));
    setShowComments((v) => !v);
  }

  function addComment(event: React.FormEvent) {
    event.preventDefault();
    const text = commentText.trim();
    if (!viewerId || !text) return;
    void run(async (c) => {
      const { data, error } = await c
        .from("video_comments")
        .insert({ video_id: video.id, user_id: viewerId, body: text })
        .select(VIDEO_COMMENT_SELECT)
        .single();
      if (error) throw error;
      setComments((cur) => [...cur, data as unknown as VideoComment]);
      setCommentText("");
    });
  }

  function deleteComment(id: string) {
    if (!window.confirm(t("video.deleteConfirm"))) return;
    void run(async (c) => {
      const { error } = await c.from("video_comments").delete().eq("id", id);
      if (error) throw error;
      setComments((cur) => cur.filter((x) => x.id !== id));
    });
  }

  return (
    <article className="card video-post" style={{ marginBottom: "16px" }}>
      <header className="post-head">
        <div className="post-head-main">
          <div className="video-post-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 32 32">
              <path d="M16 6l2.6 6.4L25 15l-6.4 2.6L16 24l-2.6-6.4L7 15l6.4-2.6z" fill="#ffffff" />
            </svg>
          </div>
          <div className="post-head-info">
            <div className="post-head-name-row">
              {video.channel && !video.channel.isOwn ? (
                <a className="post-head-name" dir="auto" href={video.channel.url} target="_blank" rel="noopener noreferrer">
                  {video.channel.name}
                </a>
              ) : (
                <span className="post-head-name" dir="auto">{t("posts.videoBrand")}</span>
              )}
              <span className="post-head-badge video-post-label">{t("posts.videoLabel")}</span>
            </div>
            <div className="post-head-meta">
              {video.channel && (
                <a href={video.channel.url} target="_blank" rel="noopener noreferrer" dir="auto">
                  {video.channel.name}
                </a>
              )}
              {video.channel && date && " · "}
              {date}
            </div>
          </div>
        </div>
      </header>
      <div className="video-post-body">
        <h3 className="video-post-title" dir="auto">{video.title}</h3>
        {video.description && <p className="video-post-desc" dir="auto">{video.description}</p>}
        <YouTubeEmbed id={video.id} />
        <a className="video-post-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
          {t("posts.watchOnYoutube")}
        </a>

        <div className="row" style={{ gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <button type="button" className={liked ? undefined : "secondary"} disabled={busy} onClick={toggleLike} aria-pressed={liked}>
            {liked ? t("video.liked") : t("video.like")}
            {enabled && ` (${likes.length})`}
          </button>
          <button type="button" className="secondary" onClick={toggleComments} aria-expanded={showComments}>
            {t("video.comments")}
            {enabled && ` (${comments.length})`}
          </button>
        </div>

        {message && (
          <p className="notice" aria-live="polite" style={{ marginTop: "12px" }}>
            {message}
          </p>
        )}

        {showComments && enabled && (
          <section style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #cbd5e1" }}>
            {comments.length === 0 && <p className="muted">{t("video.noComments")}</p>}
            {comments.map((comment) => {
              const name = comment.profiles?.full_name || comment.profiles?.username || t("video.member");
              return (
                <div key={comment.id} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <Link href={`/profile/${comment.user_id}`} style={{ fontWeight: 600 }} dir="auto">
                      {name}
                    </Link>
                    <TierBadge id={comment.user_id} />
                    <span className="muted" style={{ fontSize: "13px" }}>{fmt(comment.created_at, true)}</span>
                    {viewerId && (viewerId === comment.user_id || isAdmin) && (
                      <button type="button" className="secondary" disabled={busy} onClick={() => deleteComment(comment.id)}>
                        {t("video.delete")}
                      </button>
                    )}
                  </div>
                  <p dir="auto" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "4px 0 0" }}>{comment.body}</p>
                </div>
              );
            })}
            {viewerId ? (
              <form onSubmit={addComment} className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={2000}
                  placeholder={t("video.commentPlaceholder")}
                  aria-label={t("video.commentLabel")}
                  disabled={busy}
                  style={{ flex: "1 1 220px", minWidth: 0 }}
                />
                <button type="submit" disabled={busy || !commentText.trim()}>
                  {busy ? "..." : t("video.commentSubmit")}
                </button>
              </form>
            ) : (
              <p className="muted">{t("video.signInToComment")}</p>
            )}
          </section>
        )}
      </div>
    </article>
  );
}
