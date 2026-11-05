import Link from "next/link";
import { notFound } from "next/navigation";
import { getLang, getT } from "@/lib/i18n/server";
import { getClient } from "@/lib/supabase";
import type { Challenge } from "@/lib/types";
import {
  challengeDescription,
  challengeIcon,
  challengeIsOpen,
  challengeTitle,
  formatChallengeDate,
  levelKey,
} from "@/lib/challenges";
import ChallengeDetail from "@/components/ChallengeDetail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = await getT();
  const { lang } = await getLang();
  const db = getClient();
  if (!db) return { title: `${t("challenges.title")} | SkillPost` };
  const { data } = await db.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!data) return { title: `${t("challenges.title")} | SkillPost` };
  const c = data as Challenge;
  return {
    title: `${challengeTitle(c, lang)} | SkillPost`,
    description: challengeDescription(c, lang).slice(0, 160),
  };
}

export default async function ChallengeSlugPage({ params }: Props) {
  const { slug } = await params;
  const t = await getT();
  const { lang } = await getLang();
  const db = getClient();
  if (!db) notFound();
  const { data } = await db.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const challenge = data as Challenge;
  const open = challengeIsOpen(challenge);

  return (
    <section>
      <p>
        <Link href="/challenges">{t("challenges.back")}</Link>
      </p>
      <article className="card challenge-card">
        <span className="challenge-icon" aria-hidden="true">
          {challengeIcon(challenge.slug)}
        </span>
        <h1 style={{ marginTop: 0 }}>{challengeTitle(challenge, lang)}</h1>
        <div className="row">
          <span className="badge">
            {t("challenges.level", { level: t(levelKey(challenge.level)) })}
          </span>
          <span
            className="badge"
            style={{
              background: open ? "#dcfce7" : "#e2e8f0",
              color: open ? "#166534" : "#475569",
            }}
          >
            {open ? t("challenges.open") : t("challenges.closed")}
          </span>
        </div>
        <p className="muted">
          {t("challenges.dates", {
            start: formatChallengeDate(challenge.starts_at, lang),
            end: formatChallengeDate(challenge.ends_at, lang),
          })}
        </p>
        <p className="description">{challengeDescription(challenge, lang)}</p>
      </article>
      <ChallengeDetail initial={challenge} />
    </section>
  );
}
