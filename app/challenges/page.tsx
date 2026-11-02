import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { DictKey } from "@/lib/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("challenges.title")} | SkillPost`, description: t("challenges.subtitle") };
}

const CHALLENGES: { icon: string; title: DictKey; desc: DictKey; level: DictKey }[] = [
  { icon: "🧹", title: "challenges.c1t", desc: "challenges.c1d", level: "challenges.easy" },
  { icon: "🧾", title: "challenges.c2t", desc: "challenges.c2d", level: "challenges.easy" },
  { icon: "🌐", title: "challenges.c3t", desc: "challenges.c3d", level: "challenges.mid" },
  { icon: "📊", title: "challenges.c4t", desc: "challenges.c4d", level: "challenges.mid" },
];

export default async function ChallengesPage() {
  const t = await getT();
  return (
    <section>
      <div className="hero feed-hero page-hero">
        <h1>🏆 {t("challenges.title")}</h1>
        <p>{t("challenges.subtitle")}</p>
      </div>
      <p className="notice">{t("challenges.note")}</p>
      <div className="grid">
        {CHALLENGES.map((c) => (
          <article className="card challenge-card" key={c.title}>
            <span className="challenge-icon" aria-hidden="true">{c.icon}</span>
            <h2>{t(c.title)}</h2>
            <span className="badge" style={{ alignSelf: "flex-start" }}>
              {t("challenges.level", { level: t(c.level) })}
            </span>
            <p>{t(c.desc)}</p>
            <Link className="button" href="/projects/new">{t("challenges.cta")}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
