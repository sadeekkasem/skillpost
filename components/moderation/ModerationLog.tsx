"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLanguage, useT } from "@/components/LanguageProvider";

type Entry = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  created_at: string;
  actor?: { username: string; full_name: string } | null;
};

/** Admins see every entry; moderators see their own (enforced by RLS). */
export default function ModerationLog({ db, reload = 0 }: { db: SupabaseClient; reload?: number }) {
  const t = useT();
  const { lang } = useLanguage();
  const [rows, setRows] = useState<Entry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await db
        .from("moderation_log")
        .select("*,actor:profiles!moderation_log_actor_id_fkey(username,full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as unknown as Entry[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  if (error) return <p className="muted">{t("mod.notReady")}</p>;
  if (!rows.length) return <p className="muted">{t("mod.logEmpty")}</p>;
  return (
    <div className="admin-list">
      {rows.map((r) => (
        <article key={r.id} className="card admin-item">
          <div className="admin-item-main">
            <span>
              <span className="badge">{r.action}</span>{" "}
              <span className="muted">{new Date(r.created_at).toLocaleString(lang)}</span>
            </span>
            <span className="muted">
              {t("mod.logActor")} {r.actor ? (r.actor.full_name || r.actor.username) : "-"} · {r.target_type}
              {r.target_type === "profile" && r.target_id && (
                <> · <Link href={`/profile/${r.target_id}`}>{r.target_id.slice(0, 8)}</Link></>
              )}
            </span>
            {r.reason && <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.reason}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
