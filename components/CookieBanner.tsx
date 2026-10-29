"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "@/lib/cookieConsent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  if (!visible) return null;

  function choose(value: CookieConsent) {
    setCookieConsent(value);
    setVisible(false);
  }

  return (
    <div className="cookie-banner" role="region" aria-label="ملفات تعريف الارتباط">
      <p>
        نستخدم ملفات تعريف الارتباط الضرورية لتسجيل الدخول. نود أيضًا استخدام ملفات اختيارية للإحصائيات والإعلانات.{" "}
        <Link href="/privacy">سياسة الخصوصية</Link>
      </p>
      <div className="cookie-actions">
        <button type="button" onClick={() => choose("accepted")}>قبول</button>
        <button type="button" onClick={() => choose("rejected")}>رفض</button>
      </div>
    </div>
  );
}