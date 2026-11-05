import type { SupabaseClient } from "@supabase/supabase-js";

export type RatingStats = {
  avg_stars: number;
  ratings_count: number;
};

/** Batch-load rating averages for many projects (avoids N+1 on card grids). */
export async function fetchRatingStats(
  db: SupabaseClient,
  projectIds: string[]
): Promise<Record<string, RatingStats>> {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (!ids.length) return {};
  const out: Record<string, RatingStats> = {};
  // Supabase .in() is fine for typical page sizes; chunk if huge.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await db
      .from("project_rating_stats")
      .select("project_id,avg_stars,ratings_count")
      .in("project_id", chunk);
    if (error) throw error;
    for (const row of (data ?? []) as {
      project_id: string;
      avg_stars: number | string;
      ratings_count: number;
    }[]) {
      out[row.project_id] = {
        avg_stars: Number(row.avg_stars) || 0,
        ratings_count: row.ratings_count ?? 0,
      };
    }
  }
  return out;
}

export function formatAvgStars(avg: number): string {
  if (!Number.isFinite(avg) || avg <= 0) return "0";
  return (Math.round(avg * 10) / 10).toFixed(1).replace(/\.0$/, "");
}
