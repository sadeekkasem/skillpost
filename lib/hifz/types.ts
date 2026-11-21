export type Goal = "new" | "revise" | "wird";
export type AmountUnit = "ayat" | "half_page" | "page";

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AyahRef = { surah: number; ayah: number };

export type SegmentStatus = "not_started" | "learning" | "memorized";

export type Plan = {
  id: string;
  goal: Goal;
  amountUnit: AmountUnit;
  amountValue: number;
  start: AyahRef;
  fromEnd: boolean;
  memorizeWeekdays: Weekday[];
  reviseWeekdays: Weekday[];
  restWeekdays: Weekday[];
  timezone: string;
  isActive: boolean;
};

export type Segment = {
  id: string;
  start: AyahRef;
  end: AyahRef;
  pageNumber: number | null;
  juzNumber: number | null;
  status: SegmentStatus;
};

export type DailyLog = {
  logDate: string; // YYYY-MM-DD in the user's timezone
  newCompleted: boolean;
  postponed: boolean;
  isRestDay: boolean;
};

export type Streak = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
};

export type Portion = {
  start: AyahRef;
  end: AyahRef;
  ayahCount: number;
  label: string;
};
