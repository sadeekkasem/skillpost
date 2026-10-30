"use client";

import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 20;

export type Period = "day" | "week" | "all";

export const periodLabels: Record<Period, string> = {
  day: "اليوم",
  week: "آخر 7 أيام",
  all: "الكل",
};

export function sinceIso(period: Period): string | null {
  if (period === "all") return null;
  const hours = period === "day" ? 24 : 24 * 7;
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

/** Remove characters that break PostgREST filter syntax. */
export function cleanQuery(q: string): string {
  return q.trim().replace(/^@/, "").replace(/[%_,()*\\]/g, "").slice(0, 60);
}

/** Ids of members whose username or name matches the query (for "search by user"). */
export async function matchUserIds(db: SupabaseClient, q: string): Promise<string[]> {
  if (q.length < 2) return [];
  const { data } = await db
    .from("profiles")
    .select("id")
    .or(`username.ilike.*${q}*,full_name.ilike.*${q}*`)
    .limit(50);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

export async function setBanned(db: SupabaseClient, userId: string, banned: boolean, name: string) {
  const ok = window.confirm(
    banned
      ? `حظر العضو «${name}»؟ لن يتمكن من النشر أو التعليق أو المراسلة.`
      : `إلغاء حظر العضو «${name}»؟`
  );
  if (!ok) return false;
  const { error } = await db.rpc("set_user_banned", { target: userId, banned });
  if (error) {
    if (/set_user_banned|function|schema cache/i.test(error.message)) {
      throw new Error("ميزة الحظر تحتاج تحديث قاعدة البيانات: شغّل ملف التحديث في Supabase.");
    }
    throw new Error(error.message);
  }
  return true;
}

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar");
}

type FiltersProps = {
  query?: string;
  onQuery?: (q: string) => void;
  placeholder?: string;
  period: Period;
  onPeriod: (p: Period) => void;
  children?: ReactNode;
};

export function Filters({ query, onQuery, placeholder, period, onPeriod, children }: FiltersProps) {
  return (
    <form
      className="admin-filters"
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q");
        onQuery?.(String(value ?? ""));
      }}
    >
      {onQuery && (
        <>
          <input name="q" type="search" defaultValue={query} placeholder={placeholder ?? "بحث..."} aria-label="بحث" />
          <button type="submit">بحث</button>
        </>
      )}
      <select value={period} onChange={(e) => onPeriod(e.target.value as Period)} aria-label="الفترة">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <option key={p} value={p}>
            {periodLabels[p]}
          </option>
        ))}
      </select>
      {children}
    </form>
  );
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="admin-pager">
      <button type="button" className="ghost" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span>
        صفحة {page + 1} من {pages} · {total} عنصر
      </span>
      <button type="button" className="ghost" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </div>
  );
}
