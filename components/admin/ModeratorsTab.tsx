"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useT } from "@/components/LanguageProvider";
import ModerationLog from "@/components/moderation/ModerationLog";

type Person = { id: string; username: string; full_name: string; email: string | null; is_admin?: boolean; is_moderator?: boolean };

export default function ModeratorsTab({ db }: { db: SupabaseClient }) {
  const t = useT();
  const [mods, setMods] = useState<Person[]>([]);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await db.rpc("admin_list_moderators");
      if (cancelled) return;
      if (error) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setMods((data ?? []) as Person[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const { data, error } = await db.rpc("admin_find_profiles", { q: query.trim() });
    if (error) {
      setMessage(error.message);
      return;
    }
    setResults((data ?? []) as Person[]);
  }

  async function setModerator(p: Person, enabled: boolean) {
    const name = p.full_name || p.username;
    if (!window.confirm(t(enabled ? "admin.modConfirmGrant" : "admin.modConfirmRevoke", { name }))) return;
    setBusy(p.id);
    setMessage("");
    const { error } = await db.rpc("admin_set_moderator", { target: p.id, enabled });
    setBusy("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t(enabled ? "admin.modGranted" : "admin.modRevoked"));
    setResults((r) => r?.map((x) => (x.id === p.id ? { ...x, is_moderator: enabled } : x)) ?? null);
    setReload((n) => n + 1);
  }

  if (missing) return <p className="notice">{t("mod.notReady")}</p>;

  const who = (p: Person) => (
    <div className="admin-item-main">
      <Link href={`/profile/${p.id}`} className="admin-item-title">{p.full_name || p.username}</Link>
      <span className="muted">@{p.username}{p.email ? ` · ${p.email}` : ""}</span>
    </div>
  );

  return (
    <div>
      {message && <p className="notice" role="status">{message}</p>}
      <p><Link href="/moderation">{t("nav.moderation")}</Link></p>

      <h3>{t("admin.modList")}</h3>
      {mods.length === 0 && <p className="muted">{t("admin.modNone")}</p>}
      <div className="admin-list">
        {mods.map((p) => (
          <article key={p.id} className="card admin-item">
            {who(p)}
            <div className="admin-actions">
              <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void setModerator(p, false)}>
                {t("admin.modRevoke")}
              </button>
            </div>
          </article>
        ))}
      </div>

      <h3>{t("admin.modAdd")}</h3>
      <form className="admin-filters" onSubmit={search}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.modSearch")} aria-label={t("admin.modSearch")} />
        <button type="submit">{t("admin.modSearchBtn")}</button>
      </form>
      {results && results.length === 0 && <p className="muted">{t("admin.modNoResults")}</p>}
      <div className="admin-list">
        {results?.map((p) => (
          <article key={p.id} className="card admin-item">
            {who(p)}
            <div className="admin-actions">
              {p.is_admin ? (
                <span className="badge">{t("admin.modIsAdmin")}</span>
              ) : p.is_moderator ? (
                <span className="badge">{t("admin.modIsMod")}</span>
              ) : (
                <button type="button" disabled={Boolean(busy)} onClick={() => void setModerator(p, true)}>
                  {t("admin.modGrant")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <h3>{t("mod.log")}</h3>
      <ModerationLog db={db} reload={reload} />
    </div>
  );
}
