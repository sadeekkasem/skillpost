"use client";
import { useT } from "@/components/LanguageProvider";

export default function Hero() {
  const t = useT();
  return (
    <section className="hero feed-hero">
      <h1>{t("hero.title")}</h1>
      <p>{t("hero.subtitle")}</p>
    </section>
  );
}
