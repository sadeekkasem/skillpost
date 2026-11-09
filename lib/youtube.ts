export type YouTubeVideo = {
  ok: true;
  kind: "video";
  id: string;
  embed: string;
};

export type YouTubePlaylist = {
  ok: true;
  kind: "playlist";
  id: string;
  embed: string;
};

export type YouTubeChannel = {
  ok: true;
  kind: "channel";
  id: string;
  url: string;
};

export type YouTubeFailure = { ok: false; error: string };

export type YouTubeParse = YouTubeVideo | YouTubePlaylist | YouTubeFailure;
export type YouTubeChannelParse = YouTubeChannel | YouTubeFailure;

const VID = /^[A-Za-z0-9_-]{11}$/;
const LIST = /^[A-Za-z0-9_-]{10,64}$/;
const HANDLE = /^@[\w.]{3,30}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{20,24}$/;
const NC = "https://www.youtube-nocookie.com/embed/";

const HOSTS: Record<string, "yt" | "short" | "nc"> = {
  "youtube.com": "yt",
  "www.youtube.com": "yt",
  "m.youtube.com": "yt",
  "youtu.be": "short",
  "www.youtu.be": "short",
  "youtube-nocookie.com": "nc",
  "www.youtube-nocookie.com": "nc",
};

const E = {
  empty: "الصق رابط فيديو أو قائمة تشغيل من YouTube.",
  emptyChannel: "الصق رابط قناة من YouTube.",
  scheme: "الرابط مرفوض: يُقبل http أو https فقط (لا javascript: ولا data: ولا غيرها).",
  bad: "هذا ليس رابطًا صالحًا.",
  host: "الرابط ليس من YouTube. يُقبل فقط youtube.com وyoutu.be وyoutube-nocookie.com.",
  cred: "الرابط يحتوي بيانات دخول أو منفذًا غير معتاد؛ مرفوض.",
  channel: "هذا رابط قناة، ولا يمكن تضمين قناة كمشغّل دون واجهة YouTube البرمجية. الصق رابط فيديو محدد أو قائمة تشغيل (list=).",
  videoAsChannel: "هذا رابط فيديو. الصق رابط القناة (@ أو channel أو c أو user).",
  vid: "معرّف الفيديو غير صالح (يجب أن يكون 11 حرفًا من A–Z وa–z و0–9 و_ و-).",
  list: "معرّف قائمة التشغيل غير صالح.",
  none: "لم يُعثر على فيديو أو قائمة تشغيل في هذا الرابط.",
  badChannel: "رابط القناة غير صالح.",
};

function video(id: string): YouTubeParse {
  return VID.test(id) ? { ok: true, kind: "video", id, embed: NC + id } : { ok: false, error: E.vid };
}

function playlist(id: string): YouTubeParse {
  return LIST.test(id)
    ? { ok: true, kind: "playlist", id, embed: `${NC}videoseries?list=${id}` }
    : { ok: false, error: E.list };
}

function parseUrl(input: string, emptyError: string): { ok: true; url: URL; kind: "yt" | "short" | "nc"; seg: string[] } | YouTubeFailure {
  let s = String(input ?? "").trim();
  if (!s) return { ok: false, error: emptyError };
  if (/\s/.test(s)) return { ok: false, error: E.bad };
  const m = s.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):([\s\S]*)$/);
  let hasScheme = false;
  if (m && !/^\d+(\/|$)/.test(m[2])) {
    hasScheme = true;
    const sc = m[1].toLowerCase();
    if (sc !== "http" && sc !== "https") return { ok: false, error: E.scheme };
  }
  if (!hasScheme) s = s.startsWith("//") ? `https:${s}` : `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: E.bad };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: E.scheme };
  if (u.username || u.password || u.port) return { ok: false, error: E.cred };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const kind = HOSTS[host];
  if (!kind) return { ok: false, error: E.host };
  const seg = u.pathname.split("/").filter(Boolean);
  return { ok: true, url: u, kind, seg };
}

/** v13 video/playlist parser. Channel URLs are rejected for lesson embeds. */
export function parseYouTube(input: string): YouTubeParse {
  const parsed = parseUrl(input, E.empty);
  if (!parsed.ok) return parsed;
  const { url: u, kind, seg } = parsed;
  const v = u.searchParams.get("v");
  const list = u.searchParams.get("list");
  if (kind === "short") {
    if (seg.length >= 1) return video(seg[0]);
    return list ? playlist(list) : { ok: false, error: E.none };
  }
  if (kind === "nc") {
    if (seg[0] === "embed" && seg[1] === "videoseries") return list ? playlist(list) : { ok: false, error: E.list };
    if (seg[0] === "embed" && seg[1]) return video(seg[1]);
    return { ok: false, error: E.none };
  }
  const p0 = (seg[0] || "").toLowerCase();
  if (p0.startsWith("@") || p0 === "channel" || p0 === "c" || p0 === "user") {
    return { ok: false, error: E.channel };
  }
  if (p0 === "watch") {
    if (v != null) return video(v);
    if (list) return playlist(list);
    return { ok: false, error: E.none };
  }
  if (p0 === "shorts" || p0 === "live" || p0 === "v") {
    return seg[1] ? video(seg[1]) : { ok: false, error: E.vid };
  }
  if (p0 === "embed") {
    if (seg[1] === "videoseries") return list ? playlist(list) : { ok: false, error: E.list };
    return seg[1] ? video(seg[1]) : { ok: false, error: E.vid };
  }
  if (p0 === "playlist") return list ? playlist(list) : { ok: false, error: E.list };
  return { ok: false, error: E.none };
}

/** Channel URL formats added to the v13 host/scheme rules. */
export function parseYouTubeChannel(input: string): YouTubeChannelParse {
  const parsed = parseUrl(input, E.emptyChannel);
  if (!parsed.ok) return parsed;
  const { kind, seg } = parsed;
  if (kind === "short" || kind === "nc") return { ok: false, error: E.videoAsChannel };
  const p0 = seg[0] || "";
  const p0l = p0.toLowerCase();
  if (p0l === "watch" || p0l === "shorts" || p0l === "live" || p0l === "v" || p0l === "embed" || p0l === "playlist") {
    return { ok: false, error: E.videoAsChannel };
  }
  if (p0.startsWith("@")) {
    const handle = `@${p0.slice(1)}`;
    if (!HANDLE.test(handle)) return { ok: false, error: E.badChannel };
    return { ok: true, kind: "channel", id: handle, url: `https://www.youtube.com/${handle}` };
  }
  if (p0l === "channel" && seg[1]) {
    if (!CHANNEL_ID.test(seg[1])) return { ok: false, error: E.badChannel };
    return { ok: true, kind: "channel", id: seg[1], url: `https://www.youtube.com/channel/${seg[1]}` };
  }
  if (p0l === "c" && seg[1]) {
    const name = seg[1];
    if (!/^[\w.-]{2,40}$/.test(name)) return { ok: false, error: E.badChannel };
    return { ok: true, kind: "channel", id: `c/${name}`, url: `https://www.youtube.com/c/${name}` };
  }
  if (p0l === "user" && seg[1]) {
    const name = seg[1];
    if (!/^[\w.-]{2,40}$/.test(name)) return { ok: false, error: E.badChannel };
    return { ok: true, kind: "channel", id: `user/${name}`, url: `https://www.youtube.com/user/${name}` };
  }
  return { ok: false, error: E.badChannel };
}

export function parseLessonVideoId(input: string): { ok: true; id: string } | YouTubeFailure {
  const r = parseYouTube(input);
  if (!r.ok) return r;
  if (r.kind !== "video") {
    return { ok: false, error: "الصق رابط فيديو محدد وليس قائمة تشغيل." };
  }
  return { ok: true, id: r.id };
}
