"use client";

export type AdminStats = Record<string, number>;

type Tone = "danger" | "warn" | "ok" | "main" | "info" | "plain";
type Card = { label: string; value: number; sub?: string; tone: Tone; icon: string };
function n(s: AdminStats, k: string) {
  return Number(s[k] ?? 0);
}

function fmt(v: number) {
  return v.toLocaleString("ar");
}

export default function StatsCards({ stats }: { stats: AdminStats }) {
  const reportsOpen = n(stats, "reports_open");
  const pending = n(stats, "attachments_pending");
  const rejected = n(stats, "attachments_rejected");
  const adsPending = n(stats, "ads_pending");

  // Top four: what needs the admin's attention first.
  const top: Card[] = [
    {
      label: "بلاغات مفتوحة",
      icon: "🚩",
      value: reportsOpen,
      tone: reportsOpen > 0 ? "danger" : "ok",
      sub: reportsOpen > 0 ? `تحتاج مراجعة · ${fmt(n(stats, "reports_total"))} إجمالي` : `لا شيء يحتاج مراجعة · ${fmt(n(stats, "reports_total"))} إجمالي`,
    },
    {
      label: "المشتركون",
      icon: "👥",
      value: n(stats, "profiles_total"),
      tone: "main",
      sub: `+${fmt(n(stats, "profiles_7d"))} آخر 7 أيام · ${fmt(n(stats, "profiles_banned"))} محظور`,
    },
    {
      label: "المشاريع",
      icon: "📁",
      value: n(stats, "projects_total"),
      tone: "main",
      sub: `+${fmt(n(stats, "projects_24h"))} آخر 24 ساعة`,
    },
    {
      label: "المرفقات",
      icon: "🛡️",
      value: n(stats, "attachments_total"),
      tone: rejected > 0 ? "danger" : pending > 0 ? "warn" : "ok",
      sub: `سليم ${fmt(n(stats, "attachments_clean"))} · قيد الفحص ${fmt(pending)} · مرفوض ${fmt(rejected)}`,
    },
  ];

  // The rest, ordered by importance.
  const rest: Card[] = [
    {
      label: "طلبات الإعلان",
      icon: "📣",
      value: adsPending,
      tone: adsPending > 0 ? "warn" : "info",
      sub: `بانتظار المراجعة · ${fmt(n(stats, "ads_approved"))} موافق عليه · ${fmt(n(stats, "ads_active"))} نشط الآن`,
    },
    ...("tier_bronze" in stats
      ? [
          {
            label: "الدرجات",
            icon: "🏅",
            value: n(stats, "tier_diamond"),
            tone: "main" as Tone,
            sub: `💎 ${fmt(n(stats, "tier_diamond"))} · 🥇 ${fmt(n(stats, "tier_gold"))} · 🥈 ${fmt(n(stats, "tier_silver"))} · 🥉 ${fmt(n(stats, "tier_bronze"))}`,
          },
        ]
      : []),
    { label: "رسائل المحادثة", icon: "💬", value: n(stats, "messages_total"), tone: "info", sub: `+${fmt(n(stats, "messages_24h"))} آخر 24 ساعة` },
    { label: "المنشورات", icon: "📝", value: n(stats, "posts_total"), tone: "info", sub: `+${fmt(n(stats, "posts_24h"))} آخر 24 ساعة` },
    { label: "ملفات Excel/CSV", icon: "📊", value: n(stats, "excel_files"), tone: "info" },
    {
      label: "التعليقات",
      icon: "🗨️",
      value: n(stats, "comments_total") + n(stats, "post_comments_total"),
      tone: "plain",
      sub: `مشاريع ${fmt(n(stats, "comments_total"))} · منشورات ${fmt(n(stats, "post_comments_total"))}`,
    },
    { label: "الصداقات", icon: "🤝", value: n(stats, "friendships_accepted"), tone: "plain", sub: `${fmt(n(stats, "friendships_pending"))} طلب معلق` },
    {
      label: "الإعجابات",
      icon: "❤️",
      value: n(stats, "likes_total") + n(stats, "post_likes_total"),
      tone: "plain",
      sub: `مشاريع ${fmt(n(stats, "likes_total"))} · منشورات ${fmt(n(stats, "post_likes_total"))}`,
    },
  ];

  const render = (c: Card) => (
    <div key={c.label} className={`admin-stat tone-${c.tone}`}>
      <span className="admin-stat-label">
        <span aria-hidden="true">{c.icon}</span> {c.label}
      </span>
      <strong className="admin-stat-value">{fmt(c.value)}</strong>
      {c.sub && <span className="admin-stat-sub">{c.sub}</span>}
    </div>
  );

  return (
    <>
      <div className="admin-stats admin-stats-top">{top.map(render)}</div>
      <div className="admin-stats">{rest.map(render)}</div>
    </>
  );
}
