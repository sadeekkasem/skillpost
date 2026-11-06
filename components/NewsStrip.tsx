"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage, useT } from "@/components/LanguageProvider";
import type { NewsItem } from "@/lib/news";

type Payload = { items: NewsItem[] };

export default function NewsStrip() {
  const t = useT();
  const { lang } = useLanguage();
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/news?tab=world&lang=${lang}&limit=4`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => {
        if (!off) setItems(d?.items?.length ? d.items.slice(0, 4) : []);
      })
      .catch(() => {
        if (!off) setItems([]);
      });
    return () => {
      off = true;
    };
  }, [lang]);

  if (items === null) return <div className="news-strip is-loading" aria-hidden />;
  if (!items.length) return null;

  return (
    <section className="news-strip">
      <div className="news-strip-head">
        <h2>{t("news.stripTitle")}</h2>
        <Link href="/news">{t("news.more")}</Link>
      </div>
      <ul className="news-strip-list">
        {items.map((it) => (
          <li key={it.link}>
            <a href={it.link} target="_blank" rel="noopener noreferrer" dir="auto">
              <span className="news-item-title">{it.title}</span>
              {it.summary ? <span className="news-item-summary muted">{it.summary}</span> : null}
              <span className="news-item-source">
                {lang === "ar" && it.source === "BBC News" ? t("news.source.bbc") : it.source}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="news-credit muted">{t("news.credit.bbc")}</p>
    </section>
  );
}
