import Link from "next/link";
import { getLang, getT } from "@/lib/i18n/server";
import { getClient } from "@/lib/supabase";
import type { Challenge } from "@/lib/types";
import {
  challengeDescription,
  challengeIcon,
  challengeIsOpen,
  challengeTitle,
  levelKey,
} from "@/lib/challenges";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("challenges.title")} | SkillPost`, description: t("challenges.subtitle") };
}

export default async function ChallengesPage() {
  const t = await getT();
  const { lang } = await getLang();
  const db = getClient();

  let challenges: Challenge[] = [];
  if (db) {
    const { data } = await db
      .from("challenges")
      .select("*")
      .order("starts_at", { ascending: false });
    challenges = (data ?? []) as Challenge[];
  }

  return (
    <section>
      <div className="hero feed-hero page-hero">
        <h1>🏆 {t("challenges.title")}</h1>
        <p>{t("challenges.subtitle")}</p>
      </div>
      <p className="notice">{t("challenges.note")}</p>
      {!challenges.length ? (
        <p className="muted">{t("challenges.noEntries")}</p>
      ) : (
        <div className="grid">
          {challenges.map((c) => {
            const open = challengeIsOpen(c);
            return (
              <article className="card challenge-card" key={c.id}>
                <span className="challenge-icon" aria-hidden="true">
                  {challengeIcon(c.slug)}
                </span>
                <h2>{challengeTitle(c, lang)}</h2>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge" style={{ alignSelf: "flex-start" }}>
                    {t("challenges.level", { level: t(levelKey(c.level)) })}
                  </span>
                  <span
                    className="badge"
                    style={{
                      alignSelf: "flex-start",
                      background: open ? "#dcfce7" : "#e2e8f0",
                      color: open ? "#166534" : "#475569",
                    }}
                  >
                    {open ? t("challenges.open") : t("challenges.closed")}
                  </span>
                </div>
                <p>{challengeDescription(c, lang)}</p>
                <Link className="button" href={`/challenges/${c.slug}`}>
                  {t("challenges.view")}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
