"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Filters, PAGE_SIZE, Pager, cleanQuery, errorText, formatDate, setBanned, sinceIso, type Period } from "./shared";

type Member = {
  id: string;
  username: string;
  full_name: string;
  created_at: string;
  is_admin: boolean;
  is_banned?: boolean;
};

export default function UsersTab({ db, onChanged }: { db: SupabaseClient; onChanged?: () => void }) {
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
        let res = await build("id,username,full_name,created_at,is_admin,is_banned", true);
        let withBan = true;
        if (res.error && /is_banned/.test(res.error.message)) {
          withBan = false;
          res = await build("id,username,full_name,created_at,is_admin", false);
        }
        if (res.error) throw new Error(res.error.message);
        if (cancelled) return;
        setHasBan(withBan);
        setRows((res.data ?? []) as unknown as Member[]);
        setTotal(res.count ?? 0);
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
                {m.is_banned && <span className="badge admin-badge-danger">محظور</span>}
              </span>
            </div>
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
