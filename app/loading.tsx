"use client";
import { useT } from "@/components/LanguageProvider";

export default function Loading() {
  const t = useT();
  return <p>{t("loading.text")}</p>;
}
