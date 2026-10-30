"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className="lang-toggle"
      lang={next}
      aria-label={t("nav.switchLanguageLabel")}
      onClick={() => setLang(next)}
    >
      <span className="lang-toggle-full">{t("nav.switchLanguage")}</span>
      <span className="lang-toggle-short" aria-hidden="true">{next === "en" ? "EN" : "ع"}</span>
    </button>
  );
}
