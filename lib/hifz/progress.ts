import { ayahIndex, ayahAt, TOTAL_AYAT, TOTAL_JUZ, juzRange, formatRange, type SurahMeta, surahMeta, getMushaf } from "./mushaf";
import type { AyahRef, Segment } from "./types";

/** Bitset of memorized ayat (0..6235). */
export function memorizedSet(segments: Pick<Segment, "start" | "end" | "status">[]): Uint8Array {
  const bits = new Uint8Array(TOTAL_AYAT);
  for (const seg of segments) {
    if (seg.status !== "memorized") continue;
    const a = ayahIndex(seg.start);
    const b = ayahIndex(seg.end);
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    for (let i = from; i <= to; i++) bits[i] = 1;
  }
  return bits;
}

export function isMemorized(bits: Uint8Array, ref: AyahRef): boolean {
  return bits[ayahIndex(ref)] === 1;
}

export function rangeMemorized(bits: Uint8Array, start: AyahRef, end: AyahRef): "all" | "some" | "none" {
  const a = ayahIndex(start);
  const b = ayahIndex(end);
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  let yes = 0;
  let no = 0;
  for (let i = from; i <= to; i++) {
    if (bits[i]) yes++;
    else no++;
    if (yes && no) return "some";
  }
  return yes ? "all" : "none";
}

export function firstUnmemorized(bits: Uint8Array, from: AyahRef, direction: 1 | -1): AyahRef | null {
  let i = ayahIndex(from);
  const stop = direction === 1 ? TOTAL_AYAT : -1;
  while (i !== stop) {
    if (!bits[i]) return ayahAt(i);
    i += direction;
  }
  return null;
}

export type ProgressSummary = {
  memorizedAyat: number;
  totalAyat: number;
  percent: number;
  juzEquivalent: number;
  label: string;
};

export function summarizeProgress(bits: Uint8Array): ProgressSummary {
  let memorizedAyat = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i]) memorizedAyat++;
  const percent = Math.round((memorizedAyat / TOTAL_AYAT) * 1000) / 10;
  const juzEquivalent = Math.round((memorizedAyat / TOTAL_AYAT) * TOTAL_JUZ * 100) / 100;
  return {
    memorizedAyat,
    totalAyat: TOTAL_AYAT,
    percent,
    juzEquivalent,
    label: "محفوظ " + juzEquivalent + " من " + TOTAL_JUZ + " جزءاً، " + percent + "٪",
  };
}

export function juzStates(bits: Uint8Array): { id: number; state: "all" | "some" | "none" }[] {
  return Array.from({ length: TOTAL_JUZ }, (_, i) => {
    const id = i + 1;
    const range = juzRange(id);
    return { id, state: rangeMemorized(bits, range.start, range.end) };
  });
}

export function surahState(bits: Uint8Array, surah: SurahMeta): "all" | "some" | "none" {
  return rangeMemorized(bits, { surah: surah.id, ayah: 1 }, { surah: surah.id, ayah: surah.ayahs });
}

export function remainingAyatFrom(bits: Uint8Array, from: AyahRef, direction: 1 | -1): number {
  let i = ayahIndex(from);
  const stop = direction === 1 ? TOTAL_AYAT : -1;
  let n = 0;
  while (i !== stop) {
    if (!bits[i]) n++;
    i += direction;
  }
  return n;
}

export { formatRange, surahMeta, getMushaf };
