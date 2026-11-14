#!/usr/bin/env node
// Reproducible snapshot of HadeethEnc.com (موسوعة الأحاديث النبوية المترجمة), Arabic.
// Keeps ONLY hadiths attributed to Sahih al-Bukhari, Sahih Muslim, or «متفق عليه».
// Text, grade, attribution, reference, explanation (الشرح), hints (الفوائد) and words_meanings
// are stored byte-for-byte as returned by the API. Sharh goes to public/data/hadith/sharh/<n>.json.
//
// Usage: node scripts/fetch-hadeethenc.mjs            (uses cache in .cache/hadeethenc)
//        HADEETHENC_REFRESH=1 node scripts/fetch-hadeethenc.mjs   (re-download everything)
// Terms (https://documenter.getpostman.com/view/5211979/TVev3j7q): no modification, addition
// or deletion of the content; clearly refer to the publisher and the source (HadeethEnc.com).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { classify } from "./hadith-filter.mjs";

const API = "https://hadeethenc.com/api/v1";
const LANG = "ar";
const DELAY_MS = Number(process.env.HADEETHENC_DELAY_MS || 350); // polite throttle
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache", "hadeethenc");
const OUT_DIR = path.join(ROOT, "public", "data", "hadith");
const REFRESH = process.env.HADEETHENC_REFRESH === "1";
const UA = "noorislamsite.com hadith snapshot (non-commercial; contact via site)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function getJson(url, cacheName) {
  const file = cacheName && path.join(CACHE, cacheName);
  if (file && !REFRESH && existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  for (let attempt = 1; ; attempt++) {
    const wait = lastCall + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text);
      if (file) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); }
      return json;
    } catch (e) {
      if (attempt >= 5) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
}

const categories = await getJson(`${API}/categories/list/?language=${LANG}`, "categories.json");
console.log(`categories: ${categories.length}`);

// 1) collect hadith ids per category (every category, paginated)
const idCats = new Map();
for (const c of categories) {
  let page = 1, last = 1;
  do {
    const r = await getJson(`${API}/hadeeths/list/?language=${LANG}&category_id=${c.id}&page=${page}&per_page=100`, `list/${c.id}-${page}.json`);
    last = Number(r.meta?.last_page || 1);
    for (const h of r.data || []) {
      if (!idCats.has(h.id)) idCats.set(h.id, new Set());
      idCats.get(h.id).add(String(c.id));
    }
    page++;
  } while (page <= last);
}
console.log(`unique hadith ids: ${idCats.size}`);

// 2) fetch hadiths in batches of 50 via /hadeeths/multiple (same fields as /hadeeths/one), cache per id
const allIds = [...idCats.keys()].sort((a, b) => Number(a) - Number(b));
const missing = allIds.filter((id) => REFRESH || !existsSync(path.join(CACHE, "one", `${id}.json`)));
for (let i = 0; i < missing.length; i += 50) {
  const batch = missing.slice(i, i + 50);
  const items = await getJson(`${API}/hadeeths/multiple/?language=${LANG}&ids=${batch.join(",")}`, null);
  await mkdir(path.join(CACHE, "one"), { recursive: true });
  for (const it of items) await writeFile(path.join(CACHE, "one", `${it.id}.json`), JSON.stringify(it));
  console.log(`  fetched ${Math.min(i + 50, missing.length)}/${missing.length}`);
}
// 3) read each hadith (Arabic) and classify
const kept = [];
const SHARH_CHUNK = 100;
const sharh = [];
const counts = { total: 0, agreed: 0, both: 0, bukhari: 0, muslim: 0, excluded: 0 };
const excludedSamples = {};
let n = 0;
for (const id of allIds) {
  const h = await getJson(`${API}/hadeeths/one/?language=${LANG}&id=${id}`, `one/${id}.json`); // falls back to single fetch if a batch skipped it
  if (++n % 250 === 0) console.log(`  ${n}/${idCats.size}`);
  counts.total++;
  const book = classify(h);
  if (!book) {
    counts.excluded++;
    excludedSamples[h.attribution] = (excludedSamples[h.attribution] || 0) + 1;
    continue;
  }
  counts[book]++;
  const cats = new Set([...(h.categories || []).map(String), ...idCats.get(id)]);
  kept.push({
    id: String(h.id),
    title: h.title,
    hadeeth: h.hadeeth,
    attribution: h.attribution,
    grade: h.grade,
    reference: h.reference,
    book,
    categories: [...cats].sort((a, b) => Number(a) - Number(b)),
    url: `https://hadeethenc.com/ar/browse/hadith/${h.id}`,
    s: Math.floor(kept.length / SHARH_CHUNK),
  });
  // الشرح والفوائد ومعاني الكلمات: verbatim, in lazy-loaded chunk files
  const chunk = kept[kept.length - 1].s;
  (sharh[chunk] ||= {})[String(h.id)] = { explanation: h.explanation || "", hints: h.hints || [], words_meanings: h.words_meanings || [] };
}

// 4) categories that contain at least one kept hadith (with kept counts, incl. descendants)
const byId = new Map(categories.map((c) => [String(c.id), { id: String(c.id), title: c.title, parent: c.parent_id ? String(c.parent_id) : null, count: 0 }]));
for (const h of kept) {
  const seen = new Set();
  for (const cid of h.categories) {
    let cur = byId.get(cid);
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); cur.count++; cur = cur.parent ? byId.get(cur.parent) : null; }
  }
}
const cats = [...byId.values()].filter((c) => c.count > 0);

// HadeethEnc's Arabic dataset version, read from its official download redirect
// (e.g. https://hadeethenc.com/downloads/excel/HadeethEnc.com_ar-v1.8.0.xlsx). One HEAD request.
let datasetVersion = null;
try {
  const r = await fetch("https://hadeethenc.com/ar/browse/download/ar", { method: "HEAD", redirect: "manual", headers: { "User-Agent": UA } });
  const m = /HadeethEnc\.com_ar-(v\d+(?:\.\d+)*)/.exec(r.headers.get("location") || "");
  if (m) datasetVersion = m[1];
} catch {}
const fetchedAt = new Date().toISOString();
const meta = {
  source: "موسوعة الأحاديث النبوية المترجمة – HadeethEnc.com",
  sourceUrl: "https://hadeethenc.com/ar",
  api: `${API}/`,
  language: LANG,
  fetchedAt,
  datasetVersion,
  version: datasetVersion ? `HadeethEnc.com العربية ${datasetVersion}` : `HadeethEnc API v1`,
  terms: "No modification, addition, or deletion of the content. Clearly referring to the publisher and the source (HadeethEnc.com).",
  termsUrl: "https://documenter.getpostman.com/view/5211979/TVev3j7q",
  filter: "attribution (التخريج) names only al-Bukhari and/or Muslim or «متفق عليه», with no other collector, mu'allaq or أصله wording; grade plainly صحيح. See scripts/hadith-filter.mjs",
  counts: { scanned: counts.total, kept: kept.length, agreed: counts.agreed, both: counts.both, bukhari: counts.bukhari, muslim: counts.muslim, excluded: counts.excluded },
};
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, "hadith.json"), JSON.stringify({ meta, categories: cats, hadiths: kept }));
await rm(path.join(OUT_DIR, "sharh"), { recursive: true, force: true });
await mkdir(path.join(OUT_DIR, "sharh"), { recursive: true });
for (let i = 0; i < sharh.length; i++) await writeFile(path.join(OUT_DIR, "sharh", `${i}.json`), JSON.stringify(sharh[i]));
await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
await writeFile(path.join(ROOT, ".cache", "hadeethenc-excluded-attributions.json"), JSON.stringify(excludedSamples, null, 1));
console.log(JSON.stringify(meta.counts));
