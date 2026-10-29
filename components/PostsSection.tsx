"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import type { Post } from "@/lib/types";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";

const POST_SELECT =
  "*,profiles!posts_user_id_fkey(id,username,full_name,avatar_path),post_likes(user_id),post_comments(*,profiles!post_comments_user_id_fkey(id,username,full_name,avatar_path))";

type Props = {
  /** When set, only this user's posts are shown and the composer is hidden unless it is the viewer. */
  userId?: string;
};

export default function PostsSection({ userId }: Props) {
  const [db] = useState(() => getClient());
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadViewer() {
      if (!db) return;
      try {
        const { data } = await db.auth.getUser();
        const id = data.user?.id ?? "";
        if (cancelled) return;
        setViewerId(id);
        if (!id) return;
        const { data: profile } = await db.from("profiles").select("is_admin").eq("id", id).single();
        if (!cancelled) setIsAdmin(profile?.is_admin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }

    void loadViewer();
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!db) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setMessage("");
      try {
        let query = db.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(50);
        if (userId) query = query.eq("user_id", userId);
        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          setPosts([]);
          setMessage(error.message);
          return;
        }
        setPosts((data ?? []) as unknown as Post[]);
      } catch (error) {
        if (!cancelled) {
          setPosts([]);
          setMessage(error instanceof Error ? error.message : "تعذر تحميل المنشورات.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, userId, reloadKey]);

  if (!db) return null;

  const showComposer = Boolean(viewerId && (!userId || userId === viewerId));

  return (
    <section aria-label="المنشورات" style={{ marginBottom: "24px" }}>
      <h2>المنشورات</h2>

      {showComposer && (
        <PostComposer db={db} userId={viewerId} onPublished={() => setReloadKey((key) => key + 1)} />
      )}

      {loading && (
        <p className="notice" aria-live="polite">
          جارٍ تحميل المنشورات...
        </p>
      )}

      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {!loading && !message && posts.length === 0 && <p className="muted">لا توجد منشورات بعد.</p>}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          db={db}
          post={post}
          viewerId={viewerId}
          isAdmin={isAdmin}
          onDeleted={(id) => setPosts((current) => current.filter((item) => item.id !== id))}
        />
      ))}
    </section>
  );
}
