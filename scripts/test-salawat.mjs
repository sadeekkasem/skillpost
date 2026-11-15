// Tests for the salawat page: verbatim HadeethEnc texts, local-only counter, nav/sitemap wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../public/salawat-core.js");
const hadithCore = require("../public/hadith-core.js");
const CREDIT = "المصدر: موسوعة الأحاديث النبوية المترجمة – HadeethEnc.com";
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok -", name); };

const snapshot = JSON.parse(readFileSync(new URL("../public/data/hadith/hadith.json", import.meta.url), "utf8"));
const data = JSON.parse(readFileSync(new URL("../public/data/hadith/salawat.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(snapshot.hadiths.map((h) => [h.id, h]));
const selected = [...data.wordings, ...data.virtue];

t("selection is the expected Ibrahimiyya and virtue hadiths, verbatim from the snapshot", () => {
  assert.deepEqual(data.meta.ids, { wordings: ["5377"], virtue: ["65928", "65087"] });
  assert.equal(data.wordings.length, 1);
  assert.equal(data.virtue.length, 2);
  assert.equal(data.meta.version, snapshot.meta.version);
  assert.equal(data.meta.fetchedAt, snapshot.meta.fetchedAt);
  for (const h of selected) {
    const src = byId[h.id];
    assert.ok(src, `missing source ${h.id}`);
    for (const k of ["id", "title", "hadeeth", "attribution", "grade", "reference", "book", "url"]) {
      assert.equal(h[k], src[k], `${k} drift on ${h.id}`);
    }
    assert.match(h.url, /^https:\/\/hadeethenc\.com\/ar\/browse\/hadith\/\d+$/);
  }
  assert.equal(data.wordings[0].book, "agreed");
  assert.equal(data.wordings[0].grade, "صحيح");
  assert.ok(data.wordings[0].hadeeth.includes("اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"));
  assert.ok(data.virtue.every((h) => h.book === "muslim" && h.grade === "صحيح"));
});

t("page renders texts via textContent and credits each hadith without inventing wording", () => {
  const js = readFileSync(new URL("../public/salawat.js", import.meta.url), "utf8");
  assert.match(js, /make\('p','hadith-text',h\.hadeeth\)/);
  assert.match(js, /make\('a','text-link',H\.CREDIT\)/);
  assert.match(js, /link\.href=h\.url/);
  assert.doesNotMatch(js, /supabase/i);
  assert.equal(hadithCore.CREDIT, CREDIT);
  const html = readFileSync(new URL("../public/salawat.html", import.meta.url), "utf8");
  assert.match(html, /هذا العداد خاص بك ومحفوظ على جهازك فقط/);
  assert.match(html, /اللهم صلِّ على محمد/);
  assert.match(html, /أكثروا من الصلاة على النبي ﷺ يوم الجمعة/);
  assert.match(html, /salawat-core\.js\?v=\d+\w*/);
  assert.match(html, /HadeethEnc\.com/);
  // Friday banner is a plain reminder: no invented attribution on the banner itself
  const friday = html.match(/id="salawat-friday"[\s\S]*?<\/aside>/)[0];
  assert.doesNotMatch(friday, /HadeethEnc|رواه|البخاري|مسلم|متفق/);
});

t("counter persists only in localStorage, resets by local date, and Friday uses local weekday", () => {
  const store = (() => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  })();
  const thu = new Date(2026, 10, 12, 23, 30); // Thursday local, Nov 12
  const fri = new Date(2026, 10, 13, 0, 15);  // Friday local, Nov 13
  const friEve = new Date(2026, 10, 13, 23, 59);
  const sat = new Date(2026, 10, 14, 0, 1);
  assert.equal(core.isFriday(thu), false);
  assert.equal(core.isFriday(fri), true);
  assert.equal(core.isFriday(friEve), true);
  assert.equal(core.isFriday(sat), false);
  assert.equal(core.localDate(thu), "2026-11-12");
  assert.equal(core.localDate(fri), "2026-11-13");

  let { state, ok } = core.load(thu, store);
  assert.equal(ok, true);
  assert.deepEqual(state, { total: 0, today: 0, date: "2026-11-12", goal: 100 });
  core.increment(state); core.increment(state); core.setGoal(state, 500);
  assert.equal(core.save(state, store), true);
  const again = core.load(thu, store).state;
  assert.equal(again.today, 2);
  assert.equal(again.total, 2);
  assert.equal(again.goal, 500);

  const nextDay = core.load(fri, store).state;
  assert.equal(nextDay.today, 0);
  assert.equal(nextDay.total, 2);
  assert.equal(nextDay.date, "2026-11-13");
  assert.equal(nextDay.goal, 500);
  core.increment(nextDay);
  assert.equal(nextDay.today, 1);
  assert.equal(nextDay.total, 3);
  core.reset(nextDay, fri);
  assert.equal(nextDay.today, 0);
  assert.equal(nextDay.total, 0);
  assert.equal(core.progress({ today: 50, goal: 100 }), 0.5);
  assert.equal(core.progress({ today: 200, goal: 100 }), 1);
  assert.equal(core.cleanGoal(0), 100);
  assert.equal(core.cleanGoal(1000000), 100000);
  assert.equal(core.KEY, "noor-salawat-counter");
});

t("nav, footer, sitemap and route wiring include /salawat", () => {
  const pages = ["index.html", "hadith.html", "sources.html", "privacy.html", "sheikhs.html", "salawat.html"];
  for (const name of pages) {
    const html = readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
    assert.match(html, /href="\/salawat"/, name);
    assert.match(html, /الصلاة على النبي/, name);
  }
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.match(sitemap, /https:\/\/www\.noorislamsite\.com\/salawat/);
  const cfg = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /source: "\/salawat", destination: "\/salawat\.html"/);
  assert.match(cfg, /source: "\/salawat\.html", destination: "\/salawat"/);
  const chrome = readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /href: "\/salawat"/);
});

t("page scripts never send the counter over the network", () => {
  const js = readFileSync(new URL("../public/salawat.js", import.meta.url), "utf8")
    + readFileSync(new URL("../public/salawat-core.js", import.meta.url), "utf8");
  assert.match(js, /localStorage/);
  assert.doesNotMatch(js, /fetch\([^)]*salawat-counter/i);
  assert.doesNotMatch(js, /navigator\.sendBeacon/);
  assert.doesNotMatch(js, /\bfetch\([^)]*supabase/i);
});

console.log(`\n${passed} salawat tests passed`);
