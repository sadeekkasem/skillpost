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

/** Compact open-challenges preview for the homepage. */
export default async function OpenChallengesStrip() {
  const t = await getT();
  const { lang } = await getLang();
  const db = getClient();

  let open: Challenge[] = [];
  if (db) {
    const { data } = await db
      .from("challenges")
      .select("*")
      .order("ends_at", { ascending: true })
      .limit(24);
    open = ((data ?? []) as Challenge[]).filter((c) => challengeIsOpen(c)).slice(0, 3);
  }

  if (!open.length) return null;

  return (
    <section className="card home-challenges">
      <div className="home-challenges-head">
        <h2>{t("challenges.homeTitle")}</h2>
        <Link href="/challenges">{t("challenges.homeMore")}</Link>
      </div>
      <div className="grid home-challenges-grid">
        {open.map((c) => (
          <article className="card challenge-card home-challenge-card" key={c.id}>
            <span className="challenge-icon" aria-hidden="true">
              {challengeIcon(c.slug)}
            </span>
            <h3>{challengeTitle(c, lang)}</h3>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">{t("challenges.level", { level: t(levelKey(c.level)) })}</span>
              <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>
                {t("challenges.open")}
              </span>
            </div>
            <p className="muted home-challenge-desc">{challengeDescription(c, lang)}</p>
            <Link className="button secondary" href={`/challenges/${c.slug}`}>
              {t("challenges.view")}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
