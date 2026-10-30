"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient } from "@/lib/supabase";
import { useT } from "@/components/LanguageProvider";
import type { DictKey } from "@/lib/i18n";
import AdRequestsAdmin from "@/components/AdRequestsAdmin";
import ExcelQuotaAdmin from "@/components/ExcelQuotaAdmin";
import StatsCards, { type AdminStats } from "@/components/admin/StatsCards";
import ReportsTab from "@/components/admin/ReportsTab";
import ContentList from "@/components/admin/ContentList";
import UsersTab from "@/components/admin/UsersTab";
import ModeratorsTab from "@/components/admin/ModeratorsTab";

type Tab = "reports" | "today" | "projects" | "ads" | "users" | "moderators" | "tools";

const tabs: { id: Tab; label: string; labelKey?: DictKey; badge?: (s: AdminStats) => number }[] = [
  { id: "reports", label: "البلاغات", badge: (s) => s.reports_open },
  {
    id: "today",
    label: "جديد اليوم",
    badge: (s) => (s.projects_24h ?? 0) + (s.posts_24h ?? 0) + (s.comments_24h ?? 0) + (s.post_comments_24h ?? 0),
  },
  { id: "projects", label: "المشاريع", badge: (s) => s.projects_total },
  { id: "ads", label: "الإعلانات والطلبات", badge: (s) => s.ads_pending },
  { id: "users", label: "المشتركون", badge: (s) => s.profiles_total },
  { id: "moderators", label: "المشرفون", labelKey: "admin.moderators" },
  { id: "tools", label: "أدوات" },
];

export default function AdminPage() {
  const tr = useT();
  const [db] = useState(() => getClient());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("reports");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsMissing, setStatsMissing] = useState(false);

  const loadStats = useCallback(async (client: SupabaseClient) => {
    const { data, error } = await client.rpc("admin_stats");
    if (error) {
      setStatsMissing(true);
      return;
    }
    setStatsMissing(false);
    setStats((data ?? {}) as AdminStats);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!db) {
        setMessage("قاعدة البيانات غير متصلة");
        setLoading(false);
        return;
      }
      try {
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) {
          if (!cancelled) setMessage("سجّل الدخول بحساب المدير أولًا.");
          return;
        }
        const { data, error } = await db.from("profiles").select("is_admin").eq("id", auth.user.id).single();
        if (error) throw error;
        if (cancelled) return;
        if (data?.is_admin !== true) {
          setMessage("هذه الصفحة للمدير فقط.");
          return;
        }
        setIsAdmin(true);
        await loadStats(db);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "تعذر تحميل لوحة الإدارة");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [db, loadStats]);

  const refresh = useCallback(() => {
    if (db) void loadStats(db);
  }, [db, loadStats]);

  return (
    <div className="narrow admin-page">
      <h1>لوحة الإدارة</h1>

      {message && <p className="notice" aria-live="polite">{message}</p>}
      {loading && <p className="notice">جار التحميل...</p>}
      {!loading && !isAdmin && !message && <p className="notice">هذه الصفحة متاحة لحساب المدير فقط.</p>}

      {isAdmin && db && (
        <>
          {statsMissing && (
            <p className="notice">الإحصائيات والحظر غير مفعّلة بعد: شغّل ملف التحديث في Supabase.</p>
          )}
          {stats && <StatsCards stats={stats} />}

          <nav className="admin-tabs" role="tablist" aria-label="أقسام لوحة الإدارة">
            {tabs.map((t) => {
              const count = stats && t.badge ? Number(t.badge(stats) ?? 0) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.labelKey ? tr(t.labelKey) : t.label}
                  {count !== null && <span className="admin-tab-count">{count.toLocaleString("ar")}</span>}
                </button>
              );
            })}
          </nav>

          <div role="tabpanel" className="admin-panel">
            {tab === "reports" && <ReportsTab db={db} onChanged={refresh} />}
            {tab === "today" && (
              <ContentList db={db} kinds={["projects", "posts", "comments", "post_comments"]} defaultPeriod="day" onChanged={refresh} />
            )}
            {tab === "projects" && <ContentList db={db} kinds={["projects"]} onChanged={refresh} />}
            {tab === "ads" && <AdRequestsAdmin />}
            {tab === "users" && <UsersTab db={db} onChanged={refresh} />}
            {tab === "moderators" && <ModeratorsTab db={db} />}
            {tab === "tools" && <ExcelQuotaAdmin />}
          </div>
        </>
      )}
    </div>
  );
}
