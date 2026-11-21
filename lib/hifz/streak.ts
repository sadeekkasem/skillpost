import { DEFAULT_TIMEZONE } from "./mushaf";
import type { DailyLog, Plan, Streak, Weekday } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDateInZone(at: Date, timeZone: string): string {
  const tz = timeZone || DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) throw new Error("invalid timezone " + tz);
  return y + "-" + m + "-" + d;
}

/** ISO weekday 1–7 in the given zone. */
export function isoWeekday(dateYmd: string, _timeZone?: string): Weekday {
  // A calendar date's weekday does not depend on the clock timezone.
  const wd = new Date(dateYmd + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  return (wd === 0 ? 7 : wd) as Weekday;
}

export function addDays(dateYmd: string, days: number): string {
  const t = Date.parse(dateYmd + "T12:00:00Z") + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing dateYmd (YYYY-MM-DD interpreted as a calendar date). */
export function isoWeekMonday(dateYmd: string, timeZone: string): string {
  const wd = isoWeekday(dateYmd, timeZone);
  return addDays(dateYmd, 1 - wd);
}

export function isRestWeekday(plan: Pick<Plan, "restWeekdays">, dateYmd: string, timeZone: string): boolean {
  return plan.restWeekdays.includes(isoWeekday(dateYmd, timeZone));
}

/**
 * The first postpone in an ISO week (Mon–Sun, user TZ) keeps the streak.
 * Later postpones in the same week do not.
 */
export function isFreePostpone(dateYmd: string, logs: DailyLog[], timeZone: string): boolean {
  const monday = isoWeekMonday(dateYmd, timeZone);
  const sunday = addDays(monday, 6);
  const earlier = logs.filter((l) => l.postponed && l.logDate >= monday && l.logDate <= sunday && l.logDate < dateYmd);
  return earlier.length === 0;
}

export function isDayKept(
  dateYmd: string,
  plan: Pick<Plan, "restWeekdays">,
  logs: DailyLog[],
  timeZone: string,
): boolean {
  if (isRestWeekday(plan, dateYmd, timeZone)) return true;
  const log = logs.find((l) => l.logDate === dateYmd);
  if (!log) return false;
  if (log.newCompleted || log.isRestDay) return true;
  if (log.postponed && isFreePostpone(dateYmd, logs, timeZone)) return true;
  return false;
}

export function computeStreak(
  todayYmd: string,
  plan: Pick<Plan, "restWeekdays">,
  logs: DailyLog[],
  timeZone: string,
  earliestYmd?: string,
): Streak {
  const tz = timeZone || DEFAULT_TIMEZONE;
  const startFrom = isDayKept(todayYmd, plan, logs, tz) ? todayYmd : addDays(todayYmd, -1);
  let current = 0;
  let cursor = startFrom;
  const floor = earliestYmd && earliestYmd < todayYmd ? earliestYmd : addDays(todayYmd, -4000);
  while (cursor >= floor) {
    if (!isDayKept(cursor, plan, logs, tz)) break;
    current++;
    cursor = addDays(cursor, -1);
  }
  if (!isDayKept(startFrom, plan, logs, tz)) current = 0;

  let longest = current;
  let run = 0;
  const begin = floor;
  for (let d = begin; d <= todayYmd; d = addDays(d, 1)) {
    if (isDayKept(d, plan, logs, tz)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  const last = isDayKept(todayYmd, plan, logs, tz) ? todayYmd : isDayKept(addDays(todayYmd, -1), plan, logs, tz) ? addDays(todayYmd, -1) : null;
  return { current, longest, lastActiveDate: last };
}

/** Today requires a new-memorization / wird action (not a planned rest day). */
export function todayNeedsWork(plan: Pick<Plan, "goal" | "memorizeWeekdays" | "reviseWeekdays" | "restWeekdays">, dateYmd: string, timeZone: string): boolean {
  if (isRestWeekday(plan, dateYmd, timeZone)) return false;
  const wd = isoWeekday(dateYmd, timeZone);
  if (plan.goal === "revise") return plan.reviseWeekdays.includes(wd);
  return plan.memorizeWeekdays.includes(wd);
}
