import Link from "next/link";
import { getLang, getT } from "@/lib/i18n/server";
import { getClient } from "@/lib/supabase";
import type { Challenge } from "@/lib/types";
import { challengeDescription, challengeIcon, challengeIsOpen, challengeTitle } from "@/lib/challenges";

type ChallengeWithEntries = Challenge & { challenge_entries: { count: number }[] };

export default async function HomeChallenges() {
  const [t, { lang }, db] = await Promise.all([getT(), getLang(), Promise.resolve(getClient())]);
  if (!db) return null;

  const { data, error } = await db
    .from("challenges")
    .select("*,challenge_entries(count)")
    .order("ends_at", { ascending: true });

  if (error) return null;

  const challenges = ((data ?? []) as unknown as ChallengeWithEntries[])
    .filter(challengeIsOpen)
    .slice(0, 4);

  return (
    <section className="card home-challenges" aria-labelledby="home-challenges-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-challenges-title">{t("home.challengesTitle")}</h2>
          <p className="muted">{t("challenges.subtitle")}</p>
        </div>
        <Link href="/challenges">{t("home.allChallenges")}</Link>
      </div>
      {challenges.length ? (
        <div className="grid">
          {challenges.map((challenge) => (
            <article className="card challenge-card" key={challenge.id}>
              <span className="challenge-icon" aria-hidden="true">{challengeIcon(challenge.slug)}</span>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge home-open-badge">{t("challenges.open")}</span>
                <span className="badge">
                  {t("challenges.entries", { count: challenge.challenge_entries[0]?.count ?? 0 })}
                </span>
              </div>
              <h3>{challengeTitle(challenge, lang)}</h3>
              <p>{challengeDescription(challenge, lang)}</p>
              <Link className="button" href={`/challenges/${challenge.slug}`}>
                {t("challenges.submit")}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">{t("home.noOpenChallenges")}</p>
      )}
    </section>
  );
}
