"use client";
import Link from "next/link";
import { getClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { formatAvgStars, type RatingStats } from "@/lib/ratings";
import { useT } from "@/components/LanguageProvider";
import TierBadge from "./TierBadge";

type ProjectWithOwner = Project & {
  profiles?: {
    id?: string;
    username?: string | null;
    full_name?: string | null;
    specialty?: string | null;
    avatar_path?: string | null;
  } | null;
};

export default function ProjectCard({
  project,
  pinned = false,
  rating,
}: Readonly<{ project: Project; pinned?: boolean; rating?: RatingStats | null }>) {
  const t = useT();
  const p = project as ProjectWithOwner;
  const owner = p.profiles ?? null;

  const ownerName =
    owner?.full_name || owner?.username || "عضو";

  const ownerId = owner?.id ?? p.user_id ?? "";
  const profileHref = ownerId ? `/profile/${ownerId}` : "";

  const db = getClient();

  const avatarUrl =
    db && owner?.avatar_path
      ? db.storage
          .from("avatars")
          .getPublicUrl(owner.avatar_path).data.publicUrl
      : "";

  const attachments = p.attachments ?? [];

  const excelFile = attachments.find((file) =>
    /\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name)
  );

  const file = excelFile ?? attachments[0];
  const isExcel = Boolean(excelFile);
  const description = p.description ?? "";

  return (
    <article
      className="card project-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <span
        className="badge"
        style={{ alignSelf: "flex-start" }}
      >
        {pinned && "📌 مثبّت · "}
        {p.category}
      </span>

      {profileHref ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Link
            href={profileHref}
            aria-label={`عرض ملف ${ownerName}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              color: "inherit",
              minWidth: 0,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={`الصورة الشخصية لـ ${ownerName}`}
                width={48}
                height={48}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #cbd5e1",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                aria-label="لا توجد صورة شخصية"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {ownerName.trim().charAt(0) || "؟"}
              </span>
            )}

            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                }}
              >
                {ownerName} <TierBadge id={ownerId} />
              </span>

              {owner?.specialty && (
                <span
                  className="muted"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {owner.specialty}
                </span>
              )}
            </span>
          </Link>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {ownerName} <TierBadge id={ownerId} />
        </p>
      )}

      <Link
        href={`/projects/${p.id}`}
        aria-label={`عرض مشروع ${p.title}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          minHeight: "160px",
          padding: "20px",
          borderRadius: "12px",
          backgroundColor: isExcel ? "#e8f5ee" : "#f1f5f9",
          color: isExcel ? "#166534" : "#334155",
          textDecoration: "none",
        }}
      >
        <svg
          width="72"
          height="88"
          viewBox="0 0 72 88"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2H46L68 24V80C68 83.3 65.3 86 62 86H12C8.7 86 6 83.3 6 80V8C6 4.7 8.7 2 12 2Z"
            fill={isExcel ? "#217346" : "#475569"}
          />
          <path
            d="M46 2V24H68"
            fill={isExcel ? "#79b995" : "#94a3b8"}
          />

          {isExcel ? (
            <>
              <rect
                x="20"
                y="37"
                width="34"
                height="28"
                rx="2"
                stroke="white"
                strokeWidth="2"
              />
              <path
                d="M20 46H54M20 55H54M31 37V65M43 37V65"
                stroke="white"
                strokeWidth="2"
              />
            </>
          ) : (
            <path
              d="M22 42H51M22 52H51M22 62H42"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
        </svg>

        <span style={{ fontWeight: 700 }}>
          {isExcel ? "ملف Excel" : file ? "ملف مرفق" : "مشروع"}
        </span>

        {file && (
          <span
            dir="auto"
            style={{
              fontSize: "14px",
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            {file.name}
          </span>
        )}
      </Link>

      <h2 style={{ margin: 0 }}>
        <Link href={`/projects/${p.id}`}>{p.title}</Link>
      </h2>

      {description && (
        <p
          style={{
            margin: 0,
            overflowWrap: "anywhere",
          }}
        >
          {description.slice(0, 160)}
          {description.length > 160 ? "…" : ""}
        </p>
      )}

      {rating && rating.ratings_count > 0 && (
        <p className="muted featured-likes" style={{ margin: 0 }} aria-label={t("rating.average", { avg: formatAvgStars(rating.avg_stars), count: rating.ratings_count })}>
          {"★".repeat(Math.max(1, Math.round(rating.avg_stars)))}
          {"☆".repeat(Math.max(0, 5 - Math.max(1, Math.round(rating.avg_stars))))}{" "}
          {formatAvgStars(rating.avg_stars)} · {t("rating.count", { count: rating.ratings_count })}
        </p>
      )}

      <Link
        href={`/projects/${p.id}`}
        style={{ marginTop: "auto" }}
      >
        عرض التفاصيل ←
      </Link>
    </article>
  );
}