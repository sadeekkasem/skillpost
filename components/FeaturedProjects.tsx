"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { getClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import ProjectCard from "./ProjectCard";

type Ranked = Project & { likes?: { count: number }[] };

const SELECT =
  "*,profiles!projects_user_id_fkey(id,username,full_name,avatar_path,specialty),attachments(*),likes(count)";

function rank(rows: Ranked[]): Ranked[] {
  const count = (p: Ranked) => p.likes?.[0]?.count ?? 0;
  return rows
    .filter((p) => count(p) > 0)
    .sort((a, b) => count(b) - count(a))
    .slice(0, 6);
}

/** Most-liked projects published in the last 7 days (falls back to most-liked recent projects). */
export default function FeaturedProjects() {
  const t = useT();
  const [items, setItems] = useState<Ranked[]>([]);

  useEffect(() => {
    const db = getClient();
    if (!db) return;
    let alive = true;
    (async () => {
      try {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const week = await db.from("projects").select(SELECT).gte("created_at", since).limit(100);
        let top = rank((week.data ?? []) as unknown as Ranked[]);
        if (!top.length) {
          const recent = await db
            .from("projects")
            .select(SELECT)
            .order("created_at", { ascending: false })
            .limit(60);
          top = rank((recent.data ?? []) as unknown as Ranked[]);
        }
        if (alive) setItems(top);
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
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}
