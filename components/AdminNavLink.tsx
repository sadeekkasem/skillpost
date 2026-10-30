"use client";


import { useT } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";

export default function AdminNavLink() {
  const t = useT();
  const [db] = useState(() => getClient());
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!db) return;

      try {
        const { data } = await db.auth.getUser();
        const userId = data.user?.id;

        if (!userId) {
          setIsAdmin(false);
          return;
        }

        const { data: profile } = await db
          .from("profiles")
          .select("is_admin")
          .eq("id", userId)
          .single();

        if (!cancelled) {
           setIsAdmin(profile?.is_admin === true);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!isAdmin) return null;

  return <Link href="/admin">{t("nav.admin")}</Link>;
}