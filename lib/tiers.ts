import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "bronze" | "silver" | "gold" | "diamond";

export const TIERS: Record<Tier, { name: string; icon: string; excel: number }> = {
  bronze: { name: "برونزي", icon: "🥉", excel: 3 },
  silver: { name: "فضي", icon: "🥈", excel: 4 },
  gold: { name: "ذهبي", icon: "🥇", excel: 6 },
  diamond: { name: "ماسي", icon: "💎", excel: 30 },
};

export const tierLabel = (t: Tier) => `${TIERS[t].name} ${TIERS[t].icon}`;

export const SITE_URL = "https://skillpost.vercel.app";
export const REFERRALS_FOR_SILVER = 10;
export const DAYS_FOR_GOLD = 50;
export const DIAMOND_PRICE = "4€ شهريًا";
export const DIAMOND_CONTACT = "sadeekkasem@gmail.com";

export type TierInfo = {
  tier: Tier;
  referral_code: string;
  referred: boolean;
  referrals: number;
  active_days: number;
  diamond_until: string | null;
  excel_limit: number;
  excel_used: number;
  excel_monthly: boolean;
  max_file_mb: number;
  pinned_project_id: string | null;
};

/** The signed-in member's tier details, or null before the tiers migration runs. */
export async function getMyTierInfo(db: SupabaseClient): Promise<TierInfo | null> {
  try {
    const { data, error } = await db.rpc("my_tier_info");
    if (error || !data) return null;
    return data as TierInfo;
  } catch {
    return null;
  }
}

// Badges for other members: one batched call per render pass, cached for the page session.
const cache = new Map<string, Tier | null>();
const waiting = new Map<string, ((t: Tier | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
let disabled = false;

async function flush(db: SupabaseClient) {
  timer = null;
  const ids = [...waiting.keys()].slice(0, 200);
  const done = (id: string, t: Tier | null) => {
    cache.set(id, t);
    waiting.get(id)?.forEach((cb) => cb(t));
    waiting.delete(id);
  };
  try {
    const { data, error } = await db.rpc("member_tiers", { ids });
    if (error) disabled = true;
    const rows = (data ?? []) as { id: string; tier: Tier }[];
    const found = new Map(rows.map((r) => [r.id, r.tier]));
    ids.forEach((id) => done(id, found.get(id) ?? null));
  } catch {
    disabled = true;
    ids.forEach((id) => done(id, null));
  }
  if (waiting.size) timer = setTimeout(() => void flush(db), 0);
}

export function loadTier(db: SupabaseClient, id: string): Promise<Tier | null> {
  if (disabled || !id) return Promise.resolve(null);
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null);
  return new Promise((resolve) => {
    waiting.set(id, [...(waiting.get(id) ?? []), resolve]);
    if (!timer) timer = setTimeout(() => void flush(db), 20);
  });
}

/** Ids of current diamond members (their projects are shown first). Empty before the migration. */
export async function getDiamondMembers(db: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await db.rpc("diamond_members");
    if (error) return [];
    return ((data ?? []) as (string | { diamond_members: string })[]).map((r) =>
      typeof r === "string" ? r : r.diamond_members
    );
  } catch {
    return [];
  }
}

/** Stable sort: diamond members' items first. */
export function diamondFirst<T>(items: T[], owner: (item: T) => string | undefined, diamonds: string[]): T[] {
  if (!diamonds.length) return items;
  const set = new Set(diamonds);
  return [...items.filter((i) => set.has(owner(i) ?? "")), ...items.filter((i) => !set.has(owner(i) ?? ""))];
}

// Referrals: ?ref=CODE is kept in the browser until the visitor signs up.
const REF_KEY = "skillpost_ref";

export function rememberReferral() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase();
    if (ref && /^[a-z0-9]{4,32}$/.test(ref)) localStorage.setItem(REF_KEY, ref);
  } catch {}
}

export function storedReferral(): string {
  try {
    return localStorage.getItem(REF_KEY) ?? "";
  } catch {
    return "";
  }
}

/** After sign-in: record the referrer once (the database ignores repeats), then forget it. */
export async function applyStoredReferral(db: SupabaseClient) {
  const ref = storedReferral();
  if (!ref) return;
  try {
    const { error } = await db.rpc("set_referrer", { code: ref });
    if (!error) localStorage.removeItem(REF_KEY);
  } catch {}
}

/** Count today's visit once per browser per day. */
export async function touchActivity(db: SupabaseClient, uid: string) {
  const key = `skillpost_active_${uid}`;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Helsinki" });
  try {
    if (localStorage.getItem(key) === today) return;
    const { error } = await db.rpc("touch_activity");
    if (!error) localStorage.setItem(key, today);
  } catch {}
}
