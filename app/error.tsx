"use client";
import { useT } from "@/components/LanguageProvider";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <section className="card">
      <h1>{t("error.title")}</h1>
      <p>{t("error.body")}</p>
      <button onClick={reset}>{t("error.retry")}</button>
    </section>
  );
}
