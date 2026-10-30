"use client";

export type AdminStats = Record<string, number>;

type Card = { label: string; value: number; sub?: string };

function n(s: AdminStats, k: string) {
  return Number(s[k] ?? 0);
}

function fmt(v: number) {
  return v.toLocaleString("ar");
}

export default function StatsCards({ stats }: { stats: AdminStats }) {
  const cards: Card[] = [
    { label: "المشتركون", value: n(stats, "profiles_total"), sub: `+${fmt(n(stats, "profiles_7d"))} آخر 7 أيام · ${fmt(n(stats, "profiles_banned"))} محظور` },
    { label: "المشاريع", value: n(stats, "projects_total"), sub: `+${fmt(n(stats, "projects_24h"))} آخر 24 ساعة` },
    { label: "المنشورات", value: n(stats, "posts_total"), sub: `+${fmt(n(stats, "posts_24h"))} آخر 24 ساعة` },
    {
      label: "التعليقات",
      value: n(stats, "comments_total") + n(stats, "post_comments_total"),
      sub: `مشاريع ${fmt(n(stats, "comments_total"))} · منشورات ${fmt(n(stats, "post_comments_total"))}`,
    },
    {
      label: "الإعجابات",
      value: n(stats, "likes_total") + n(stats, "post_likes_total"),
      sub: `مشاريع ${fmt(n(stats, "likes_total"))} · منشورات ${fmt(n(stats, "post_likes_total"))}`,
    },
    {
      label: "المرفقات",
      value: n(stats, "attachments_total"),
      sub: `سليم ${fmt(n(stats, "attachments_clean"))} · قيد الفحص ${fmt(n(stats, "attachments_pending"))} · مرفوض ${fmt(n(stats, "attachments_rejected"))}`,
    },
    { label: "ملفات Excel/CSV", value: n(stats, "excel_files") },
    { label: "الصداقات", value: n(stats, "friendships_accepted"), sub: `${fmt(n(stats, "friendships_pending"))} طلب معلق` },
    { label: "رسائل المحادثة", value: n(stats, "messages_total"), sub: `+${fmt(n(stats, "messages_24h"))} آخر 24 ساعة` },
    { label: "بلاغات مفتوحة", value: n(stats, "reports_open"), sub: `${fmt(n(stats, "reports_total"))} إجمالي البلاغات` },
    {
      label: "طلبات الإعلان",
      value: n(stats, "ads_pending"),
      sub: `بانتظار المراجعة · ${fmt(n(stats, "ads_approved"))} موافق عليه · ${fmt(n(stats, "ads_active"))} نشط الآن`,
    },
  ];
  return (
    <div className="admin-stats">
      {cards.map((c) => (
        <div key={c.label} className="admin-stat">
          <span className="admin-stat-label">{c.label}</span>
          <strong className="admin-stat-value">{fmt(c.value)}</strong>
          {c.sub && <span className="admin-stat-sub">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}
