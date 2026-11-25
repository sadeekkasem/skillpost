#!/usr/bin/env node
// Builds the compact search files used by the site assistant (public/chat.js):
//   public/data/chat/quran-text.json  — Tanzil Uthmani 1.1 text only (verbatim, with the Tanzil notice), no tafsir.
//   public/data/chat/hadith-index.json — id, title, book, grade and category titles for each hadith (verbatim from hadith.json).
// The adhkar are read at runtime from app.js data + /data/adhkar-extra.json, so they are not duplicated here.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const out = join(pub, "data", "chat");
mkdirSync(out, { recursive: true });

const verses = [];
let notice = "";
for (let s = 1; s <= 114; s++) {
  const d = JSON.parse(readFileSync(join(pub, "data", "quran", String(s).padStart(3, "0") + ".json"), "utf8"));
  notice = d.quranTextNotice;
  verses.push([s, d.name, d.verses.map((v) => v.text)]);
}
writeFileSync(join(out, "quran-text.json"), JSON.stringify({ quranTextNotice: notice, source: "Tanzil Quran Text (Uthmani, Version 1.1) — https://tanzil.net — verbatim", surahs: verses }));

const db = JSON.parse(readFileSync(join(pub, "data", "hadith", "hadith.json"), "utf8"));
const cats = Object.fromEntries(db.categories.map((c) => [c.id, c.title]));
const hadiths = db.hadiths.map((h) => [h.id, h.title, h.book, h.grade, h.categories.map((c) => cats[c]).filter(Boolean).join(" ")]);
writeFileSync(join(out, "hadith-index.json"), JSON.stringify({ source: db.meta?.source || "HadeethEnc.com", terms: "Titles and grades copied verbatim from HadeethEnc.com.", hadiths }));
const appJs = readFileSync(join(pub, "app.js"), "utf8");
const line = appJs.split("\n").find((l) => l.startsWith("const adhkarData="));
const base = JSON.parse(line.slice(line.indexOf("["), line.lastIndexOf("]") + 1));
const extra = JSON.parse(readFileSync(join(pub, "data", "adhkar-extra.json"), "utf8")).items;
const adhkar = base.map((e) => [e.category, e.label, e.text, e.count ?? null, e.sourceReference])
  .concat(extra.map((x) => [x.category, x.label, x.text, x.count ?? null, x.ref]));
writeFileSync(join(out, "adhkar.json"), JSON.stringify({ source: "Hisn al-Muslim via OpenDua 0.0.4 — verbatim", adhkar }));
console.log("chat index:", adhkar.length, "adhkar,", verses.length, "surahs,", hadiths.length, "hadiths");
