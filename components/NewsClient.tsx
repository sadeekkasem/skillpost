"use client";

import { useEffect, useState } from "react";
import { useLanguage, useT } from "@/components/LanguageProvider";
import WeatherStrip from "@/components/WeatherStrip";
import RatesStrip from "@/components/RatesStrip";
import type { NewsItem, NewsTab } from "@/lib/news";

type Payload = {
  items: NewsItem[];
  attributions: { source: string; sourceAr: string; sourceUrl: string }[];
};

function sourceLabel(it: NewsItem, tBbc: string, tNasa: string) {
  if (it.source === "BBC News") return tBbc;
  if (it.source === "NASA") return tNasa;
  return it.source;
}

export default function NewsClient() {
  const t = useT();
  const { lang } = useLanguage();
  const [tab, setTab] = useState<NewsTab>("world");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true);
    fetch(`/api/news?tab=${tab}&lang=${lang}&limit=12`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => {
        if (!off) {
          setData(d?.items ? d : { items: [], attributions: [] });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!off) {
          setData({ items: [], attributions: [] });
          setLoading(false);
        }
      });
    return () => {
      off = true;
    };
  }, [tab, lang]);

  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="news-page">
      <header className="news-hero">
        <h1 className="sr-only">{t("news.title")}</h1>
        <img
          className="news-hero-img"
          src="/news-hero.svg"
          alt={t("news.heroAlt")}
          width={1200}
          height={320}
          decoding="async"
        />
      </header>

      <div className="news-context-strips">
        <WeatherStrip />
        <RatesStrip />
      </div>

      <div className="news-tabs" role="tablist" aria-label={t("news.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "world"}
          className={tab === "world" ? "is-active" : undefined}
          onClick={() => setTab("world")}
        >
          {t("news.tab.world")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "science"}
          className={tab === "science" ? "is-active" : undefined}
          onClick={() => setTab("science")}
        >
          {t("news.tab.science")}
        </button>
      </div>

      {loading ? (
        <p className="muted">{t("news.loading")}</p>
      ) : !data?.items.length ? (
        <p className="card muted">{t("news.empty")}</p>
      ) : (
        <ul className="news-list">
          {data.items.map((it) => {
            const d = it.published ? Date.parse(it.published) : NaN;
            return (
              <li className="card news-card" key={it.link}>
                <a href={it.link} target="_blank" rel="noopener noreferrer" dir="auto">
                  <h2 className="news-card-title">{it.title}</h2>
                  {it.summary ? <p className="muted news-card-summary">{it.summary}</p> : null}
                  <div className="news-card-meta">
                    <span>{sourceLabel(it, t("news.source.bbc"), t("news.source.nasa"))}</span>
                    {!Number.isNaN(d) ? <time dateTime={it.published}>{fmt.format(d)}</time> : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <p className="news-credit muted">
        {tab === "world" ? t("news.credit.bbc") : t("news.credit.nasa")}
      </p>
    </section>
  );
}
