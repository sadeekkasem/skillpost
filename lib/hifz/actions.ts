"use server";

import { requestMagicLink as staffMagicLink, type ActionResult } from "../islamic/actions";
import { safeInternalPath } from "../auth/paths";
import "./data";
import { juzRange, pageRange, surahMeta } from "./mushaf";
import { isFreePostpone, isRestWeekday, todayNeedsWork } from "./streak";
import { nextPortion } from "./portion";
import { memorizedSet } from "./progress";
import { getSession, loadHifzState, persistPlan, persistSegments, upsertTodayLog, type PlanInput } from "./store";
import { getFixtureStore, resetFixtureStore } from "./fixture-store";
import type { AmountUnit, AyahRef, Goal, Weekday } from "./types";
import { fixturesEnabled } from "../supabase/env";

export type { ActionResult };

export async function requestHifzMagicLink(formData: FormData): Promise<ActionResult> {
  if (!formData.get("next")) formData.set("next", "/hifz");
  const next = safeInternalPath(String(formData.get("next") || "/hifz"));
  if (next) formData.set("next", next);
  return staffMagicLink(formData);
}

export async function enterFixtureSession(): Promise<ActionResult> {
  if (!fixturesEnabled()) return { ok: false, message: "وضع التجربة غير مفعّل." };
  return { ok: true, message: "وضع التجربة جاهز." };
}

export async function resetFixtureHifz(): Promise<ActionResult> {
  if (!fixturesEnabled()) return { ok: false, message: "وضع التجربة غير مفعّل." };
  resetFixtureStore();
  return { ok: true, message: "أُعيدت بيانات التجربة." };
}

function parseWeekdays(raw: FormDataEntryValue | null, fallback: Weekday[]): Weekday[] {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const days = raw.split(",").map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) as Weekday[];
  return Array.from(new Set(days)).sort() as Weekday[];
}

export async function saveHifzPlan(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "سجّل الدخول أولاً." };
  const goal = String(formData.get("goal") || "") as Goal;
  if (goal !== "new" && goal !== "revise" && goal !== "wird") return { ok: false, message: "اختر هدفاً." };
  const unit = String(formData.get("amountUnit") || "") as AmountUnit;
  if (unit !== "ayat" && unit !== "half_page" && unit !== "page") return { ok: false, message: "اختر مقدار الحفظ." };
  const amountValue = unit === "ayat" ? Number(formData.get("amountValue") || 5) : 1;
  if (unit === "ayat" && ![3, 5, 10].includes(amountValue)) return { ok: false, message: "مقدار الآيات: 3 أو 5 أو 10." };
  const fromEnd = String(formData.get("fromEnd") || "") === "1";
  const startSurah = Number(formData.get("startSurah") || (fromEnd ? 114 : 1));
  const startAyah = Number(formData.get("startAyah") || (fromEnd ? 6 : 1));
  if (!Number.isInteger(startSurah) || startSurah < 1 || startSurah > 114) return { ok: false, message: "سورة البداية غير صحيحة." };
  const maxAyah = surahMeta(startSurah).ayahs;
  if (!Number.isInteger(startAyah) || startAyah < 1 || startAyah > maxAyah) return { ok: false, message: "آية البداية غير صحيحة." };
  const memorizeWeekdays = parseWeekdays(formData.get("memorizeWeekdays"), [1, 2, 3, 4, 5]);
  const reviseWeekdays = parseWeekdays(formData.get("reviseWeekdays"), [1, 2, 3, 4, 5, 6, 7]);
  const restWeekdays = parseWeekdays(formData.get("restWeekdays"), []);
  const timezone = String(formData.get("timezone") || "Europe/Helsinki").slice(0, 64) || "Europe/Helsinki";
  const input: PlanInput = {
    goal,
    amountUnit: unit,
    amountValue,
    start: { surah: startSurah, ayah: startAyah },
    fromEnd,
    memorizeWeekdays,
    reviseWeekdays,
    restWeekdays,
    timezone,
  };
  const saved = await persistPlan(session, input);
  if (!saved.ok) return saved;
  const already = String(formData.get("already") || "");
  if (already.trim()) {
    const marks: { start: AyahRef; end: AyahRef; pageNumber: number | null; juzNumber: number | null; status: "memorized" }[] = [];
    for (const token of already.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (token.startsWith("juz:")) {
        const id = Number(token.slice(4));
        if (id >= 1 && id <= 30) {
          const range = juzRange(id);
          marks.push({ start: range.start, end: range.end, pageNumber: null, juzNumber: id, status: "memorized" });
        }
      } else if (token.startsWith("surah:")) {
        const id = Number(token.slice(6));
        if (id >= 1 && id <= 114) {
          const s = surahMeta(id);
          marks.push({ start: { surah: id, ayah: 1 }, end: { surah: id, ayah: s.ayahs }, pageNumber: null, juzNumber: null, status: "memorized" });
        }
      }
    }
    if (marks.length) {
      const added = await persistSegments(session, marks);
      if (!added.ok) return added;
    }
  }
  return { ok: true, message: "حُفظت خطتك." };
}

export async function completeTodayPortion(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "سجّل الدخول أولاً." };
  const state = await loadHifzState();
  if (!state.plan) return { ok: false, message: "ضع خطة أولاً." };
  const bits = memorizedSet(state.segments);
  const portion = nextPortion(state.plan, bits);
  if (portion) {
    const added = await persistSegments(session, [{
      start: portion.start,
      end: portion.end,
      pageNumber: null,
      juzNumber: null,
      status: "memorized",
    }]);
    if (!added.ok) return added;
  }
  const logged = await upsertTodayLog(session, state.plan, { newCompleted: true, postponed: false });
  if (!logged.ok) return logged;
  return { ok: true, message: state.plan.goal === "wird" ? "سُجّل ورد اليوم." : "سُجّل الحفظ." };
}

export async function postponeTodayPortion(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "سجّل الدخول أولاً." };
  const state = await loadHifzState();
  if (!state.plan) return { ok: false, message: "ضع خطة أولاً." };
  if (isRestWeekday(state.plan, state.today, state.plan.timezone)) {
    return { ok: true, message: "اليوم يوم راحة في خطتك، ولا يحتاج تأجيلاً." };
  }
  const free = isFreePostpone(state.today, state.logs, state.plan.timezone);
  const logged = await upsertTodayLog(session, state.plan, { postponed: true });
  if (!logged.ok) return logged;
  if (free) return { ok: true, message: "أُجّل ورد اليوم إلى الغد، ولم يُكسر العدّاد." };
  return { ok: true, message: "أُجّل الورد، لكن هذا ثاني تأجيل في هذا الأسبوع، فلا يُحسب في العدّاد." };
}

export async function markRange(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "سجّل الدخول أولاً." };
  const kind = String(formData.get("kind") || "");
  const id = Number(formData.get("id"));
  const memorized = String(formData.get("memorized") || "1") === "1";
  if (kind === "juz" && id >= 1 && id <= 30) {
    const range = juzRange(id);
    if (!memorized) return unmarkRange(range.start, range.end);
    return persistSegments(session, [{ start: range.start, end: range.end, pageNumber: null, juzNumber: id, status: "memorized" }]);
  }
  if (kind === "surah" && id >= 1 && id <= 114) {
    const s = surahMeta(id);
    const start = { surah: id, ayah: 1 };
    const end = { surah: id, ayah: s.ayahs };
    if (!memorized) return unmarkRange(start, end);
    return persistSegments(session, [{ start, end, pageNumber: null, juzNumber: null, status: "memorized" }]);
  }
  if (kind === "page" && id >= 1 && id <= 604) {
    const range = pageRange(id);
    if (!memorized) return unmarkRange(range.start, range.end);
    return persistSegments(session, [{ start: range.start, end: range.end, pageNumber: id, juzNumber: null, status: "memorized" }]);
  }
  return { ok: false, message: "بيانات غير صحيحة." };
}

async function unmarkRange(start: AyahRef, end: AyahRef): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "سجّل الدخول أولاً." };
  const state = await loadHifzState();
  const { ayahIndex } = await import("./mushaf");
  const from = ayahIndex(start);
  const to = ayahIndex(end);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const ids = state.segments.filter((seg) => {
    const a = ayahIndex(seg.start);
    const b = ayahIndex(seg.end);
    const s = Math.min(a, b);
    const e = Math.max(a, b);
    return s >= lo && e <= hi;
  }).map((seg) => seg.id);
  if (!ids.length) return { ok: true, message: "لا مقاطع داخل هذا النطاق." };
  const { deleteSegmentsByIds } = await import("./store");
  const result = await deleteSegmentsByIds(session, ids);
  if (!result.ok) return result;
  return { ok: true, message: "أُزيل التعليم." };
}

export { todayNeedsWork, getFixtureStore };
