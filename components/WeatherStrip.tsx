"use client";

import { useEffect, useState } from "react";
import { useLanguage, useT } from "@/components/LanguageProvider";
import { CITIES, DEFAULT_CITY, REGIONS, type Weather } from "@/lib/weather";
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
  if (s === "partlycloudy") return "weather.cond.partly";
  if (s === "fair") return "weather.cond.fair";
  return "weather.cond.clear";
}

type IconKind = "sun" | "moon" | "partly-day" | "partly-night" | "cloud" | "rain" | "snow" | "fog" | "thunder";

function iconKind(symbol: string): IconKind {
  const night = symbol.endsWith("_night");
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return "thunder";
  if (s.includes("snow") || s.includes("sleet")) return "snow";
  if (s.includes("rain")) return "rain";
  if (s === "fog") return "fog";
  if (s === "cloudy") return "cloud";
  if (s === "partlycloudy" || s === "fair") return night ? "partly-night" : "partly-day";
  return night ? "moon" : "sun";
}

const CLOUD = "M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.5 4.25 4.25 0 0 0 7 18z";

/** Small inline line icons (24x24, currentColor). */
function WeatherIcon({ kind }: { kind: IconKind }) {
  const sun = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={cx + Math.cos(rad) * (r + 2)} y1={cy + Math.sin(rad) * (r + 2)} x2={cx + Math.cos(rad) * (r + 3.6)} y2={cy + Math.sin(rad) * (r + 3.6)} />;
      })}
    </g>
  );
  const moon = (tx = 0, ty = 0, sc = 1) => (
    <path transform={`translate(${tx} ${ty}) scale(${sc})`} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  );
  return (
    <svg className={`wx-icon wx-${kind}`} viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "sun" && sun(12, 12, 4.2)}
      {kind === "moon" && moon()}
      {kind === "partly-day" && <>{sun(8.5, 8, 3)}<path d={CLOUD} transform="translate(2 1) scale(.9)" fill="var(--wx-bg,#fff)" /></>}
      {kind === "partly-night" && <>{moon(-1, -1, 0.6)}<path d={CLOUD} transform="translate(2 1) scale(.9)" fill="var(--wx-bg,#fff)" /></>}
      {kind === "cloud" && <path d={CLOUD} transform="translate(0 -2)" />}
      {kind === "rain" && <><path d={CLOUD} transform="translate(0 -4)" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></>}
      {kind === "snow" && <><path d={CLOUD} transform="translate(0 -4)" /><path d="M8 18.5h.01M12 20h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01" strokeWidth="2.4" /></>}
      {kind === "fog" && <path d="M4 9h16M6 13h12M4 17h16" />}
      {kind === "thunder" && <><path d={CLOUD} transform="translate(0 -4)" /><path d="M12.5 15l-2 3.5h3l-2 3.5" /></>}
    </svg>
  );
}

export default function WeatherStrip() {
  const t = useT();
  const { lang } = useLanguage();
  const [city, setCity] = useState<string | null>(null);
  const [data, setData] = useState<Weather | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Local clock: set after mount (no hydration mismatch), tick on each minute.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 60_000 - (d.getTime() % 60_000) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

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

  const tz = CITIES.find((c) => c.id === city)?.timeZone;

  if (!city) return <div className="weather-strip is-loading" aria-hidden />;

  const time = now && tz
    ? new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(now)
    : null;

  return (
    <div className="weather-strip">
      <div className="wx-main">
        {data ? <WeatherIcon kind={iconKind(data.symbol)} /> : <span className="wx-icon wx-skel" />}
        <div className="wx-readout">
          <span className="wx-temp" dir="ltr">{data ? `${data.temp}°` : "–°"}</span>
          <span className="wx-cond">{data ? t(condKey(data.symbol)) : "\u00a0"}</span>
        </div>
      </div>
      <div className="wx-side">
        <label className="wx-select">
          <select
            aria-label={t("weather.city")}
            value={city}
            onChange={(e) => {
              localStorage.setItem(KEY, e.target.value);
              setData(null);
              setCity(e.target.value);
            }}
          >
            {REGIONS.map((r) => (
              <optgroup key={r} label={t(`weather.region.${r}` as DictKey)}>
                {CITIES.filter((c) => c.region === r)
                  .map((c) => ({ id: c.id, name: t(`weather.city.${c.id}` as DictKey) }))
                  .sort((a, b) => a.name.replace(/^ال/, "").localeCompare(b.name.replace(/^ال/, ""), lang))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </label>
        <time className="wx-time">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          <span>{time ?? "--:--"}</span>
        </time>
      </div>
      <a className="weather-credit" href="https://api.met.no/" target="_blank" rel="noopener noreferrer">
        {t("weather.credit")}
      </a>
    </div>
  );
}
