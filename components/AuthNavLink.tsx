"use client";


import { useT } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";
import { applyStoredReferral, rememberReferral, touchActivity } from "@/lib/tiers";

export default function AuthNavLink() {
  const t = useT();
  const [db] = useState(() => getClient());
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      rememberReferral();
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await db.auth.getUser();

        if (!cancelled) {
          setUserId(data.user?.id ?? "");
        }
        if (data.user) {
          void touchActivity(db, data.user.id);
          void applyStoredReferral(db);
        }
      } catch {
        if (!cancelled) {
          setUserId("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db]);

  if (loading) {
    return <span className="muted">...</span>;
  }

  if (userId) {
    return <Link href="/account">{t("nav.myAccount")}</Link>;
  }

  return (
    <Link
      href="/account"
      style={{
        fontWeight: 700,
      }}
    >
      {t("nav.login")}
    </Link>
  );
}