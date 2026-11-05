"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { getClient } from "@/lib/supabase";
import { fetchRatingStats, type RatingStats } from "@/lib/ratings";
import type { Project } from "@/lib/types";
import ProjectCard from "./ProjectCard";

type Ranked = Project & { likes?: { count: number }[] };

const SELECT =
  "*,profiles!projects_user_id_fkey(id,username,full_name,avatar_path,specialty),attachments(*),likes(count)";

/** Most-liked by likes received in the last 7 days; falls back to recent liked projects. */
export default function FeaturedProjects() {
  const t = useT();
  const [items, setItems] = useState<Ranked[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingStats>>({});

  useEffect(() => {
    const db = getClient();
    if (!db) return;
    let alive = true;
    (async () => {
      try {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const likesRes = await db
          .from("likes")
          .select("project_id")
          .gte("created_at", since)
          .limit(3000);

        const counts = new Map<string, number>();
        for (const row of (likesRes.data ?? []) as { project_id: string }[]) {
          counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
        }

        let top: Ranked[] = [];
        if (counts.size) {
          const rankedIds = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([id]) => id);
          const projectsRes = await db.from("projects").select(SELECT).in("id", rankedIds);
          const byId = new Map(
            ((projectsRes.data ?? []) as unknown as Ranked[]).map((p) => [p.id, p])
          );
          top = rankedIds.map((id) => byId.get(id)).filter(Boolean) as Ranked[];
        }

        if (!top.length) {
          const recent = await db
            .from("projects")
            .select(SELECT)
            .order("created_at", { ascending: false })
            .limit(60);
          const rows = (recent.data ?? []) as unknown as Ranked[];
          top = rows
            .filter((p) => (p.likes?.[0]?.count ?? 0) > 0)
            .sort((a, b) => (b.likes?.[0]?.count ?? 0) - (a.likes?.[0]?.count ?? 0))
            .slice(0, 6);
        }

        if (!alive) return;
        setItems(top);
        try {
          const stats = await fetchRatingStats(
            db,
            top.map((p) => p.id)
          );
          if (alive) setRatings(stats);
        } catch {
          /* ratings optional */
        }
      } catch {
        /* hide section on error */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!items.length) return null;
  return (
    <section className="card featured-section">
      <h2>{t("featured.title")}</h2>
      <div className="grid">
        {items.map((p) => (
          <ProjectCard key={p.id} project={p} rating={ratings[p.id]} />
        ))}
      </div>
    </section>
  );
}
