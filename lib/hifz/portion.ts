import {
  ayahAt,
  ayahCountInRange,
  ayahIndex,
  formatRange,
  halfPageRanges,
  isValidRef,
  pageOfAyah,
  pageRange,
  stepAyah,
  surahMeta,
  TOTAL_AYAT,
} from "./mushaf";
import { firstUnmemorized as firstGap, remainingAyatFrom as remaining } from "./progress";
import type { AmountUnit, AyahRef, Plan, Portion } from "./types";

function takeForward(start: AyahRef, count: number): AyahRef {
  const endIndex = Math.min(ayahIndex(start) + count - 1, TOTAL_AYAT - 1);
  return ayahAt(endIndex);
}

function takeBackward(start: AyahRef, count: number): AyahRef {
  const endIndex = Math.max(ayahIndex(start) - count + 1, 0);
  return ayahAt(endIndex);
}

export function amountAyatForUnit(unit: AmountUnit, value: number, from: AyahRef, direction: 1 | -1): number {
  if (unit === "ayat") return Math.max(1, value);
  const pageId = pageOfAyah(from);
  if (unit === "page") {
    const page = pageRange(pageId);
    // If we start mid-page, take the rest of this page in the travel direction.
    if (direction === 1) return ayahCountInRange(from, page.end);
    return ayahCountInRange(page.start, from);
  }
  // half_page
  const halves = halfPageRanges(pageId);
  const idx = ayahIndex(from);
  const firstEnd = ayahIndex(halves.first.end);
  const inFirst = idx <= firstEnd;
  const half = inFirst ? halves.first : halves.second;
  if (direction === 1) return ayahCountInRange(from, half.end);
  return ayahCountInRange(half.start, from);
}

export function nextPortion(plan: Pick<Plan, "amountUnit" | "amountValue" | "start" | "fromEnd">, bits: Uint8Array): Portion | null {
  const direction: 1 | -1 = plan.fromEnd ? -1 : 1;
  const from = firstGap(bits, plan.start, direction);
  if (!from) return null;
  const count = amountAyatForUnit(plan.amountUnit, plan.amountValue, from, direction);
  const end = direction === 1 ? takeForward(from, count) : takeBackward(from, count);
  const start = direction === 1 ? from : end;
  const finish = direction === 1 ? end : from;
  const ayahCount = ayahCountInRange(start, finish);
  return { start, end: finish, ayahCount, label: formatRange(start, finish) };
}

const AYAT_PER_UNIT_ESTIMATE: Record<AmountUnit, (value: number) => number> = {
  ayat: (v) => Math.max(1, v),
  half_page: () => 8, // typical Madani half-page; used only for the estimate line
  page: () => 15,
};

export function estimateFinish(plan: Pick<Plan, "amountUnit" | "amountValue" | "start" | "fromEnd" | "memorizeWeekdays">, bits: Uint8Array): {
  remainingAyat: number;
  daysNeeded: number;
  weeks: number;
  label: string;
} | null {
  const direction: 1 | -1 = plan.fromEnd ? -1 : 1;
  const remainingAyat = remaining(bits, plan.start, direction);
  if (remainingAyat <= 0) {
    return { remainingAyat: 0, daysNeeded: 0, weeks: 0, label: "أتممت المقدار المحدد في خطتك." };
  }
  const daysPerWeek = new Set(plan.memorizeWeekdays).size;
  if (daysPerWeek === 0) {
    return { remainingAyat, daysNeeded: 0, weeks: 0, label: "حدد أيام الحفظ ليحسب التقدير." };
  }
  const perDay = AYAT_PER_UNIT_ESTIMATE[plan.amountUnit](plan.amountValue);
  const daysNeeded = Math.ceil(remainingAyat / perDay);
  const weeks = Math.ceil(daysNeeded / daysPerWeek);
  const years = Math.floor(weeks / 52);
  const weekRest = weeks % 52;
  let when: string;
  if (weeks <= 1) when = "في نحو أسبوع";
  else if (years < 1) when = "في نحو " + weeks + " أسبوعاً";
  else if (weekRest === 0) when = "في نحو " + years + (years === 1 ? " سنة" : " سنوات");
  else when = "في نحو " + years + (years === 1 ? " سنة" : " سنوات") + " و" + weekRest + " أسبوعاً";
  return { remainingAyat, daysNeeded, weeks, label: "بهذا المعدل تختم " + when + "." };
}

export function defaultStart(fromEnd: boolean): AyahRef {
  return fromEnd ? { surah: 114, ayah: 6 } : { surah: 1, ayah: 1 };
}

export function parseStart(surah: number, ayah: number): AyahRef | null {
  const ref = { surah, ayah };
  return isValidRef(ref) ? ref : null;
}

export function weekdayName(day: number): string {
  return ["", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"][day] ?? "";
}

export { surahMeta };
