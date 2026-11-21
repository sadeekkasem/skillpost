import type { DailyLog, Plan, Segment, Streak } from "./types";

export const FIXTURE_USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const FIXTURE_EMAIL = "hifz.test@example.invalid";

type Store = {
  plan: Plan | null;
  segments: Segment[];
  logs: DailyLog[];
  streak: Streak;
  timezone: string;
};

const store: Store = {
  plan: null,
  segments: [],
  logs: [],
  streak: { current: 0, longest: 0, lastActiveDate: null },
  timezone: "Europe/Helsinki",
};

export function resetFixtureStore(): void {
  store.plan = null;
  store.segments = [];
  store.logs = [];
  store.streak = { current: 0, longest: 0, lastActiveDate: null };
  store.timezone = "Europe/Helsinki";
}

export function getFixtureStore(): Store {
  return store;
}
