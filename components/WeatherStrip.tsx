"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { CITIES, DEFAULT_CITY, type Weather } from "@/lib/weather";
import type { DictKey } from "@/lib/i18n";

const KEY = "skillpost_weather_city";

/** Maps a MET Norway symbol_code (e.g. "partlycloudy_day") to an i18n key. */
function condKey(symbol: string): DictKey {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return "weather.cond.thunder";
  if (s.includes("snow")) return "weather.cond.snow";
  if (s.includes("sleet")) return "weather.cond.sleet";
  if (s.includes("rain")) return "weather.cond.rain";
  if (s === "fog") return "weather.cond.fog";
  if (s === "cloudy") return "weather.cond.cloudy";
  if (s === "partlycloudy" || s === "fair") return "weather.cond.partly";
  return "weather.cond.clear";
}

export default function WeatherStrip() {
  const t = useT();
  const [city, setCity] = useState<string | null>(null);
  const [data, setData] = useState<Weather | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setCity(saved && CITIES.some((c) => c.id === saved) ? saved : DEFAULT_CITY);
  }, []);

  useEffect(() => {
    if (!city) return;
    let off = false;
    fetch(`/api/weather?city=${city}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Weather | null) => { if (!off) setData(d); })
      .catch(() => { if (!off) setData(null); });
    return () => { off = true; };
  }, [city]);

  if (!city) return <div className="weather-strip" aria-hidden />;

  return (
    <div className="weather-strip">
      <select
        aria-label={t("weather.city")}
        value={city}
        onChange={(e) => {
          localStorage.setItem(KEY, e.target.value);
          setData(null);
          setCity(e.target.value);
        }}
      >
        {CITIES.map((c) => (
          <option key={c.id} value={c.id}>{t(`weather.city.${c.id}` as DictKey)}</option>
        ))}
      </select>
      <span className="weather-now">
        {data ? <><b dir="ltr">{data.temp}°C</b> · {t(condKey(data.symbol))}</> : "…"}
      </span>
      <a className="weather-credit" href="https://api.met.no/" target="_blank" rel="noopener noreferrer">
        {t("weather.credit")}
      </a>
    </div>
  );
}
