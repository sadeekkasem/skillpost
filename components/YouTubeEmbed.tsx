"use client";

import { useState } from "react";
import { useT } from "@/components/LanguageProvider";

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export default function YouTubeEmbed({ id, start = 0 }: { id: string; start?: number }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  if (!ID_RE.test(id)) return null;
  const s = Math.max(0, Math.floor(start));
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${s ? `&start=${s}` : ""}`;
  return (
    <div className="yt-embed" dir="ltr">
      {playing ? (
        <iframe
          src={src}
          title={t("post.youtubeTitle")}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button type="button" className="yt-embed-thumb" onClick={() => setPlaying(true)} aria-label={t("post.youtubePlay")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="yt-embed-play" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#f00"/><path d="M45 24 27 14v20z" fill="#fff"/></svg>
          </span>
        </button>
      )}
    </div>
  );
}
