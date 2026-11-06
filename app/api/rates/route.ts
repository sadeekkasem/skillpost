import { NextResponse } from "next/server";
import { RATE_QUERIES, type RatePair, type RatesPayload } from "@/lib/rates";

const UA = "SkillPost/1.0 https://www.skillpostapp.com sadeekkasem@gmail.com";

type FrankRow = { date: string; base: string; quote: string; rate: number };

async function fetchPairs(base: string, quotes: string[]): Promise<RatePair[]> {
  const url = `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}&quotes=${quotes.map((q) => q.toLowerCase()).join(",")}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as FrankRow[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((r) => r && typeof r.rate === "number")
    .map((r) => ({
      base: String(r.base).toUpperCase(),
      quote: String(r.quote).toUpperCase(),
      rate: r.rate,
      date: r.date,
    }));
}

export async function GET() {
  try {
    const settled = await Promise.allSettled(
      RATE_QUERIES.map((q) => fetchPairs(q.base, q.quotes))
    );
    const pairs: RatePair[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") pairs.push(...r.value);
    }
    const seen = new Set<string>();
    const unique: RatePair[] = [];
    for (const p of pairs) {
      const key = `${p.base}/${p.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    if (!unique.length) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    const body: RatesPayload = {
      pairs: unique,
      source: "Frankfurter",
      sourceUrl: "https://frankfurter.dev/",
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
