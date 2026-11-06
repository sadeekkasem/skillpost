import type { Metadata } from "next";
import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";
import { absoluteUrl } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = `${t("search.title")} | SkillPost`;
  const description = t("search.metaDescription");
  const url = absoluteUrl("/search");
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "SkillPost",
      title: t("search.title"),
      description,
      url,
    },
    twitter: { card: "summary_large_image", title: t("search.title"), description },
  };
}

export default async function SearchPage() {
  const t = await getT();
  return (
    <Suspense fallback={<p>{t("search.loading")}</p>}>
      <SearchClient />
    </Suspense>
  );
}
