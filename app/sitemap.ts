import type { MetadataRoute } from "next";
import { getClient } from "@/lib/supabase";
import { confirmedOnly } from "@/lib/confirmed";

const BASE = "https://www.skillpostapp.com";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics = ["", "/videos", "/challenges", "/news", "/pricing", "/about", "/privacy", "/terms", "/advertise", "/search"];
  const out: MetadataRoute.Sitemap = statics.map((p) => ({ url: BASE + p, lastModified: now }));
  try {
    const db = getClient();
    if (!db) return out;
    const prof = await confirmedOnly((filter) => {
      let q = db.from("profiles").select("id").limit(1000);
      if (filter) q = q.eq("email_confirmed", true);
      return q;
    });
    const ids = ((prof.data as { id: string }[] | null) ?? []).map((r) => r.id);
    for (const id of ids) out.push({ url: `${BASE}/profile/${id}` });
    if (ids.length) {
      const pr = await db.from("projects").select("id,user_id,created_at").in("user_id", ids.slice(0, 300)).limit(1000);
      for (const p of (pr.data as { id: string; created_at?: string }[] | null) ?? [])
        out.push({ url: `${BASE}/projects/${p.id}`, lastModified: p.created_at ? new Date(p.created_at) : undefined });
    }
    const challenges = await db.from("challenges").select("slug,created_at").limit(1000);
    for (const challenge of (challenges.data as { slug: string; created_at?: string }[] | null) ?? []) {
      out.push({
        url: `${BASE}/challenges/${challenge.slug}`,
        lastModified: challenge.created_at ? new Date(challenge.created_at) : undefined,
      });
    }
  } catch {}
  return out;
}
