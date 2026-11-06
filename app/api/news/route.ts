import { NextResponse } from "next/server";
import { feedsFor, parseRssItems, type NewsItem, type NewsTab } from "@/lib/news";
import { isLang, type Lang } from "@/lib/i18n";

const UA = "SkillPost/1.0 https://www.skillpostapp.com sadeekkasem@gmail.com";

function isTab(v: string | null): v is NewsTab {
  return v === "world" || v === "science";
}

async function loadFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    next: { revalidate: 3600 },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tab = isTab(sp.get("tab")) ? (sp.get("tab") as NewsTab) : "world";
  const langParam = sp.get("lang");
  const lang: Lang = isLang(langParam) ? langParam : "ar";
  const limit = Math.min(Number(sp.get("limit") || 12) || 12, 20);

  try {
    const feeds = feedsFor(tab, lang);
    const items: NewsItem[] = [];
    const attributions: { source: string; sourceAr: string; sourceUrl: string }[] = [];

    for (const feed of feeds) {
      try {
        const xml = await loadFeed(feed.url);
        items.push(...parseRssItems(xml, feed, limit));
        attributions.push({
          source: feed.source,
          sourceAr: feed.sourceAr,
          sourceUrl: feed.sourceUrl,
        });
      } catch {
        // skip failed feed
      }
    }

    const seen = new Set<string>();
    const unique = items.filter((it) => {
      if (seen.has(it.link)) return false;
      seen.add(it.link);
      return true;
    }).slice(0, limit);

    return NextResponse.json(
      { tab, lang, items: unique, attributions },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
