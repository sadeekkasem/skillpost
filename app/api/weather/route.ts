import { NextResponse } from "next/server";
import { CITIES, DEFAULT_CITY, type Weather } from "@/lib/weather";

const UA = "SkillPost/1.0 https://www.skillpostapp.com sadeekkasem@gmail.com";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("city") || DEFAULT_CITY;
  const city = CITIES.find((c) => c.id === id);
  if (!city) return NextResponse.json({ error: "unknown city" }, { status: 400 });

  const lat = city.lat.toFixed(4);
  const lon = city.lon.toFixed(4);
  try {
    const res = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 1800 } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const now = data?.properties?.timeseries?.[0];
    const body: Weather = {
      city: city.id,
      temp: Math.round(now.data.instant.details.air_temperature),
      symbol: now.data.next_1_hours?.summary?.symbol_code ?? now.data.next_6_hours?.summary?.symbol_code ?? "",
      time: now.time,
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
