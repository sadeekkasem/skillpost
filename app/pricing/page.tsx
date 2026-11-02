import { getT } from "@/lib/i18n/server";
import type { DictKey } from "@/lib/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("pricing.title")} | SkillPost`, description: t("pricing.freeNote") };
}

const CONTACT = "sadeekkasem@gmail.com";

type Plan = { name: DictKey; price: number; features: DictKey[]; soon: boolean; featured?: boolean };
const PLANS: Plan[] = [
  { name: "pricing.free", price: 0, features: ["pricing.free1", "pricing.free2", "pricing.free3"], soon: false },
  { name: "pricing.pro", price: 12, features: ["pricing.pro1", "pricing.pro2", "pricing.pro3", "pricing.pro4"], soon: true, featured: true },
  { name: "pricing.office", price: 35, features: ["pricing.office1", "pricing.office2", "pricing.office3"], soon: true },
];

export default async function PricingPage() {
  const t = await getT();
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(t("pricing.mailSubject"))}`;
  return (
    <section>
      <div className="hero feed-hero page-hero">
        <h1>{t("pricing.title")}</h1>
        <p>{t("pricing.subtitle")}</p>
      </div>
      <p className="notice" role="note">🎉 {t("pricing.freeNote")}</p>
      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <article key={plan.name} className={`card price-card${plan.featured ? " featured" : ""}`}>
            {plan.soon && <span className="badge price-soon">{t("pricing.soon")}</span>}
            <h2>{t(plan.name)}</h2>
            <p className="price-amount" dir="ltr">
              {plan.price}€{plan.price > 0 && <small>{t("pricing.perMonth")}</small>}
            </p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{t(f)}</li>
              ))}
            </ul>
            {plan.soon ? (
              <a className="button" href={mailto}>{t("pricing.contact")}</a>
            ) : (
              <span className="button secondary" aria-disabled="true">{t("pricing.current")}</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
