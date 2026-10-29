"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import { safeLink } from "@/lib/safeLink";

type ActiveAd = {
  id: string;
  title: string;
  description: string;
  target_url: string;
  starts_at: string;
  ends_at: string;
};

export default function ActiveAds() {
  const [db] = useState(() => getClient());
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!db) return;

    const client = db;
    let cancelled = false;
    let fetching = false;

    async function load() {
      if (fetching || cancelled) return;

      fetching = true;

      try {
        const { data, error } = await client.rpc(
          "get_active_ads"
        );

        if (cancelled) return;

        if (error) {
          setAds([]);
          return;
        }

        setAds((data ?? []) as ActiveAd[]);
        setNow(Date.now());
      } catch {
        if (!cancelled) {
          setAds([]);
        }
      } finally {
        fetching = false;
      }
    }

    function refresh() {
      setNow(Date.now());
      void load();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    void load();

    const interval = window.setInterval(refresh, 60_000);

    window.addEventListener("focus", refresh);
    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [db]);

  useEffect(() => {
    const upcomingEnds = ads
      .map((ad) => Date.parse(ad.ends_at))
      .filter((end) => Number.isFinite(end) && end > now);

    if (upcomingEnds.length === 0) return;

    const nextEnd = Math.min(...upcomingEnds);

    const delay = Math.min(
      Math.max(nextEnd - Date.now() + 100, 0),
      2_147_483_647
    );

    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [ads, now]);

  const visibleAds = ads.filter((ad) => {
    const startsAt = Date.parse(ad.starts_at);
    const endsAt = Date.parse(ad.ends_at);

    return (
      Number.isFinite(startsAt) &&
      Number.isFinite(endsAt) &&
      startsAt <= now &&
      endsAt > now &&
      safeLink(ad.target_url) !== null
    );
  });

  if (visibleAds.length === 0) return null;

  return (
    <section
      aria-label="إعلانات مدفوعة"
      style={{ marginBottom: 24 }}
    >
      <h2>إعلانات</h2>

      <div
        className="grid"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 16,
        }}
      >
        {visibleAds.map((ad) => {
          const href = safeLink(ad.target_url);

          if (!href) return null;

          return (
            <article
              key={ad.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflowWrap: "anywhere",
              }}
            >
              <span className="badge">
                إعلان مدفوع
              </span>

              <h3 style={{ margin: 0 }}>{ad.title}</h3>

              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {ad.description}
              </p>

              <a
                href={href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="button"
                style={{
                  marginTop: "auto",
                  alignSelf: "flex-start",
                }}
              >
                زيارة موقع المعلن
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}