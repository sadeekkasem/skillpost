"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { translator, type Lang } from "@/lib/i18n";

/** First-visit language chooser. Rendered only on the client, so crawlers still get the page. */
export default function LanguagePicker() {
  const { chosen, ready, setLang } = useLanguage();
  const [suggested, setSuggested] = useState<Lang>("ar");

  useEffect(() => {
    const nav = (navigator.language || "").toLowerCase();
    setSuggested(nav.startsWith("ar") || !nav ? "ar" : "en");
  }, []);

  if (!ready || chosen) return null;

  const t = translator(suggested);

  return (
    <div className="lang-picker-backdrop">
      <div
        className="lang-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lang-picker-title"
        dir={suggested === "ar" ? "rtl" : "ltr"}
      >
        <h2 id="lang-picker-title">{t("picker.title")}</h2>
        <p className="lang-picker-sub">{t("picker.subtitle")}</p>
        <div className="lang-picker-actions">
          <button
            type="button"
            lang="ar"
            className={suggested === "ar" ? "suggested" : "secondary"}
            autoFocus={suggested === "ar"}
            onClick={() => setLang("ar")}
          >
            العربية
          </button>
          <button
            type="button"
            lang="en"
            className={suggested === "en" ? "suggested" : "secondary"}
            autoFocus={suggested === "en"}
            onClick={() => setLang("en")}
          >
            English
          </button>
        </div>
        <p className="muted lang-picker-hint">{t("picker.hint")}</p>
      </div>
    </div>
  );
}
