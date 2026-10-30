"use client";

import { useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";

type Row = {
  id: string;
  username: string;
  full_name: string;
  excel_quota: number;
  used: number;
};

export default function ExcelQuotaAdmin() {
  const [db] = useState(() => getClient());
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!db) return;
    const q = query.trim().replace(/^@/, "").replace(/[%_,()*]/g, "");
    if (q.length < 2) {
      setMessage("اكتب حرفين على الأقل من اسم المستخدم أو الاسم.");
      return;
    }
    setBusy("search");
    setMessage("");
    const { data, error } = await db
      .from("profiles")
      .select("id,username,full_name,excel_quota")
      .or(`username.ilike.*${q}*,full_name.ilike.*${q}*`)
      .limit(10);
    if (error) {
      setBusy("");
      setMessage("تعذّر البحث: " + error.message);
      return;
    }
    const list = (data ?? []) as Omit<Row, "used">[];
    const withUsed: Row[] = await Promise.all(
      list.map(async (p) => {
        const { count } = await db
          .from("attachments")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", p.id)
          .or("name.ilike.*.xlsx,name.ilike.*.csv");
        return { ...p, excel_quota: p.excel_quota ?? 3, used: count ?? 0 };
      })
    );
    setRows(withUsed);
    setDrafts(Object.fromEntries(withUsed.map((r) => [r.id, String(r.excel_quota)])));
    if (withUsed.length === 0) setMessage("لا يوجد مستخدم بهذا الاسم.");
    setBusy("");
  }

  async function save(row: Row, value: number) {
    if (!db) return;
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setMessage("الحصة يجب أن تكون رقمًا بين 0 و100.");
      return;
    }
    setBusy(row.id);
    setMessage("");
    const { error } = await db.rpc("set_excel_quota", { target: row.id, quota: value });
    setBusy("");
    if (error) {
      setMessage("تعذّر الحفظ: " + error.message);
      return;
    }
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, excel_quota: value } : r)));
    setDrafts((cur) => ({ ...cur, [row.id]: String(value) }));
    setMessage(`تم: حصة @${row.username} صارت ${value} ملفات Excel.`);
  }

  if (!db) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      <h2>حصة ملفات Excel</h2>
      <p className="muted">
        كل حساب يبدأ بـ 3 ملفات. عند شراء ملفات إضافية، ابحث عن المستخدم وزد حصته.
      </p>

      <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اسم المستخدم أو الاسم"
          style={{ flex: 1, minWidth: 200 }}
        />
        <button disabled={busy === "search"}>{busy === "search" ? "جارٍ البحث..." : "بحث"}</button>
      </form>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {rows.map((row) => (
        <article key={row.id} className="card">
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong>{row.full_name || row.username}</strong>{" "}
              <Link href={`/profile/${row.id}`} className="muted">
                @{row.username}
              </Link>
              <div className="muted">
                مستخدم {row.used} من {row.excel_quota} ملفات Excel
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" disabled={busy === row.id} onClick={() => save(row, row.excel_quota + 3)}>
                +3
              </button>
              <button type="button" disabled={busy === row.id} onClick={() => save(row, row.excel_quota + 10)}>
                +10
              </button>
              <input
                type="number"
                min={0}
                max={100}
                value={drafts[row.id] ?? ""}
                onChange={(e) => setDrafts((cur) => ({ ...cur, [row.id]: e.target.value }))}
                style={{ width: 80 }}
                aria-label="الحصة"
              />
              <button
                type="button"
                className="secondary"
                disabled={busy === row.id}
                onClick={() => save(row, Number(drafts[row.id]))}
              >
                حفظ
              </button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
