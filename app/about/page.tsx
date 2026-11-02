import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("about.title")} | SkillPost`, description: t("about.intro") };
}

export default async function AboutPage() {
  const t = await getT();
  return (
    <section className="narrow">
      <div className="hero feed-hero page-hero">
        <h1>{t("about.title")}</h1>
        <p>{t("about.intro")}</p>
      </div>
      <article className="card">
        <p>{t("about.canLead")}</p>
        <ul className="about-list">
          <li>{t("about.item1")}</li>
          <li>{t("about.item2")}</li>
          <li>{t("about.item3")}</li>
          <li>{t("about.item4")}</li>
        </ul>
        <p style={{ fontWeight: 700 }}>{t("about.outro")}</p>
        <div className="row">
          <Link className="button" href="/account">{t("hero.ctaStart")}</Link>
          <Link className="button secondary" href="/projects/new">{t("hero.ctaPublish")}</Link>
        </div>
      </article>
    </section>
  );
}
