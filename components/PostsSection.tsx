"use client";

import { useT } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import type { Post } from "@/lib/types";

const PROJECT_SELECT =
  "*,profiles!projects_user_id_fkey(username,full_name,avatar_path,specialty),attachments(*)";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import VideoPostCard from "./VideoPostCard";
import type { ChannelVideo } from "@/lib/youtube/feed";
import { buildHomeFeed } from "@/lib/youtube/interleave";
import ProjectCard from "./ProjectCard";
import type { Project } from "@/lib/types";

const POST_SELECT =
  "*,profiles!posts_user_id_fkey(id,username,full_name,avatar_path),post_likes(user_id),post_comments(*,profiles!post_comments_user_id_fkey(id,username,full_name,avatar_path))";

type Props = {
  /** When set, only this user's posts are shown and the composer is hidden unless it is the viewer. */
  userId?: string;
  /** Channel videos to interleave into the feed (homepage only). */
  videos?: ChannelVideo[];
  /** Homepage only: also merge public projects into the timeline. */
  withProjects?: boolean;
};

export default function PostsSection({ userId, videos = [], withProjects = false }: Props) {
  const t = useT();
  const [db] = useState(() => getClient());
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!db || !withProjects || userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await db
          .from("projects")
          .select(PROJECT_SELECT)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!cancelled && !error) setProjects((data ?? []) as unknown as Project[]);
      } catch {
        // Projects are optional here; posts and videos still render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, withProjects, userId, reloadKey]);

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
          setMessage(error instanceof Error ? error.message : t("posts.loadError"));
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
    <section aria-label={t("posts.title")} style={{ marginBottom: "24px" }}>
      <h2>{t("posts.title")}</h2>

      {showComposer && (
        <PostComposer db={db} userId={viewerId} onPublished={() => setReloadKey((key) => key + 1)} />
      )}

      {loading && (
        <p className="notice" aria-live="polite">
          {t("posts.loading")}
        </p>
      )}

      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {!loading && !message && posts.length === 0 && (userId || (videos.length === 0 && projects.length === 0)) && <p className="muted">{t("posts.empty")}</p>}

      {(loading ? [] : buildHomeFeed(posts, userId ? [] : projects, userId ? [] : videos)).map((item) =>
        item.kind === "video" ? (
          <VideoPostCard key={`yt-${item.video.id}`} video={item.video} />
        ) : item.kind === "project" ? (
          <div key={`pr-${item.project.id}`} className="feed-project">
            <ProjectCard project={item.project} />
          </div>
        ) : (
          <PostCard
            key={item.post.id}
            db={db}
            post={item.post}
            viewerId={viewerId}
            isAdmin={isAdmin}
            onDeleted={(id) => setPosts((current) => current.filter((x) => x.id !== id))}
          />
        )
      )}
    </section>
  );
}
