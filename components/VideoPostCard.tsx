"use client";

import { useLanguage } from "@/components/LanguageProvider";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import type { ChannelVideo } from "@/lib/youtube/feed";

export default function VideoPostCard({ video }: { video: ChannelVideo }) {
  const { t, lang } = useLanguage();
  const d = new Date(video.published);
  const date = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang, { dateStyle: "medium" });
  return (
    <article className="card video-post" style={{ marginBottom: "16px" }}>
      <header className="post-head">
        <div className="post-head-main">
          <div className="video-post-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 32 32">
              <path d="M16 6l2.6 6.4L25 15l-6.4 2.6L16 24l-2.6-6.4L7 15l6.4-2.6z" fill="#ffffff" />
            </svg>
          </div>
          <div className="post-head-info">
            <div className="post-head-name-row">
              <span className="post-head-name" dir="auto">{t("posts.videoBrand")}</span>
              <span className="post-head-badge video-post-label">{t("posts.videoLabel")}</span>
            </div>
            {date && <div className="post-head-meta">{date}</div>}
          </div>
        </div>
      </header>
      <div className="video-post-body">
        <h3 className="video-post-title" dir="auto">{video.title}</h3>
        {video.description && <p className="video-post-desc" dir="auto">{video.description}</p>}
        <YouTubeEmbed id={video.id} />
        <a className="video-post-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
          {t("posts.watchOnYoutube")}
        </a>
      </div>
    </article>
  );
}
