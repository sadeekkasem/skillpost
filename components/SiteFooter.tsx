"use client";

import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import AddToHomeScreen from "@/components/AddToHomeScreen";

export default function SiteFooter() {
  const t = useT();
  return (
    <footer>
      <Link href="/about">{t("footer.about")}</Link> ·{" "}
      <Link href="/news">{t("footer.news")}</Link> ·{" "}
      <Link href="/privacy">{t("footer.privacy")}</Link> ·{" "}
      <Link href="/terms">{t("footer.terms")}</Link> ·{" "}
      <Link href="/advertise">{t("footer.advertise")}</Link>
      <AddToHomeScreen />
    </footer>
  );
}
