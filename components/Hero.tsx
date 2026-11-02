"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import { getClient } from "@/lib/supabase";

export default function Hero() {
  const t = useT();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const db = getClient();
    if (!db) return;
    let alive = true;
    db.auth
      .getUser()
      .then(({ data }) => alive && setLoggedIn(Boolean(data.user)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="hero feed-hero">
      <h1>{t("hero.title")}</h1>
      <p>{t("hero.subtitle")}</p>
      <div className="hero-actions">
        <Link className="button" href={loggedIn ? "/projects/new" : "/account"}>
          {t("hero.ctaStart")}
        </Link>
        <Link className="button hero-secondary" href="/projects/new">
          {t("hero.ctaPublish")}
        </Link>
      </div>
    </section>
  );
}
