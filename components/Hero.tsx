"use client";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";

export default function Hero() {
  const t = useT();

  return (
    <section className="hero feed-hero">
      <h1>{t("hero.title")}</h1>
      <p>{t("hero.subtitle")}</p>
      <div className="hero-actions">
        <Link className="button" href="/projects/new">
          {t("hero.ctaPublish")}
        </Link>
        <Link className="button hero-secondary" href="/search">
          {t("hero.ctaBrowse")}
        </Link>
      </div>
    </section>
  );
}
