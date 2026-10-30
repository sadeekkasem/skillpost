"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import type { SupabaseClient } from "@supabase/supabase-js";
import TierBadge from "@/components/TierBadge";
import type { Tier } from "@/lib/tiers";
import { Filters, PAGE_SIZE, Pager, cleanQuery, errorText, formatDate, setBanned, sinceIso, type Period } from "./shared";

type Member = {
  id: string;
  username: string;
  full_name: string;
  created_at: string;
  is_admin: boolean;
  is_banned?: boolean;
  email_confirmed?: boolean;
};

type TierRow = { id: string; tier: Tier; diamond_until: string | null };

function plusMonth(from?: string | null): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Helsinki" });
  const base = new Date(`${from && from > today ? from : today}T12:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export default function UsersTab({ db, onChanged }: { db: SupabaseClient; onChanged?: () => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [hasBan, setHasBan] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [tiers, setTiers] = useState<Record<string, TierRow> | null>(null);
  const [until, setUntil] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const build = (cols: string, withBan: boolean) => {
          let req = db
            .from("profiles")
            .select(cols, { count: "exact" })
            .order("created_at", { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
          const since = sinceIso(period);
          if (since) req = req.gte("created_at", since);
          const q = cleanQuery(query);
          if (q) req = req.or(`username.ilike.*${q}*,full_name.ilike.*${q}*`);
          if (withBan && bannedOnly) req = req.eq("is_banned", true);
          return req;
        };
        let res = await build("id,username,full_name,created_at,is_admin,is_banned,email_confirmed", true);
        let withBan = true;
        if (res.error && /email_confirmed/.test(res.error.message)) {
          res = await build("id,username,full_name,created_at,is_admin,is_banned", true);
        }
        if (res.error && /is_banned/.test(res.error.message)) {
          withBan = false;
          res = await build("id,username,full_name,created_at,is_admin", false);
        }
        if (res.error) throw new Error(res.error.message);
        if (cancelled) return;
        setHasBan(withBan);
        const list = (res.data ?? []) as unknown as Member[];
        setRows(list);
        setTotal(res.count ?? 0);
        const t = list.length ? await db.rpc("admin_tiers", { ids: list.map((m) => m.id) }) : { data: [], error: null };
        if (cancelled) return;
        setTiers(t.error ? null : Object.fromEntries(((t.data ?? []) as TierRow[]).map((r) => [r.id, r])));
      } catch (error) {
        if (!cancelled) setMessage(errorText(error, "تعذر تحميل المشتركين."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [db, query, period, bannedOnly, page, reload]);

  async function toggle(m: Member) {
    if (busy) return;
    setBusy(m.id);
    setMessage("");
    try {
      if (await setBanned(db, m.id, !m.is_banned, m.full_name || m.username)) {
        setMessage(m.is_banned ? "تم إلغاء الحظر." : "تم حظر العضو.");
        setReload((n) => n + 1);
        onChanged?.();
      }
    } catch (error) {
      setMessage(errorText(error, "تعذر تنفيذ الإجراء."));
    } finally {
      setBusy("");
    }
  }

  async function setDiamond(m: Member, date: string | null) {
    if (busy) return;
    const who = m.full_name || m.username;
    const ok = window.confirm(
      date ? `تفعيل عضوية ماسي لـ «${who}» حتى ${date}؟` : `إزالة عضوية ماسي من «${who}»؟`
    );
    if (!ok) return;
    setBusy(m.id);
    setMessage("");
    try {
      const { error } = await db.rpc("set_diamond", { target: m.id, until: date });
      if (error) throw new Error(error.message);
      setMessage(date ? `تم تفعيل ماسي حتى ${date}.` : "تمت إزالة ماسي.");
      setReload((n) => n + 1);
      onChanged?.();
    } catch (error) {
      setMessage(errorText(error, "تعذر تنفيذ الإجراء."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <Filters
        query={query}
        onQuery={(q) => { setQuery(q); setPage(0); }}
        placeholder="ابحث باسم المستخدم أو الاسم"
        period={period}
        onPeriod={(p) => { setPeriod(p); setPage(0); }}
      >
        {hasBan && (
          <label className="admin-check">
            <input type="checkbox" checked={bannedOnly} onChange={(e) => { setBannedOnly(e.target.checked); setPage(0); }} />
            المحظورون فقط
          </label>
        )}
      </Filters>
      {!hasBan && <p className="notice">ميزة الحظر غير مفعلة بعد: شغّل ملف التحديث في Supabase.</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">جار التحميل...</p>}
      {!loading && rows.length === 0 && <p className="notice">لا يوجد مشتركون.</p>}
      <div className="admin-list">
        {rows.map((m) => (
          <article key={m.id} className="card admin-item">
            <div className="admin-item-main">
              <Link href={`/profile/${m.id}`} className="admin-item-title">{m.full_name || m.username}</Link>
              <span className="muted">
                <bdi>@{m.username}</bdi> · انضم {formatDate(m.created_at)}
              </span>
              <span>
                {m.is_admin && <span className="badge">مدير</span>}{" "}
                {m.email_confirmed === false && <span className="badge admin-badge-danger">{t("admin.unconfirmed")}</span>}{" "}
                {m.is_banned && <span className="badge admin-badge-danger">محظور</span>}{" "}
                {tiers?.[m.id] && <TierBadge tier={tiers[m.id].tier} />}
                {tiers?.[m.id]?.diamond_until && (
                  <span className="muted"> ماسي حتى {tiers[m.id].diamond_until}</span>
                )}
              </span>
            </div>
            {tiers?.[m.id] && (
              <div className="admin-actions admin-diamond">
                <input
                  type="date"
                  aria-label="ماسي حتى"
                  value={until[m.id] ?? plusMonth(tiers[m.id].diamond_until)}
                  onChange={(e) => setUntil((u) => ({ ...u, [m.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => void setDiamond(m, until[m.id] ?? plusMonth(tiers[m.id].diamond_until))}
                >
                  {tiers[m.id].diamond_until ? "💎 تمديد ماسي" : "💎 تفعيل ماسي"}
                </button>
                {tiers[m.id].diamond_until && (
                  <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void setDiamond(m, null)}>
                    إزالة ماسي
                  </button>
                )}
              </div>
            )}
            {hasBan && !m.is_admin && (
              <div className="admin-actions">
                <button type="button" className={m.is_banned ? "ghost" : "secondary"} disabled={Boolean(busy)} onClick={() => void toggle(m)}>
                  {busy === m.id ? "جار التنفيذ..." : m.is_banned ? "إلغاء الحظر" : "حظر"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
