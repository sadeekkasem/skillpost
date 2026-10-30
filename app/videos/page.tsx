import type { Metadata } from "next";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { getLang, getT } from "@/lib/i18n/server";
import { getChannelVideos } from "@/lib/youtube/feed";
import { YOUTUBE_CHANNEL_URL } from "@/lib/youtube/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("videos.metaTitle"), description: t("videos.metaDescription") };
}

export default async function VideosPage() {
  const t = await getT();
  const { lang } = await getLang();
  const videos = await getChannelVideos();
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", { year: "numeric", month: "long", day: "numeric" });
  return (
    <>
      <section className="hero videos-hero">
        <h1>{t("videos.title")}</h1>
        <p className="muted">{t("videos.subtitle")}</p>
        <a className="button" href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">{t("videos.subscribe")}</a>
      </section>
      {videos.length === 0 ? (
        <p className="card muted">{t("videos.empty")}</p>
      ) : (
        <div className="videos-grid">
          {videos.map((v) => {
            const d = Date.parse(v.published);
            return (
              <article className="card video-card" key={v.id}>
                <YouTubeEmbed id={v.id} />
                <h2 className="video-title" dir="auto">{v.title}</h2>
                {!Number.isNaN(d) && <time className="muted" dateTime={v.published}>{fmt.format(d)}</time>}
                {v.description && <p className="video-desc muted" dir="auto">{v.description}</p>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
