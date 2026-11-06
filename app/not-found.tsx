import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <section className="card narrow">
      <span className="badge">404</span>
      <h1>{t("notFound.title")}</h1>
      <p className="muted">{t("notFound.body")}</p>
      <div className="row">
        <Link className="button" href="/">{t("notFound.back")}</Link>
        <Link className="button secondary" href="/search">{t("notFound.search")}</Link>
        <Link className="button secondary" href="/challenges">{t("nav.challenges")}</Link>
        <Link className="button secondary" href="/pricing">{t("pricing.title")}</Link>
      </div>
    </section>
  );
}
