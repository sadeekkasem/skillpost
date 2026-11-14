import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "../../lib/site";
import { SiteChrome } from "../components/SiteChrome";
import { listPublishedSheikhs } from "../../lib/islamic/published";

export const metadata: Metadata = {
  title: `المشايخ | ${SITE_NAME}`,
  description: "نعمل على إضافة صفحات المشايخ بعد موافقتهم، نرجو زيارتنا لاحقًا.",
  alternates: { canonical: `${SITE_URL}/sheikhs` },
};

export const dynamic = "force-dynamic";

export default async function SheikhsPage() {
  const sheikhs = await listPublishedSheikhs();
  return (
    <SiteChrome current="sheikhs">
      <div className="static-page">
        <div className="page-top">
          <span className="eyebrow">{sheikhs.length ? "الصفحات المنشورة" : "قريبًا"}</span>
          <h1>المشايخ</h1>
          {sheikhs.length === 0 ? (
            <>
              <p>نعمل على إضافة صفحات المشايخ بعد موافقتهم، نرجو زيارتنا لاحقًا</p>
              <div className="actions">
                <a className="button" href="/#quran-reader">القرآن الكريم ←</a>
                <a className="button secondary" href="/#adhkar-reader">الأذكار والأدعية</a>
              </div>
            </>
          ) : (
            <p>صفحات نُشرت بعد موافقة أصحابها.</p>
          )}
        </div>
        {sheikhs.length > 0 && (
          <div className="grid">
            {sheikhs.map((sheikh) => (
              <article className="card" key={sheikh.id}>
                <h2>{sheikh.name}</h2>
                <p>
                  <a className="text-link" href={`/sheikhs/${sheikh.slug}`}>افتح الصفحة ←</a>
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </SiteChrome>
  );
}
