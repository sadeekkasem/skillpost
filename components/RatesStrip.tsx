"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import type { RatesPayload } from "@/lib/rates";

function formatRate(base: string, quote: string, rate: number): string {
  if (quote === "SYP" || rate >= 100) {
    return rate.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (rate >= 10) {
    return rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function RatesStrip() {
  const t = useT();
  const [data, setData] = useState<RatesPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    fetch("/api/rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RatesPayload | null) => {
        if (off) return;
        if (d?.pairs?.length) setData(d);
        else setFailed(true);
      })
      .catch(() => {
        if (!off) setFailed(true);
      });
    return () => {
      off = true;
    };
  }, []);

  if (failed) return null;
  if (!data) return <div className="rates-strip is-loading" aria-hidden />;

  return (
    <div className="rates-strip">
      <div className="rates-label">{t("rates.label")}</div>
      <ul className="rates-list" dir="ltr">
        {data.pairs.map((p) => (
          <li key={`${p.base}/${p.quote}`}>
            <span className="rates-pair">
              {p.base}/{p.quote}
            </span>
            <span className="rates-value">{formatRate(p.base, p.quote, p.rate)}</span>
          </li>
        ))}
      </ul>
      <a className="rates-credit" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">
        {t("rates.credit")}
      </a>
    </div>
  );
}
