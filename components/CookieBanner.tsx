"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "@/lib/cookieConsent";

export default function CookieBanner() {
  const { t, chosen } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  // Wait until the first-visit language picker is answered so the two never overlap.
  if (!visible || !chosen) return null;

  function choose(value: CookieConsent) {
    setCookieConsent(value);
    setVisible(false);
  }

  return (
    <div className="cookie-banner" role="region" aria-label={t("cookie.label")}>
      <p>
        {t("cookie.text")}{" "}
        <Link href="/privacy">{t("cookie.privacy")}</Link>
      </p>
      <div className="cookie-actions">
        <button type="button" onClick={() => choose("accepted")}>{t("cookie.accept")}</button>
        <button type="button" onClick={() => choose("rejected")}>{t("cookie.reject")}</button>
      </div>
    </div>
  );
}