import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Load TypeScript sources with Node's type stripping.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { loadMushaf, ayahIndex, ayahAt, juzRange, pageRange, halfPageRanges, TOTAL_AYAT, TOTAL_PAGES, surahMeta } = await import(path.join(root, "lib/hifz/mushaf.ts"));
const { memorizedSet, summarizeProgress, firstUnmemorized, rangeMemorized } = await import(path.join(root, "lib/hifz/progress.ts"));
const { nextPortion, estimateFinish } = await import(path.join(root, "lib/hifz/portion.ts"));
const { calendarDateInZone, isoWeekday, addDays, isoWeekMonday, isDayKept, computeStreak, isFreePostpone } = await import(path.join(root, "lib/hifz/streak.ts"));

const mushaf = JSON.parse(fs.readFileSync(path.join(root, "public/data/mushaf.json"), "utf8"));
loadMushaf(mushaf);

const results = [];
function ok(cond, name) {
  results.push({ name, ok: Boolean(cond) });
  console.log(`${cond ? "ok" : "FAIL"} - ${name}`);
}

ok(mushaf.surahs.length === 114 && mushaf.pages.length === 604 && mushaf.juzs.length === 30, "mushaf catalog has 114 surahs, 30 juz, 604 pages");
ok(mushaf.surahs.reduce((n, s) => n + s.ayahs, 0) === TOTAL_AYAT, "ayah count is 6236");
ok(ayahIndex({ surah: 1, ayah: 1 }) === 0, "first ayah index is 0");
ok(ayahIndex({ surah: 114, ayah: 6 }) === TOTAL_AYAT - 1, "last ayah is index 6235");
ok(ayahAt(0).surah === 1 && ayahAt(0).ayah === 1, "ayahAt(0) is 1:1");
ok(JSON.stringify(ayahAt(TOTAL_AYAT - 1)) === JSON.stringify({ surah: 114, ayah: 6 }), "ayahAt(last) is 114:6");

const fatiha = surahMeta(1);
ok(fatiha.name === "الفاتحة" && fatiha.ayahs === 7, "Fatiha metadata");
ok(pageRange(1).start.surah === 1 && pageRange(1).end.surah === 1 && pageRange(1).end.ayah === 7, "page 1 is Al-Fatiha");
ok(pageRange(2).start.surah === 2 && pageRange(2).start.ayah === 1, "page 2 starts at Al-Baqarah 1");
ok(pageRange(604).start.surah === 112, "page 604 starts at Al-Ikhlas (Tanzil Madani)");
const juz1 = juzRange(1);
ok(juz1.start.surah === 1 && juz1.end.surah === 2 && juz1.end.ayah === 141, "juz 1 ends at 2:141");
const juz30 = juzRange(30);
ok(juz30.start.surah === 78 && juz30.end.surah === 114, "juz 30 is An-Naba to An-Nas");

const empty = memorizedSet([]);
ok(firstUnmemorized(empty, { surah: 1, ayah: 1 }, 1)?.ayah === 1, "first gap on empty set is 1:1");
const plan = {
  id: "p",
  goal: "new",
  amountUnit: "ayat",
  amountValue: 5,
  start: { surah: 1, ayah: 1 },
  fromEnd: false,
  memorizeWeekdays: [1, 2, 3, 4, 5],
  reviseWeekdays: [1, 2, 3, 4, 5, 6, 7],
  restWeekdays: [7],
  timezone: "Europe/Helsinki",
  isActive: true,
};
let portion = nextPortion(plan, empty);
ok(portion && portion.start.surah === 1 && portion.start.ayah === 1 && portion.end.ayah === 5 && portion.ayahCount === 5, "first 5-ayat portion is Fatiha 1–5: " + (portion && portion.label));

const afterFirst = memorizedSet([{ start: portion.start, end: portion.end, status: "memorized" }]);
portion = nextPortion(plan, afterFirst);
ok(portion && portion.start.ayah === 6 && portion.end.ayah === 7 && portion.end.surah === 2 && portion.end.ayah === 3 || (portion && portion.start.surah === 1 && portion.start.ayah === 6), "next portion continues after the first 5");
// 6,7 of Fatiha then 1,2,3 of Baqarah = 5 ayat
ok(portion && portion.ayahCount === 5 && portion.end.surah === 2 && portion.end.ayah === 3, "portion wraps into Al-Baqarah 1–3");

const fromEndPlan = { ...plan, fromEnd: true, start: { surah: 114, ayah: 6 }, amountValue: 3 };
portion = nextPortion(fromEndPlan, empty);
ok(portion && portion.start.surah === 114 && portion.start.ayah === 4 && portion.end.ayah === 6, "from-end 3 ayat is An-Nas 4–6");

const pagePlan = { ...plan, amountUnit: "page", amountValue: 1 };
portion = nextPortion(pagePlan, empty);
ok(portion && portion.start.surah === 1 && portion.end.surah === 1 && portion.end.ayah === 7, "page unit from the start is all of page 1 (Fatiha)");

const half = halfPageRanges(2);
ok(half.first.start.ayah === 1 && half.second.start.ayah === half.first.end.ayah + 1, "half-page split is contiguous");

const estimated = estimateFinish(plan, empty);
ok(estimated && estimated.remainingAyat === TOTAL_AYAT && estimated.daysNeeded === Math.ceil(TOTAL_AYAT / 5), "estimate uses remaining ayat and weekday count");

const allMem = memorizedSet([{ start: { surah: 1, ayah: 1 }, end: { surah: 114, ayah: 6 }, status: "memorized" }]);
const done = summarizeProgress(allMem);
ok(done.memorizedAyat === TOTAL_AYAT && done.percent === 100 && done.juzEquivalent === 30, "full mushaf is 30 juz and 100%");
ok(nextPortion(plan, allMem) === null, "no portion when everything is memorized");

const halfBits = memorizedSet([{ start: juzRange(1).start, end: juzRange(1).end, status: "memorized" }]);
const mid = summarizeProgress(halfBits);
ok(mid.memorizedAyat === 148 && mid.juzEquivalent === 0.71, "juz 1 is 148 ayat, 0.71 juz-equivalent by ayah share: " + mid.juzEquivalent);
ok(rangeMemorized(halfBits, juzRange(1).start, juzRange(1).end) === "all", "juz 1 marked all");
ok(rangeMemorized(halfBits, juzRange(2).start, juzRange(2).end) === "none", "juz 2 still empty");

// Timezone: 21 Nov 2026 22:30 UTC is already 22 Nov 00:30 in Helsinki (UTC+2).
ok(calendarDateInZone(new Date("2026-11-21T22:30:00Z"), "Europe/Helsinki") === "2026-11-22", "Helsinki date rolls to 22 Nov after 00:00 EET");
ok(calendarDateInZone(new Date("2026-11-21T22:30:00Z"), "UTC") === "2026-11-21", "same instant stays 21 Nov in UTC");
ok(isoWeekday("2026-11-21") === 6, "21 Nov 2026 is Saturday");
ok(isoWeekMonday("2026-11-21", "Europe/Helsinki") === "2026-11-16", "ISO week starts Monday 16 Nov");

const restPlan = { restWeekdays: [7] };
const logs = [
  { logDate: "2026-11-16", newCompleted: true, postponed: false, isRestDay: false },
  { logDate: "2026-11-17", newCompleted: true, postponed: false, isRestDay: false },
  { logDate: "2026-11-18", newCompleted: false, postponed: true, isRestDay: false },
];
ok(isFreePostpone("2026-11-18", logs.filter((l) => l.logDate !== "2026-11-18"), "Europe/Helsinki") === true, "first postpone of the week is free");
ok(isDayKept("2026-11-18", restPlan, logs, "Europe/Helsinki") === true, "free postpone keeps the day");
const logs2 = logs.concat([{ logDate: "2026-11-19", newCompleted: false, postponed: true, isRestDay: false }]);
ok(isFreePostpone("2026-11-19", logs2, "Europe/Helsinki") === false, "second postpone in the same week is not free");
ok(isDayKept("2026-11-19", restPlan, logs2, "Europe/Helsinki") === false, "second postpone does not keep the streak");
ok(isDayKept("2026-11-22", restPlan, [], "Europe/Helsinki") === true, "Sunday rest day keeps the streak with no log");

// Streak: Mon-Tue completed, Wed postponed (free), Thu missed (not rest), Fri would be 0 if today is Thu.
const streak = computeStreak("2026-11-18", restPlan, logs, "Europe/Helsinki", "2026-11-16");
ok(streak.current === 3, "current streak is 3 (Mon, Tue, free postpone Wed): " + streak.current);
ok(streak.longest === 3, "longest is 3");

const missed = computeStreak("2026-11-19", restPlan, logs, "Europe/Helsinki", "2026-11-16");
ok(missed.current === 3 && missed.lastActiveDate === "2026-11-18", "an unfinished today does not break yesterday's streak");

const broken = computeStreak("2026-11-20", restPlan, logs, "Europe/Helsinki", "2026-11-16");
ok(broken.current === 0 && broken.longest === 3, "after skipping Thursday, Friday current is 0 and longest stays 3: " + JSON.stringify(broken));

const html = fs.readFileSync(path.join(root, "app/hifz/page.tsx"), "utf8");
ok(html.includes("رفيق الحفظ"), "hifz page exists");
const chrome = fs.readFileSync(path.join(root, "app/components/SiteChrome.tsx"), "utf8");
ok(chrome.includes('href: "/hifz"'), "SiteChrome links to /hifz");
const index = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
ok(index.includes('href="/hifz"'), "public index links to /hifz");
const mig = fs.readFileSync(path.join(root, "supabase/migrations/20261121120000_hifz_companion.sql"), "utf8");
ok(mig.includes("CREATE TABLE public.hifz_plans"), "migration creates hifz_plans");
ok(mig.includes("CREATE TABLE public.hifz_segments"), "migration creates hifz_segments");
ok(mig.includes("CREATE TABLE public.hifz_daily_logs"), "migration creates hifz_daily_logs");
ok(mig.includes("CREATE TABLE public.hifz_streaks"), "migration creates hifz_streaks");
ok(mig.includes("(select auth.uid())"), "RLS uses (select auth.uid())");
ok(mig.includes("interval_days") && mig.includes("due_date") && mig.includes("lapses") && mig.includes("ease"), "segments are forward-compatible with review scheduling");
ok(fs.readFileSync(path.join(root, "public/sources.html"), "utf8").includes("quran-data.xml"), "sources cite Tanzil metadata");
ok(fs.readFileSync(path.join(root, "public/privacy.html"), "utf8").includes("رفيق الحفظ"), "privacy mentions hifz account data");

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(failed.length + " failed");
  process.exit(1);
}
console.log("All hifz unit checks passed (" + results.length + ")");
