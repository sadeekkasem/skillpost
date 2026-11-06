import type { Metadata } from "next";
import NewsClient from "@/components/NewsClient";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("news.metaTitle"), description: t("news.metaDescription") };
}

export default function NewsPage() {
  return <NewsClient />;
}
