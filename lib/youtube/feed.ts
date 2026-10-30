import { YOUTUBE_FEED_URL } from "./config";

export type ChannelVideo = { id: string; title: string; published: string; description: string };

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .trim();
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

export function parseFeed(xml: string): ChannelVideo[] {
  const out: ChannelVideo[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = tag(e, "yt:videoId");
    if (!ID_RE.test(id)) continue;
    const desc = tag(e, "media:description");
    out.push({
      id,
      title: tag(e, "title") || tag(e, "media:title"),
      published: tag(e, "published"),
      description: desc.length > 300 ? desc.slice(0, 300) + "…" : desc,
    });
  }
  return out.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
}

export async function getChannelVideos(): Promise<ChannelVideo[]> {
  try {
    const res = await fetch(YOUTUBE_FEED_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return parseFeed(await res.text());
  } catch {
    return [];
  }
}
