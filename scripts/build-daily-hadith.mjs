#!/usr/bin/env node
// Builds public/data/hadith/daily/MM.json (31 entries each) for "حديث اليوم" on the home page.
// Entries are copied verbatim from public/data/hadith/hadith.json (HadeethEnc.com, no modification);
// only short hadiths (< 260 characters) are used so the card stays readable. Deterministic: same input → same output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "hadith");
const db = JSON.parse(readFileSync(join(root, "hadith.json"), "utf8"));
const pool = db.hadiths
  .filter((h) => h.hadeeth.length < 260 && h.grade && h.url)
  .sort((a, b) => Number(a.id) - Number(b.id));
if (pool.length < 372) throw new Error("not enough short hadiths: " + pool.length);
const stride = pool.length / 372;
const pick = (slot) => pool[Math.floor(slot * stride)];
mkdirSync(join(root, "daily"), { recursive: true });
for (let m = 1; m <= 12; m++) {
  const items = [];
  for (let d = 1; d <= 31; d++) {
    const h = pick((m - 1) * 31 + (d - 1));
    items.push({ id: h.id, title: h.title, hadeeth: h.hadeeth, attribution: h.attribution, grade: h.grade, reference: h.reference, url: h.url, book: h.book, s: h.s });
  }
  const out = { source: db.meta?.source || "HadeethEnc.com", version: db.meta?.version || "", terms: "Copied verbatim from hadith.json (HadeethEnc.com). No modification.", month: m, items };
  writeFileSync(join(root, "daily", String(m).padStart(2, "0") + ".json"), JSON.stringify(out));
}
console.log("daily hadith files written from", pool.length, "short hadiths");
