import { revalidatePath } from "next/cache";
import { fixturesEnabled } from "../supabase/env";
import { createSupabaseServerClient } from "../supabase/server";
import { DEFAULT_TIMEZONE } from "./mushaf";
import { computeStreak, calendarDateInZone } from "./streak";
import { FIXTURE_EMAIL, FIXTURE_USER_ID, getFixtureStore } from "./fixture-store";
import type { DailyLog, Plan, Segment, SegmentStatus, Streak, Weekday } from "./types";

export type HifzSession = { userId: string; email: string | null; fixtures: boolean };

export type HifzState = {
  session: HifzSession | null;
  plan: Plan | null;
  segments: Segment[];
  logs: DailyLog[];
  streak: Streak;
  timezone: string;
  today: string;
};

function weekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is Weekday => Number.isInteger(n) && n >= 1 && n <= 7) as Weekday[];
}

function rowToPlan(row: Record<string, unknown>): Plan {
  return {
    id: String(row.id),
    goal: row.goal as Plan["goal"],
    amountUnit: row.amount_unit as Plan["amountUnit"],
    amountValue: Number(row.amount_value),
    start: { surah: Number(row.start_surah), ayah: Number(row.start_ayah) },
    fromEnd: Boolean(row.from_end),
    memorizeWeekdays: weekdays(row.memorize_weekdays),
    reviseWeekdays: weekdays(row.revise_weekdays),
    restWeekdays: weekdays(row.rest_weekdays),
    timezone: String(row.timezone || DEFAULT_TIMEZONE),
    isActive: Boolean(row.is_active),
  };
}

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    id: String(row.id),
    start: { surah: Number(row.start_surah), ayah: Number(row.start_ayah) },
    end: { surah: Number(row.end_surah), ayah: Number(row.end_ayah) },
    pageNumber: row.page_number == null ? null : Number(row.page_number),
    juzNumber: row.juz_number == null ? null : Number(row.juz_number),
    status: row.status as SegmentStatus,
  };
}

function rowToLog(row: Record<string, unknown>): DailyLog {
  return {
    logDate: String(row.log_date).slice(0, 10),
    newCompleted: Boolean(row.new_completed),
    postponed: Boolean(row.postponed),
    isRestDay: Boolean(row.is_rest_day),
  };
}

export async function getSession(): Promise<HifzSession | null> {
  if (fixturesEnabled()) return { userId: FIXTURE_USER_ID, email: FIXTURE_EMAIL, fixtures: true };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null, fixtures: false };
}

export async function loadHifzState(now = new Date()): Promise<HifzState> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      plan: null,
      segments: [],
      logs: [],
      streak: { current: 0, longest: 0, lastActiveDate: null },
      timezone: DEFAULT_TIMEZONE,
      today: calendarDateInZone(now, DEFAULT_TIMEZONE),
    };
  }
  if (session.fixtures) {
    const store = getFixtureStore();
    const timezone = store.plan?.timezone || store.timezone || DEFAULT_TIMEZONE;
    const today = calendarDateInZone(now, timezone);
    const streak = store.plan ? computeStreak(today, store.plan, store.logs, timezone) : store.streak;
    store.streak = streak;
    return { session, plan: store.plan, segments: store.segments, logs: store.logs, streak, timezone, today };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { session, plan: null, segments: [], logs: [], streak: { current: 0, longest: 0, lastActiveDate: null }, timezone: DEFAULT_TIMEZONE, today: calendarDateInZone(now, DEFAULT_TIMEZONE) };
  }
  const [profileRes, planRes, segRes, logRes, streakRes] = await Promise.all([
    supabase.from("hifz_profiles").select("timezone").eq("user_id", session.userId).maybeSingle(),
    supabase.from("hifz_plans").select("*").eq("user_id", session.userId).eq("is_active", true).maybeSingle(),
    supabase.from("hifz_segments").select("*").eq("user_id", session.userId),
    supabase.from("hifz_daily_logs").select("*").eq("user_id", session.userId).order("log_date", { ascending: true }),
    supabase.from("hifz_streaks").select("*").eq("user_id", session.userId).maybeSingle(),
  ]);
  const plan = planRes.data ? rowToPlan(planRes.data as Record<string, unknown>) : null;
  const segments = (segRes.data ?? []).map((row) => rowToSegment(row as Record<string, unknown>));
  const logs = (logRes.data ?? []).map((row) => rowToLog(row as Record<string, unknown>));
  const timezone = plan?.timezone || (profileRes.data as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE;
  const today = calendarDateInZone(now, timezone);
  const computed = plan ? computeStreak(today, plan, logs, timezone) : { current: 0, longest: 0, lastActiveDate: null };
  const stored = streakRes.data as { current_streak?: number; longest_streak?: number; last_active_date?: string | null } | null;
  const streak: Streak = stored
    ? { current: computed.current, longest: Math.max(computed.longest, Number(stored.longest_streak ?? 0)), lastActiveDate: computed.lastActiveDate }
    : computed;
  return { session, plan, segments, logs, streak, timezone, today };
}

export type PlanInput = Omit<Plan, "id" | "isActive">;

export async function persistPlan(session: HifzSession, input: PlanInput, now = new Date()): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const plan: Plan = { ...input, id: "plan", isActive: true };
  if (session.fixtures) {
    const store = getFixtureStore();
    store.plan = { ...plan, id: "fixture-plan" };
    store.timezone = plan.timezone;
    const today = calendarDateInZone(now, plan.timezone);
    store.streak = computeStreak(today, plan, store.logs, plan.timezone);
    revalidatePath("/hifz");
    return { ok: true, message: "حُفظت الخطة." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "الاتصال غير متوفر." };
  await supabase.from("hifz_profiles").upsert({
    user_id: session.userId,
    timezone: input.timezone,
    updated_at: new Date().toISOString(),
  });
  await supabase.from("hifz_plans").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", session.userId).eq("is_active", true);
  const { error } = await supabase.from("hifz_plans").insert({
    user_id: session.userId,
    goal: input.goal,
    amount_unit: input.amountUnit,
    amount_value: input.amountValue,
    start_surah: input.start.surah,
    start_ayah: input.start.ayah,
    from_end: input.fromEnd,
    memorize_weekdays: input.memorizeWeekdays,
    revise_weekdays: input.reviseWeekdays,
    rest_weekdays: input.restWeekdays,
    timezone: input.timezone,
    is_active: true,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/hifz");
  return { ok: true, message: "حُفظت الخطة." };
}

export async function persistSegments(
  session: HifzSession,
  segments: Omit<Segment, "id">[],
  replaceMatching?: boolean,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (session.fixtures) {
    const store = getFixtureStore();
    if (replaceMatching) {
      // drop overlapping later in actions; here append
    }
    for (const seg of segments) {
      store.segments.push({ ...seg, id: "seg-" + store.segments.length + "-" + Date.now() });
    }
    revalidatePath("/hifz");
    return { ok: true, message: "عُلّم المقطع." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "الاتصال غير متوفر." };
  const rows = segments.map((seg) => ({
    user_id: session.userId,
    start_surah: seg.start.surah,
    start_ayah: seg.start.ayah,
    end_surah: seg.end.surah,
    end_ayah: seg.end.ayah,
    page_number: seg.pageNumber,
    juz_number: seg.juzNumber,
    status: seg.status,
  }));
  const { error } = await supabase.from("hifz_segments").insert(rows);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/hifz");
  return { ok: true, message: "عُلّم المقطع." };
}

export async function deleteSegmentsByIds(session: HifzSession, ids: string[]): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (session.fixtures) {
    const store = getFixtureStore();
    store.segments = store.segments.filter((s) => !ids.includes(s.id));
    revalidatePath("/hifz");
    return { ok: true, message: "أُزيل التعليم." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "الاتصال غير متوفر." };
  const { error } = await supabase.from("hifz_segments").delete().eq("user_id", session.userId).in("id", ids);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/hifz");
  return { ok: true, message: "أُزيل التعليم." };
}

export async function upsertTodayLog(
  session: HifzSession,
  plan: Plan,
  patch: Partial<DailyLog>,
  now = new Date(),
): Promise<{ ok: true; streak: Streak; today: string } | { ok: false; message: string }> {
  const today = calendarDateInZone(now, plan.timezone);
  if (session.fixtures) {
    const store = getFixtureStore();
    const existing = store.logs.find((l) => l.logDate === today);
    const log: DailyLog = {
      logDate: today,
      newCompleted: patch.newCompleted ?? existing?.newCompleted ?? false,
      postponed: patch.postponed ?? existing?.postponed ?? false,
      isRestDay: patch.isRestDay ?? existing?.isRestDay ?? false,
    };
    store.logs = store.logs.filter((l) => l.logDate !== today).concat(log);
    store.streak = computeStreak(today, plan, store.logs, plan.timezone);
    revalidatePath("/hifz");
    return { ok: true, streak: store.streak, today };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "الاتصال غير متوفر." };
  const { data: currentLogs } = await supabase.from("hifz_daily_logs").select("*").eq("user_id", session.userId);
  const logs = (currentLogs ?? []).map((row) => rowToLog(row as Record<string, unknown>));
  const existing = logs.find((l) => l.logDate === today);
  const log: DailyLog = {
    logDate: today,
    newCompleted: patch.newCompleted ?? existing?.newCompleted ?? false,
    postponed: patch.postponed ?? existing?.postponed ?? false,
    isRestDay: patch.isRestDay ?? existing?.isRestDay ?? false,
  };
  const { error } = await supabase.from("hifz_daily_logs").upsert(
    {
      user_id: session.userId,
      log_date: today,
      new_completed: log.newCompleted,
      postponed: log.postponed,
      is_rest_day: log.isRestDay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date" },
  );
  if (error) return { ok: false, message: error.message };
  const nextLogs = logs.filter((l) => l.logDate !== today).concat(log);
  const streak = computeStreak(today, plan, nextLogs, plan.timezone);
  await supabase.from("hifz_streaks").upsert({
    user_id: session.userId,
    current_streak: streak.current,
    longest_streak: streak.longest,
    last_active_date: streak.lastActiveDate,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/hifz");
  return { ok: true, streak, today };
}
