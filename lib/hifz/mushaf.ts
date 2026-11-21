import type { AyahRef } from "./types";

export type SurahMeta = { id: number; name: string; ayahs: number };
export type RangeStart = { id: number; surah: number; ayah: number };

export type MushafData = {
  source: { name: string; url: string; license: string; note: string };
  surahs: SurahMeta[];
  juzs: RangeStart[];
  pages: RangeStart[];
};

let cached: MushafData | null = null;
let starts: number[] | null = null; // absolute index of first ayah of each surah

export const TOTAL_AYAT = 6236;
export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;
export const DEFAULT_TIMEZONE = "Europe/Helsinki";

export function loadMushaf(data: MushafData): MushafData {
  if (data.surahs.length !== 114) throw new Error("mushaf: expected 114 surahs");
  const total = data.surahs.reduce((n, s) => n + s.ayahs, 0);
  if (total !== TOTAL_AYAT) throw new Error("mushaf: expected 6236 ayat");
  if (data.pages.length !== TOTAL_PAGES) throw new Error("mushaf: expected 604 pages");
  if (data.juzs.length !== TOTAL_JUZ) throw new Error("mushaf: expected 30 juz");
  cached = data;
  starts = [];
  let acc = 0;
  for (const s of data.surahs) {
    starts.push(acc);
    acc += s.ayahs;
  }
  return data;
}

export function getMushaf(): MushafData {
  if (!cached) throw new Error("mushaf data has not been loaded");
  return cached;
}

export function surahMeta(id: number): SurahMeta {
  const s = getMushaf().surahs[id - 1];
  if (!s) throw new Error("invalid surah " + id);
  return s;
}

export function isValidRef(ref: AyahRef): boolean {
  if (!Number.isInteger(ref.surah) || ref.surah < 1 || ref.surah > 114) return false;
  const s = getMushaf().surahs[ref.surah - 1];
  return Number.isInteger(ref.ayah) && ref.ayah >= 1 && ref.ayah <= s.ayahs;
}

/** 0-based absolute index. */
export function ayahIndex(ref: AyahRef): number {
  if (!starts) getMushaf();
  if (!isValidRef(ref)) throw new Error("invalid ayah " + ref.surah + ":" + ref.ayah);
  return starts![ref.surah - 1] + (ref.ayah - 1);
}

export function ayahAt(index: number): AyahRef {
  if (!starts) getMushaf();
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL_AYAT) {
    throw new Error("ayah index out of range");
  }
  let surah = 1;
  for (let i = starts!.length - 1; i >= 0; i--) {
    if (index >= starts![i]) {
      surah = i + 1;
      break;
    }
  }
  return { surah, ayah: index - starts![surah - 1] + 1 };
}

export const MUSHAF_START: AyahRef = { surah: 1, ayah: 1 };
export const MUSHAF_END: AyahRef = { surah: 114, ayah: 6 };

export function stepAyah(ref: AyahRef, direction: 1 | -1): AyahRef | null {
  const next = ayahIndex(ref) + direction;
  if (next < 0 || next >= TOTAL_AYAT) return null;
  return ayahAt(next);
}

export function ayahCountInRange(start: AyahRef, end: AyahRef): number {
  const a = ayahIndex(start);
  const b = ayahIndex(end);
  if (b < a) return b - a - 1; // negative distance when reversed; callers should order
  return b - a + 1;
}

export function orderedRange(a: AyahRef, b: AyahRef): { start: AyahRef; end: AyahRef } {
  return ayahIndex(a) <= ayahIndex(b) ? { start: a, end: b } : { start: b, end: a };
}

export function formatRef(ref: AyahRef): string {
  return surahMeta(ref.surah).name + " " + ref.ayah;
}

export function formatRange(start: AyahRef, end: AyahRef): string {
  const name = surahMeta(start.surah).name;
  if (start.surah === end.surah) {
    return start.ayah === end.ayah ? name + " " + start.ayah : name + " " + start.ayah + "–" + end.ayah;
  }
  return formatRef(start) + " – " + formatRef(end);
}

function rangeFromStarts(startsList: RangeStart[], id: number): { start: AyahRef; end: AyahRef } {
  const item = startsList[id - 1];
  if (!item) throw new Error("invalid range id " + id);
  const start: AyahRef = { surah: item.surah, ayah: item.ayah };
  if (id === startsList.length) return { start, end: MUSHAF_END };
  const next = startsList[id];
  const endIndex = ayahIndex({ surah: next.surah, ayah: next.ayah }) - 1;
  return { start, end: ayahAt(endIndex) };
}

export function juzRange(id: number): { start: AyahRef; end: AyahRef } {
  return rangeFromStarts(getMushaf().juzs, id);
}

export function pageRange(id: number): { start: AyahRef; end: AyahRef } {
  return rangeFromStarts(getMushaf().pages, id);
}

export function pageOfAyah(ref: AyahRef): number {
  const pages = getMushaf().pages;
  const idx = ayahIndex(ref);
  let lo = 0;
  let hi = pages.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = ayahIndex({ surah: pages[mid].surah, ayah: pages[mid].ayah });
    if (start <= idx) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

export function juzOfAyah(ref: AyahRef): number {
  const juzs = getMushaf().juzs;
  const idx = ayahIndex(ref);
  let ans = 0;
  for (let i = 0; i < juzs.length; i++) {
    const start = ayahIndex({ surah: juzs[i].surah, ayah: juzs[i].ayah });
    if (start <= idx) ans = i;
    else break;
  }
  return ans + 1;
}

export function surahsInJuz(juzId: number): SurahMeta[] {
  const { start, end } = juzRange(juzId);
  const list: SurahMeta[] = [];
  for (let id = start.surah; id <= end.surah; id++) list.push(surahMeta(id));
  return list;
}

export function pagesInSurah(surahId: number): number[] {
  const start = pageOfAyah({ surah: surahId, ayah: 1 });
  const end = pageOfAyah({ surah: surahId, ayah: surahMeta(surahId).ayahs });
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export function halfPageRanges(pageId: number): { first: { start: AyahRef; end: AyahRef }; second: { start: AyahRef; end: AyahRef } } {
  const page = pageRange(pageId);
  const count = ayahCountInRange(page.start, page.end);
  const firstCount = Math.ceil(count / 2);
  const firstEnd = ayahAt(ayahIndex(page.start) + firstCount - 1);
  const secondStart = stepAyah(firstEnd, 1);
  if (!secondStart) {
    return { first: page, second: page };
  }
  return {
    first: { start: page.start, end: firstEnd },
    second: { start: secondStart, end: page.end },
  };
}

/** Inclusive iterator of every ayah in a forward range. */
export function eachAyah(start: AyahRef, end: AyahRef, fn: (ref: AyahRef, index: number) => void): void {
  const a = ayahIndex(start);
  const b = ayahIndex(end);
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  for (let i = from; i <= to; i++) fn(ayahAt(i), i);
}
