import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";

export const metadata = { title: "البحث | SkillPost" };

export default function SearchPage() {
  return (
    <Suspense fallback={<p>جارٍ التحميل...</p>}>
      <SearchClient />
    </Suspense>
  );
}
