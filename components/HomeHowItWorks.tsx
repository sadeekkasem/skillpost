import { getT } from "@/lib/i18n/server";

export default async function HomeHowItWorks() {
  const t = await getT();
  const steps = [
    { number: 1, title: t("home.step1Title"), text: t("home.step1Text") },
    { number: 2, title: t("home.step2Title"), text: t("home.step2Text") },
    { number: 3, title: t("home.step3Title"), text: t("home.step3Text") },
  ];

  return (
    <section className="card home-how" aria-labelledby="home-how-title">
      <h2 id="home-how-title">{t("home.howTitle")}</h2>
      <div className="grid">
        {steps.map((step) => (
          <article className="home-step" key={step.number}>
            <span className="home-step-number" aria-hidden="true">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
