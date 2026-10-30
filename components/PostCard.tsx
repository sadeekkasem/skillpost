"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import TierBadge from "./TierBadge";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, PostComment } from "@/lib/types";
import ReportButton from "@/components/ReportButton";

type Props = {
  db: SupabaseClient;
  post: Post;
  viewerId: string;
  isAdmin: boolean;
  onDeleted: (id: string) => void;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
}

function Avatar({ db, path, name, size }: { db: SupabaseClient; path?: string | null; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const url = path ? db.storage.from("avatars").getPublicUrl(path).data.publicUrl : "";

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`الصورة الشخصية لـ ${name}`}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #cbd5e1", flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        backgroundColor: "#e2e8f0",
        color: "#334155",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0) || "?"}
    </div>
  );
}

export default function PostCard({ db, post, viewerId, isAdmin, onDeleted }: Props) {
  const [likes, setLikes] = useState<string[]>(() => (post.post_likes ?? []).map((like) => like.user_id));
  const [comments, setComments] = useState<PostComment[]>(() =>
    [...(post.post_comments ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  );
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState(post.content);
  const [updatedAt, setUpdatedAt] = useState(post.updated_at ?? post.created_at);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const isOwner = Boolean(viewerId && viewerId === post.user_id);
  const edited = new Date(updatedAt).getTime() > new Date(post.created_at).getTime() + 60_000;
  const busyRef = useRef(false);

  const authorName = post.profiles?.full_name || post.profiles?.username || "عضو";
  const liked = Boolean(viewerId && likes.includes(viewerId));
  const canDelete = Boolean(viewerId && (viewerId === post.user_id || isAdmin));
  const imageUrl = post.image_path
    ? db.storage.from("post-images").getPublicUrl(post.image_path).data.publicUrl
    : "";

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ. حاول مرة أخرى.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function toggleLike() {
    if (!viewerId) {
      setMessage("سجّل الدخول للإعجاب بالمنشور.");
      return;
    }
    void run(async () => {
      if (liked) {
        const { error } = await db.from("post_likes").delete().eq("post_id", post.id).eq("user_id", viewerId);
        if (error) throw error;
        setLikes((current) => current.filter((id) => id !== viewerId));
      } else {
        const { error } = await db.from("post_likes").insert({ post_id: post.id, user_id: viewerId });
        if (error) throw error;
        setLikes((current) => [...current, viewerId]);
      }
    });
  }

  function addComment(event: React.FormEvent) {
    event.preventDefault();
    const text = commentText.trim();
    if (!viewerId || !text) return;
    void run(async () => {
      const { data, error } = await db
        .from("post_comments")
        .insert({ post_id: post.id, user_id: viewerId, content: text })
        .select("*,profiles!post_comments_user_id_fkey(id,username,full_name,avatar_path)")
        .single();
      if (error) throw error;
      setComments((current) => [...current, data as unknown as PostComment]);
      setCommentText("");
    });
  }

  function deleteComment(id: string) {
    if (!window.confirm("حذف هذا التعليق؟")) return;
    void run(async () => {
      const { error } = await db.from("post_comments").delete().eq("id", id);
      if (error) throw error;
      setComments((current) => current.filter((comment) => comment.id !== id));
    });
  }

  function saveEdit() {
    const text = draft.trim();
    if (!isOwner || text.length < 1 || text.length > 3000) {
      setMessage("النص يجب أن يكون بين 1 و 3000 حرف.");
      return;
    }
    void run(async () => {
      const now = new Date().toISOString();
      const { error } = await db.from("posts").update({ content: text, updated_at: now }).eq("id", post.id).eq("user_id", viewerId);
      if (error) throw error;
      setContent(text);
      setUpdatedAt(now);
      setEditing(false);
    });
  }

  function deletePost() {
    if (!window.confirm("هل تريد حذف هذا المنشور؟")) return;
    void run(async () => {
      const { error } = await db.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      if (post.image_path) {
        await db.storage.from("post-images").remove([post.image_path]);
      }
      onDeleted(post.id);
    });
  }

  return (
    <article className="card" style={{ marginBottom: "16px" }}>
      <header className="post-head">
        <div className="post-head-main">
          <Avatar db={db} path={post.profiles?.avatar_path} name={authorName} size={44} />
          <div className="post-head-info">
            <div className="post-head-name-row">
              <Link href={`/profile/${post.user_id}`} className="post-head-name" dir="auto">
                {authorName}
              </Link>
              <span className="post-head-badge">
                <TierBadge id={post.user_id} />
              </span>
            </div>
            <div className="post-head-meta">
              {formatTime(post.created_at)}
              {edited && " (معدَّل)"}
            </div>
          </div>
        </div>
        <div className="post-head-actions">
          {isOwner && !editing && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
            >
              تعديل
            </button>
          )}
          <ReportButton db={db} viewerId={viewerId} ownerId={post.user_id} targetType="post" targetId={post.id} />
          {canDelete && (
            <button type="button" className="secondary" disabled={busy} onClick={deletePost}>
              حذف
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <div style={{ marginBottom: "12px" }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={3000}
            rows={4}
            aria-label="تعديل المنشور"
            disabled={busy}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div className="row" style={{ gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            <button type="button" disabled={busy || !draft.trim()} onClick={saveEdit}>
              {busy ? "..." : "حفظ"}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "0 0 12px" }}>{content}</p>
      )}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="صورة المنشور"
          loading="lazy"
          style={{ maxWidth: "100%", maxHeight: "520px", objectFit: "contain", borderRadius: "8px", display: "block", marginBottom: "12px" }}
        />
      )}

      <div className="row" style={{ gap: "12px", flexWrap: "wrap" }}>
        <button type="button" className={liked ? undefined : "secondary"} disabled={busy} onClick={toggleLike} aria-pressed={liked}>
          {liked ? "أعجبني ✓" : "أعجبني"} ({likes.length})
        </button>
        <button type="button" className="secondary" onClick={() => setShowComments((value) => !value)}>
          التعليقات ({comments.length})
        </button>
      </div>

      {message && (
        <p className="notice" aria-live="polite" style={{ marginTop: "12px" }}>
          {message}
        </p>
      )}

      {showComments && (
        <section style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #cbd5e1" }}>
          {comments.length === 0 && <p className="muted">لا توجد تعليقات بعد.</p>}

          {comments.map((comment) => {
            const name = comment.profiles?.full_name || comment.profiles?.username || "عضو";
            return (
              <div key={comment.id} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <Link href={`/profile/${comment.user_id}`} style={{ fontWeight: 600 }}>
                    {name}
                  </Link>
                  <TierBadge id={comment.user_id} />
                  <span className="muted" style={{ fontSize: "13px" }}>
                    {formatTime(comment.created_at)}
                  </span>
                  <ReportButton db={db} viewerId={viewerId} ownerId={comment.user_id} targetType="post_comment" targetId={comment.id} />
                  {viewerId && (viewerId === comment.user_id || isAdmin) && (
                    <button type="button" className="secondary" disabled={busy} onClick={() => deleteComment(comment.id)}>
                      حذف
                    </button>
                  )}
                </div>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "4px 0 0" }}>{comment.content}</p>
              </div>
            );
          })}

          {viewerId ? (
            <form onSubmit={addComment} className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={1000}
                placeholder="اكتب تعليقاً..."
                aria-label="نص التعليق"
                disabled={busy}
                style={{ flex: "1 1 220px" }}
              />
              <button type="submit" disabled={busy || !commentText.trim()}>
                {busy ? "..." : "تعليق"}
              </button>
            </form>
          ) : (
            <p className="muted">سجّل الدخول لإضافة تعليق.</p>
          )}
        </section>
      )}
    </article>
  );
}
