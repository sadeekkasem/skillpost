import type { Lang } from "@/lib/i18n";
import type { Challenge } from "@/lib/types";

export const CHALLENGE_ICONS: Record<string, string> = {
  "sales-data-cleanup": "🧹",
  "excel-invoice": "🧾",
  "portfolio-page": "🌐",
  "kpi-dashboard": "📊",
};

export function challengeIcon(slug: string | null | undefined): string {
  return (slug && CHALLENGE_ICONS[slug]) || "🏆";
}

export function challengeTitle(c: Challenge, lang: Lang): string {
  if (lang === "en" && c.title_en) return c.title_en;
  return c.title_ar;
}

export function challengeDescription(c: Challenge, lang: Lang): string {
  if (lang === "en" && c.description_en) return c.description_en;
  return c.description_ar;
}

export function challengeIsOpen(c: Pick<Challenge, "starts_at" | "ends_at">, now = Date.now()): boolean {
  const start = Date.parse(c.starts_at);
  const end = Date.parse(c.ends_at);
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

export function levelKey(level: string): "challenges.level.beginner" | "challenges.level.intermediate" | "challenges.level.advanced" | "challenges.easy" {
  const v = level.toLowerCase();
  if (v === "beginner") return "challenges.level.beginner";
  if (v === "intermediate") return "challenges.level.intermediate";
  if (v === "advanced") return "challenges.level.advanced";
  return "challenges.easy";
}

export function formatChallengeDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
