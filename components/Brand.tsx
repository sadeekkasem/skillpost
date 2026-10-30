"use client";

import Link from "next/link";
import { useT } from "@/components/LanguageProvider";

export default function Brand() {
  const t = useT();
  return (
    <Link href="/" className="brand">
      <svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#ffffff" fillOpacity="0.18" />
        <path d="M16 6l2.6 6.4L25 15l-6.4 2.6L16 24l-2.6-6.4L7 15l6.4-2.6z" fill="#ffffff" />
      </svg>
      {t("brand.name")}
    </Link>
  );
}
