#!/usr/bin/env node
// Usage: node scripts/youtube-channel-check.mjs <channel URL | @handle | UC... id> [count=10]
// Resolves the channel ID, reads the RSS feed, and checks each latest video's embeddability via oEmbed.
const [input, countArg] = process.argv.slice(2);
if (!input) { console.error("Usage: node scripts/youtube-channel-check.mjs <url|@handle|channelId> [count]"); process.exit(2); }
const count = Number(countArg) || 10;
const UA = { "user-agent": "Mozilla/5.0", "accept-language": "en" };

function toUrl(s) {
  if (/^UC[\w-]{22}$/.test(s)) return null;
  if (/^https?:\/\//.test(s)) return s;
  return `https://www.youtube.com/${s.startsWith("@") ? s : "@" + s}`;
}

async function resolveId(s) {
  if (/^UC[\w-]{22}$/.test(s)) return { id: s };
  const url = toUrl(s);
  const html = await (await fetch(url, { headers: UA })).text();
  const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1]
    || html.match(/"externalId":"(UC[\w-]{22})"/)?.[1]
    || html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error(`Could not resolve channel ID from ${url}`);
  const name = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
  return { id, name, url };
}

const decode = (t) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const ch = await resolveId(input);
console.log(`Channel: ${ch.name ?? "?"}\nID: ${ch.id}${ch.url ? `\nURL: ${ch.url}` : ""}`);
const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { headers: UA });
if (!res.ok) { console.error(`RSS failed: HTTP ${res.status}`); process.exit(1); }
const xml = await res.text();
const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, count).map((m) => ({
  id: m[1].match(/<yt:videoId>([^<]+)</)?.[1],
  title: decode(m[1].match(/<title>([^<]*)</)?.[1] ?? ""),
  published: m[1].match(/<published>([^<]+)</)?.[1],
}));
console.log(`RSS OK: ${entries.length} latest videos checked\n`);
const bad = [];
for (const v of entries) {
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`);
  const ok = r.ok;
  if (!ok) bad.push({ ...v, status: r.status });
  console.log(`${ok ? "✓" : "✗"} ${v.id} ${v.published?.slice(0, 10)} ${v.title}${ok ? "" : ` (HTTP ${r.status})`}`);
}
console.log(bad.length ? `\n${bad.length} NOT embeddable: ${bad.map((b) => b.id).join(", ")}` : "\nAll embeddable.");
console.log(`\nConfig entry:\n  { id: "${ch.id}", handle: "${ch.url?.match(/@[^/?]+/)?.[0] ?? ""}", name: ${JSON.stringify(ch.name ?? "")}, url: "${ch.url ?? `https://www.youtube.com/channel/${ch.id}`}" },`);
process.exit(bad.length ? 1 : 0);
