"use client";

import dynamic from "next/dynamic";

const WeatherStrip = dynamic(() => import("./WeatherStrip"), {
  ssr: false,
  loading: () => <div className="weather-strip is-loading" aria-hidden />,
});
const RatesStrip = dynamic(() => import("./RatesStrip"), {
  ssr: false,
  loading: () => <div className="rates-strip is-loading" aria-hidden />,
});
const NewsStrip = dynamic(() => import("./NewsStrip"), {
  ssr: false,
  loading: () => <div className="news-strip is-loading" aria-hidden />,
});

/** Client-only utility strips so weather/rates/news never block the hero/feed SSR. */
export default function HomeUtilityStrips() {
  return (
    <div className="home-utility-strips">
      <WeatherStrip />
      <RatesStrip />
      <NewsStrip />
    </div>
  );
}
