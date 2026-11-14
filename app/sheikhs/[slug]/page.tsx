import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "../../../lib/site";
import { notFound } from "next/navigation";
import { SiteChrome } from "../../components/SiteChrome";
import { getPublishedSheikh } from "../../../lib/islamic/published";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedSheikh(slug);
  if (!data) return { title: `غير موجود | ${SITE_NAME}`, robots: { index: false } };
  return {
    title: `${data.sheikh.name} | ${SITE_NAME}`,
    alternates: { canonical: `${SITE_URL}/sheikhs/${data.sheikh.slug}` },
  };
}

export default async function SheikhPublicPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getPublishedSheikh(slug);
  if (!data) notFound();
  const { sheikh, lessons } = data;
  return (
    <SiteChrome current="sheikhs">
      <div className="static-page">
        <div className="page-top">
          <span className="eyebrow">صفحة منشورة</span>
          <h1>{sheikh.name}</h1>
          {sheikh.youtube_channel_url ? (
            <p>
              <a className="text-link" href={sheikh.youtube_channel_url} target="_blank" rel="noopener noreferrer">رابط القناة</a>
            </p>
          ) : null}
        </div>
        {lessons.length === 0 ? (
          <p className="no-results">لا مقاطع منشورة بعد.</p>
        ) : (
          <div className="grid">
            {lessons.map((item) => (
              <article className="card" key={item.id}>
                <h2>{item.title}</h2>
                <div className="yt-facade" data-embed={`https://www.youtube-nocookie.com/embed/${item.youtube_video_id}`}>
                  <button className="button" type="button" data-yt-load>▶ تحميل المشغّل</button>
                  <p className="mini-label">لا يُحمَّل شيء من المضيف قبل النقر.</p>
                </div>
              </article>
            ))}
          </div>
        )}
        <p><a className="text-link" href="/sheikhs">← جميع الصفحات</a></p>
      </div>
    </SiteChrome>
  );
}
