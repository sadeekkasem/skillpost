// Tests for the Hadith page: only Bukhari / Muslim / متفق عليه, verbatim fields, credit line present.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { classify } from "./hadith-filter.mjs";

const require = createRequire(import.meta.url);
const core = require("../public/hadith-core.js");
const CREDIT = "المصدر: موسوعة الأحاديث النبوية المترجمة – HadeethEnc.com";
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok -", name); };

t("classifier keeps only Bukhari / Muslim / متفق عليه", () => {
  assert.equal(classify({ grade: "صحيح", attribution: "متفق عليه", reference: "صحيح البخاري (1/ 2) (3). صحيح مسلم (1/ 2) (3)." }), "agreed");
  assert.equal(classify({ grade: "صحيح", attribution: "رواه البخاري", reference: "صحيح البخاري (8/ 9) (6018)." }), "bukhari");
  assert.equal(classify({ grade: "صحيح", attribution: "رواه مسلم", reference: "صحيح مسلم (1/ 68) (47)." }), "muslim");
  assert.equal(classify({ grade: "صحيح", attribution: "رواه أبو داود والترمذي", reference: "سنن أبي داود (4/ 5)." }), null);
  assert.equal(classify({ grade: "صحيح", attribution: "رواه البخاري في الأدب المفرد", reference: "الأدب المفرد (1/ 2) (3)." }), null);
  assert.equal(classify({ attribution: "رواه أبو داود، وأصله في صحيح مسلم", grade: "صحيح" }), null);
  assert.equal(classify({ attribution: "رواه البخاري تعليقا", grade: "صحيح" }), null);
  assert.equal(classify({ attribution: "متفق عليه", grade: "حسن" }), null);
  assert.equal(classify({ attribution: "حديث جابر: رواه مسلم. حديث أنس: رواه البخاري", grade: "صحيح" }), "both");
});

const data = JSON.parse(readFileSync(new URL("../public/data/hadith/hadith.json", import.meta.url), "utf8"));

t("snapshot holds only Bukhari / Muslim / متفق عليه and matches its meta counts", () => {
  assert.ok(data.hadiths.length > 100, "too few hadiths");
  const books = new Set(["agreed", "both", "bukhari", "muslim"]);
  for (const h of data.hadiths) {
    assert.ok(books.has(h.book), `bad book ${h.id}`);
    assert.equal(classify(h), h.book, `classification drift ${h.id}`);
    for (const k of ["hadeeth", "grade", "attribution", "title"]) assert.ok(typeof h[k] === "string" && h[k].length, `${k} missing on ${h.id}`);
    assert.equal(typeof h.reference, "string"); // one source entry (65929) publishes an empty reference
    assert.match(h.url, /^https:\/\/hadeethenc\.com\/ar\/browse\/hadith\/\d+$/);
  }
  const c = core.counts(data.hadiths);
  assert.deepEqual([c.all, c.agreed, c.both, c.bukhari, c.muslim], [data.meta.counts.kept, data.meta.counts.agreed, data.meta.counts.both, data.meta.counts.bukhari, data.meta.counts.muslim]);
  assert.ok(data.meta.fetchedAt && data.meta.version);
});

t("UI filter returns only the chosen book and searches without diacritics", () => {
  const db = core.prepare(JSON.parse(JSON.stringify(data)));
  for (const book of ["agreed", "bukhari", "muslim"]) {
    const r = core.filter(db, { book });
    const ok = book === "agreed" ? ["agreed"] : [book, "both"];
    assert.ok(r.length > 0 && r.every((h) => ok.includes(h.book)), book);
  }
  const sample = db.hadiths[0];
  const word = core.norm(sample.hadeeth).split(" ").find((w) => w.length > 4);
  assert.ok(core.filter(db, { q: word }).includes(sample));
  const root = db.categories.find((c) => !c.parent);
  const inRoot = core.filter(db, { category: root.id });
  assert.equal(inRoot.length, root.count);
});

t("sharh chunks hold verbatim explanation/hints/word meanings for every kept hadith", () => {
  const raw = (id) => JSON.parse(readFileSync(new URL(`../.cache/hadeethenc/one/${id}.json`, import.meta.url), "utf8"));
  const chunks = {};
  for (const h of data.hadiths) {
    chunks[h.s] ||= JSON.parse(readFileSync(new URL(`../public/data/hadith/sharh/${h.s}.json`, import.meta.url), "utf8"));
    const x = chunks[h.s][h.id];
    assert.ok(x && typeof x.explanation === "string", `sharh missing ${h.id}`);
    try { const r = raw(h.id); assert.equal(x.explanation, r.explanation); assert.deepEqual(x.hints, r.hints); assert.equal(h.hadeeth, r.hadeeth); assert.equal(h.reference, r.reference); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
});

t("credit line is present on every rendered card and in the page", () => {
  assert.equal(core.CREDIT, CREDIT);
  const js = readFileSync(new URL("../public/hadith.js", import.meta.url), "utf8");
  assert.match(js, /make\('a','text-link',H\.CREDIT\);link\.href=h\.url/);
  assert.match(js, /a\.appendChild\(credit\(h\)\)/);
  assert.match(js, /body\.appendChild\(credit\(h\)\)/);
  const html = readFileSync(new URL("../public/hadith.html", import.meta.url), "utf8");
  assert.match(html, /HadeethEnc\.com/);
  assert.match(html, /hadith-core\.js\?v=\d+\w*/);
});

console.log(`\n${passed} hadith tests passed`);
