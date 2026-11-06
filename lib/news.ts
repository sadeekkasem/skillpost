export type NewsTab = "world" | "science";

export type NewsItem = {
  title: string;
  summary: string;
  link: string;
  published?: string;
  source: string;
  sourceUrl: string;
};

export type NewsFeed = {
  id: string;
  tab: NewsTab;
  /** When set, feed is only used for that UI language. */
  lang?: "ar" | "en";
  url: string;
  source: string;
  sourceAr: string;
  sourceUrl: string;
};

/** Official RSS only. Headlines + short line + link. No Al Jazeera / Al Arabiya. */
export const NEWS_FEEDS: NewsFeed[] = [
  {
    id: "bbc-ar",
    tab: "world",
    lang: "ar",
    url: "https://feeds.bbci.co.uk/arabic/rss.xml",
    source: "BBC News",
    sourceAr: "أخبار بي بي سي",
    sourceUrl: "https://www.bbc.com/arabic",
  },
  {
    id: "bbc-world",
    tab: "world",
    lang: "en",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    source: "BBC News",
    sourceAr: "أخبار بي بي سي",
    sourceUrl: "https://www.bbc.com/news/world",
  },
  {
    id: "nasa",
    tab: "science",
    url: "https://www.nasa.gov/news-release/feed/",
    source: "NASA",
    sourceAr: "ناسا",
    sourceUrl: "https://www.nasa.gov",
  },
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function stripTags(s: string): string {
  return decode(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function firstLink(item: string): string {
  // Prefer plain <link>text</link>; skip atom:link href attributes for channel.
  const m = item.match(/<link>([^<]+)<\/link>/i);
  if (m) return decode(m[1]).trim();
  const href = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  return href ? decode(href[1]).trim() : "";
}

function shorten(s: string, max = 160): string {
  const t = stripTags(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function parseRssItems(xml: string, feed: NewsFeed, limit = 12): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const title = stripTags(tag(block, "title"));
    const link = firstLink(block);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    const desc = tag(block, "description") || tag(block, "content:encoded");
    out.push({
      title,
      summary: shorten(desc),
      link,
      published: tag(block, "pubDate") || undefined,
      source: feed.source,
      sourceUrl: feed.sourceUrl,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function feedsFor(tab: NewsTab, lang: "ar" | "en"): NewsFeed[] {
  return NEWS_FEEDS.filter((f) => f.tab === tab && (!f.lang || f.lang === lang));
}
