import { fixturesEnabled } from "../supabase/env";
import { createSupabaseServerClient } from "../supabase/server";
import { TEST_ADMIN_EXTRAS } from "./fixtures";
import type { VisitorStats } from "./types";

type VercelRow = {
  timestamp?: string;
  requestPath?: string;
  pageviews?: number;
  visitors?: number;
};

async function vercelQuery(by: string): Promise<VercelRow[] | null> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  const until = new Date();
  const since = new Date(until.getTime() - 29 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    projectId,
    by,
    since: since.toISOString(),
    until: until.toISOString(),
    limit: "30",
  });
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  const res = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as { data?: VercelRow[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

async function loadVercelStats(): Promise<VisitorStats | null> {
  try {
    const [dailyRows, pathRows] = await Promise.all([
      vercelQuery("day"),
      vercelQuery("requestPath"),
    ]);
    if (!dailyRows || !pathRows) return null;
    return {
      source: "vercel",
      note: "من Vercel Web Analytics (بدون كوكيز) خلال نافذة الخطة الحالية، بحد أقصى شهر على Hobby.",
      daily: dailyRows.map((row) => ({
        day: (row.timestamp || "").slice(0, 10),
        views: Number(row.pageviews || 0),
        visitors: Number(row.visitors || 0),
      })),
      paths: pathRows.map((row) => ({
        path: row.requestPath || "/",
        views: Number(row.pageviews || 0),
        visitors: Number(row.visitors || 0),
      })),
    };
  } catch {
    return null;
  }
}

export async function loadVisitorStats(): Promise<VisitorStats> {
  if (fixturesEnabled()) return TEST_ADMIN_EXTRAS.stats;
  const vercel = await loadVercelStats();
  if (vercel) return vercel;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      source: "counters",
      note: "عدادات بلا كوكيز غير متاحة بعد (لا اتصال بقاعدة البيانات).",
      daily: [],
      paths: [],
    };
  }
  const { data, error } = await supabase.rpc("islamic_admin_page_views", { p_days: 14 });
  if (error || !data) {
    return {
      source: "counters",
      note: "تعذّر قراءة العدادات.",
      daily: [],
      paths: [],
    };
  }
  const payload = data as { daily?: VisitorStats["daily"]; paths?: VisitorStats["paths"] };
  return {
    source: "counters",
    note: "عدادات يومية بلا كوكيز (بدون عنوان IP أو متصفح). تظهر بيانات Vercel هنا بعد إضافة الرمز في الاستضافة.",
    daily: payload.daily ?? [],
    paths: payload.paths ?? [],
  };
}
