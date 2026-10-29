"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";

type Report = {
  id: string;
  reporter_id: string;
  target_type: "post" | "project" | "comment" | "post_comment" | "profile";
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  profiles?: { username: string; full_name: string } | null;
};

const typeLabels: Record<Report["target_type"], string> = {
  post: "منشور",
  project: "مشروع",
  comment: "تعليق على مشروع",
  post_comment: "تعليق على منشور",
  profile: "حساب عضو",
};

const tables: Partial<Record<Report["target_type"], string>> = {
  post: "posts",
  project: "projects",
  comment: "comments",
  post_comment: "post_comments",
};

export default function ReportsAdmin() {
  const [db] = useState(() => getClient());
  const [reports, setReports] = useState<Report[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!db) throw new Error("قاعدة البيانات غير متصلة.");
    const { data, error } = await db
      .from("reports")
      .select("*,profiles!reports_reporter_id_fkey(username,full_name)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Report[];

    const ids = (type: Report["target_type"]) =>
      [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))];
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.target_type === "project") map[r.id] = `/projects/${r.target_id}`;
      if (r.target_type === "profile") map[r.id] = `/profile/${r.target_id}`;
    }
    const postIds = ids("post");
    const commentIds = ids("comment");
    const postCommentIds = ids("post_comment");
    const [posts, comments, postComments] = await Promise.all([
      postIds.length ? db.from("posts").select("id,user_id").in("id", postIds) : null,
      commentIds.length ? db.from("comments").select("id,project_id").in("id", commentIds) : null,
      postCommentIds.length ? db.from("post_comments").select("id,user_id").in("id", postCommentIds) : null,
    ]);
    const owner = new Map<string, string>();
    for (const p of (posts?.data ?? []) as { id: string; user_id: string }[]) owner.set(p.id, `/profile/${p.user_id}`);
    for (const c of (comments?.data ?? []) as { id: string; project_id: string }[]) owner.set(c.id, `/projects/${c.project_id}`);
    for (const c of (postComments?.data ?? []) as { id: string; user_id: string }[]) owner.set(c.id, `/profile/${c.user_id}`);
    for (const r of rows) {
      const href = owner.get(r.target_id);
      if (href && !map[r.id]) map[r.id] = href;
    }
    return { rows, map };
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ rows, map }) => {
        if (cancelled) return;
        setReports(rows);
        setLinks(map);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "تعذر تحميل البلاغات.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function setStatus(report: Report, status: "resolved" | "dismissed") {
    if (!db) return;
    const { error } = await db
      .from("reports")
      .update({ status })
      .eq("target_type", report.target_type)
      .eq("target_id", report.target_id)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    setReports((current) =>
      current.filter((r) => !(r.target_type === report.target_type && r.target_id === report.target_id))
    );
  }

  async function act(report: Report, action: "delete" | "dismiss") {
    if (!db || busyId) return;
    if (action === "delete" && !window.confirm("حذف المحتوى المبلغ عنه نهائيًا؟")) return;
    setBusyId(report.id);
    setMessage("");
    try {
      if (action === "delete") {
        const table = tables[report.target_type];
        if (!table) throw new Error("لا يمكن حذف هذا النوع من هنا.");
        const { error } = await db.from(table).delete().eq("id", report.target_id);
        if (error) throw new Error(error.message);
        await setStatus(report, "resolved");
        setMessage("تم حذف المحتوى وإغلاق البلاغ.");
      } else {
        await setStatus(report, "dismissed");
        setMessage("تم تجاهل البلاغ.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <h2>البلاغات</h2>
      <p className="muted">البلاغات المفتوحة (آخر 100).</p>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {loading && <p>جارٍ تحميل البلاغات...</p>}
      {!loading && reports.length === 0 && <p className="notice">لا توجد بلاغات مفتوحة.</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {reports.map((report) => (
          <article key={report.id} className="card">
            <p>
              <span className="badge">{typeLabels[report.target_type] ?? report.target_type}</span>{" "}
              <span className="muted">{new Date(report.created_at).toLocaleString("ar")}</span>
            </p>
            <p>
              المبلِّغ:{" "}
              <Link href={`/profile/${report.reporter_id}`}>
                {report.profiles?.full_name || report.profiles?.username || "عضو"}
              </Link>
            </p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>السبب: {report.reason}</p>
            <p>
              {links[report.id] ? (
                <Link href={links[report.id]}>عرض المحتوى</Link>
              ) : (
                <span className="muted">المحتوى غير موجود (ربما حُذف).</span>
              )}
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {tables[report.target_type] && (
                <button type="button" className="danger" disabled={Boolean(busyId)} onClick={() => void act(report, "delete")}>
                  حذف المحتوى
                </button>
              )}
              <button type="button" className="secondary" disabled={Boolean(busyId)} onClick={() => void act(report, "dismiss")}>
                تجاهل
              </button>
              {busyId === report.id && <span>جارٍ التنفيذ...</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
