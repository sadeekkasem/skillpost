// Detects the first YouTube link in post text and extracts a strictly validated video ID.
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const URL_RE = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/i;

export type YouTubeMatch = { id: string; start: number; url: string };

function parseStart(raw: string | null): number {
  if (!raw) return 0;
  if (/^\d+s?$/.test(raw)) return parseInt(raw, 10);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !raw) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export function parseYouTubeUrl(input: string): { id: string; start: number } | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts[1]) id = parts[1];
  }
  if (!id || !ID_RE.test(id)) return null;
  const start = parseStart(u.searchParams.get("t") ?? u.searchParams.get("start"));
  return { id, start: Number.isFinite(start) && start > 0 ? Math.min(start, 86400 * 2) : 0 };
}

/** First valid YouTube link in text, plus the text with that URL removed if it sat on its own line. */
export function extractYouTube(text: string): { match: YouTubeMatch | null; text: string } {
  const re = new RegExp(URL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const url = m[0].replace(/[).,!?؟،]+$/, "");
    const parsed = parseYouTubeUrl(url);
    if (!parsed) continue;
    const lines = text.split("\n");
    const idx = lines.findIndex((l) => l.trim() === url);
    const out = idx >= 0 ? lines.filter((_, i) => i !== idx).join("\n").replace(/\n{3,}/g, "\n\n").trim() : text;
    return { match: { ...parsed, url }, text: out };
  }
  return { match: null, text };
}
