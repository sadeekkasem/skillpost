"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAYS_FOR_GOLD,
  REFERRALS_FOR_SILVER,
  SITE_URL,
  TIERS,
  getMyTierInfo,
  tierLabel,
  type Tier,
  type TierInfo,
} from "@/lib/tiers";

type Stats = { views: number; downloads: number; likes: number };
type OwnProject = { id: string; title: string };

const BENEFITS: Record<Tier, string[]> = {
  bronze: ["3 ملفات Excel/CSV مجانية", "ملفات حتى 2 ميغابايت", "الدردشة مع الأصدقاء"],
  silver: ["شارة فضي 🥈", "4 ملفات Excel/CSV"],
  gold: ["شارة ذهبي 🥇", "6 ملفات Excel/CSV"],
  diamond: [
    "شارة ماسي 💎",
    "30 ملف Excel/CSV كل شهر",
    "ظهور مشاريعك أولًا في الصفحة الرئيسية ونتائج البحث",
    "مراسلة أي عضو وليس الأصدقاء فقط",
    "إحصائيات ملفك: المشاهدات والتنزيلات والإعجابات",
    "ملفات حتى 10 ميغابايت",
    "تثبيت مشروع في أعلى ملفك",
  ],
};

const fmt = (n: number) => n.toLocaleString("ar");

export default function MembershipPanel({ db, uid }: { db: SupabaseClient; uid: string }) {
  const [info, setInfo] = useState<TierInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<OwnProject[]>([]);
  const [pinned, setPinned] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const i = await getMyTierInfo(db);
      if (!alive || !i) return;
      setInfo(i);
      setPinned(i.pinned_project_id ?? "");
      if (i.tier === "diamond") {
        const [s, p] = await Promise.all([
          db.rpc("my_profile_stats"),
          db.from("projects").select("id,title").eq("user_id", uid).order("created_at", { ascending: false }),
        ]);
        if (!alive) return;
        if (!s.error && s.data) setStats(s.data as Stats);
        if (!p.error) setProjects((p.data ?? []) as OwnProject[]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, uid]);

  if (!info) return null;

  const link = `${SITE_URL}/?ref=${info.referral_code}`;
  const isDiamond = info.tier === "diamond";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("انسخ الرابط:", link);
    }
  }

  async function savePin(value: string) {
    setMsg("");
    const { error } = await db.rpc("set_pinned_project", { pid: value || null });
    if (error) {
      setMsg(error.message);
      return;
    }
    setPinned(value);
    setMsg(value ? "تم تثبيت المشروع في أعلى ملفك." : "تم إلغاء التثبيت.");
  }

  return (
    <>
      <section className="card account-section membership">
        <h2>
          <span aria-hidden="true">🏅</span> درجة العضوية
        </h2>
        <p className="membership-current">
          درجتك الحالية: <strong className={`tier-badge tier-${info.tier}`}>{tierLabel(info.tier)}</strong>
          {isDiamond && info.diamond_until && (
            <span className="muted"> · حتى {new Date(info.diamond_until).toLocaleDateString("ar")}</span>
          )}
        </p>
        <p className="muted">
          ملفات Excel/CSV: {fmt(info.excel_used)} من {fmt(info.excel_limit)}
          {info.excel_monthly ? " هذا الشهر" : ""} · حجم الملف حتى {fmt(info.max_file_mb)} ميغابايت
        </p>

        <h3>{TIERS.silver.icon} فضي: ادعُ أصدقاءك</h3>
        <p>
          عندما يسجّل {fmt(REFERRALS_FOR_SILVER)} أشخاص عبر رابطك ويؤكدون بريدهم تصبح فضيًا.
        </p>
        <progress max={REFERRALS_FOR_SILVER} value={Math.min(info.referrals, REFERRALS_FOR_SILVER)} />
        <p className="muted">
          المسجلون عبر رابطك: {fmt(info.referrals)}/{fmt(REFERRALS_FOR_SILVER)}
        </p>
        <div className="row referral-row">
          <input readOnly dir="ltr" value={link} aria-label="رابط الدعوة" onFocus={(e) => e.target.select()} />
          <button type="button" className="secondary" onClick={() => void copy()}>
            {copied ? "تم النسخ ✓" : "نسخ الرابط"}
          </button>
        </div>

        <h3>{TIERS.gold.icon} ذهبي: كن نشطًا</h3>
        <p>ادخل إلى الموقع {fmt(DAYS_FOR_GOLD)} يومًا مختلفًا خلال آخر 60 يومًا.</p>
        <progress max={DAYS_FOR_GOLD} value={Math.min(info.active_days, DAYS_FOR_GOLD)} />
        <p className="muted">
          أيام نشاطك: {fmt(info.active_days)}/{fmt(DAYS_FOR_GOLD)} يومًا خلال آخر 60 يومًا
        </p>

        <details>
          <summary>مزايا كل درجة</summary>
          <ul className="tier-benefits">
            {(Object.keys(TIERS) as Tier[]).map((t) => (
              <li key={t}>
                <strong>{tierLabel(t)}:</strong> {BENEFITS[t].join("، ")}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {isDiamond ? (
        <section className="card account-section membership">
          <h2>
            <span aria-hidden="true">💎</span> مزايا ماسي
          </h2>
          {stats && (
            <div className="tier-stats">
              <span>👁️ مشاهدات الملف: <strong>{fmt(stats.views)}</strong></span>
              <span>⬇️ تنزيلات الملفات: <strong>{fmt(stats.downloads)}</strong></span>
              <span>❤️ الإعجابات: <strong>{fmt(stats.likes)}</strong></span>
            </div>
          )}
          <label>
            المشروع المثبت في أعلى ملفك
            <select value={pinned} onChange={(e) => void savePin(e.target.value)}>
              <option value="">بدون تثبيت</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          {msg && <p className="muted" role="status">{msg}</p>}
        </section>
      ) : (
        <section className="card account-section membership membership-upgrade">
          <h2>
            <span aria-hidden="true">⭐</span> ترقية الحساب
          </h2>
          <p>المنصة مجانية حاليًا للجميع. اطّلع على الباقات القادمة وميزاتها.</p>
          <Link className="button" href="/pricing">
            عرض الباقات
          </Link>
        </section>
      )}
    </>
  );
}
