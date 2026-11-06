export type RatePair = { base: string; quote: string; rate: number; date: string };

/** Display pairs: EUR majors + USD/SYP (Frankfurter v2 blended feed). */
export const RATE_QUERIES: { base: string; quotes: string[] }[] = [
  { base: "EUR", quotes: ["USD", "TRY"] },
  { base: "USD", quotes: ["SYP"] },
];

export type RatesPayload = {
  pairs: RatePair[];
  source: string;
  sourceUrl: string;
};
