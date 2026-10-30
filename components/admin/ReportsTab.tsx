"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Filters, PAGE_SIZE, Pager, errorText, formatDate, setBanned, sinceIso, type Period } from "./shared";

export type TargetType = "post" | "project" | "comment" | "post_comment" | "profile";

export type Report = {
  id: string;
  reporter_id: string;
  target_type: TargetType;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter?: { username: string; full_name: string } | null;
};

export type Target = { href: string; text: string; ownerId: string; ownerName: string };

const typeLabels: Record<TargetType, string> = {
  post: "منشور",
  project: "مشروع",
  comment: "تعليق على مشروع",
  post_comment: "تعليق على منشور",
  profile: "حساب عضو",
};

const tables: Partial<Record<TargetType, string>> = {
  post: "posts",
  project: "projects",
  comment: "comments",
  post_comment: "post_comments",
};

const statusLabels: Record<string, string> = { open: "مفتوحة", resolved: "محلولة", dismissed: "متجاهلة" };

type Owner = { id: string; username: string; full_name: string } | null;
type TargetRow = { id: string; user_id: string; title?: string; content?: string; project_id?: string; owner?: Owner };

export async function loadTargets(db: SupabaseClient, rows: Report[]) {
  const ids = (t: TargetType) => [...new Set(rows.filter((r) => r.target_type === t).map((r) => r.target_id))];
  const owner = "owner:profiles!%s(id,username,full_name)";
  const q = (table: string, cols: string, fk: string, list: string[]) =>
    list.length ? db.from(table).select(`${cols},${owner.replace("%s", fk)}`).in("id", list) : null;
  const profileIds = ids("profile");
  const [projects, posts, comments, postComments, profiles] = await Promise.all([
    q("projects", "id,user_id,title", "projects_user_id_fkey", ids("project")),
    q("posts", "id,user_id,content", "posts_user_id_fkey", ids("post")),
    q("comments", "id,user_id,content,project_id", "comments_user_id_fkey", ids("comment")),
    q("post_comments", "id,user_id,content", "post_comments_user_id_fkey", ids("post_comment")),
    profileIds.length ? db.from("profiles").select("id,username,full_name").in("id", profileIds) : null,
  ]);
  const map: Record<string, Target> = {};
  const name = (o?: Owner) => o?.full_name || o?.username || "عضو";
  const add = (type: TargetType, list: TargetRow[] | null | undefined, href: (r: TargetRow) => string) => {
    for (const r of list ?? [])
      map[`${type}:${r.id}`] = {
        href: href(r),
        text: (r.title || r.content || "").slice(0, 160),
        ownerId: r.user_id,
        ownerName: name(r.owner),
      };
  };
  add("project", projects?.data as unknown as TargetRow[], (r) => `/projects/${r.id}`);
  add("post", posts?.data as unknown as TargetRow[], (r) => `/profile/${r.user_id}`);
  add("comment", comments?.data as unknown as TargetRow[], (r) => `/projects/${r.project_id}`);
  add("post_comment", postComments?.data as unknown as TargetRow[], (r) => `/profile/${r.user_id}`);
  for (const p of (profiles?.data ?? []) as { id: string; username: string; full_name: string }[])
    map[`profile:${p.id}`] = { href: `/profile/${p.id}`, text: `@${p.username}`, ownerId: p.id, ownerName: name(p) };
  return map;
}

export default function ReportsTab({ db, onChanged }: { db: SupabaseClient; onChanged?: () => void }) {
  const [status, setStatus] = useState("open");
  const [type, setType] = useState<"" | TargetType>("");
  const [period, setPeriod] = useState<Period>("all");
  const [page, setPage] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let req = db
          .from("reports")
          .select("*,reporter:profiles!reports_reporter_id_fkey(username,full_name)", { count: "exact" })
          .eq("status", status)
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (type) req = req.eq("target_type", type);
        const since = sinceIso(period);
        if (since) req = req.gte("created_at", since);
        const { data, error, count } = await req;
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Report[];
        const map = await loadTargets(db, rows);
        if (cancelled) return;
        setReports(rows);
        setTargets(map);
        setTotal(count ?? 0);
      } catch (error) {
        if (!cancelled) setMessage(errorText(error, "تعذر تحميل البلاغات."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [db, status, type, period, page, reload]);

  async function closeReports(report: Report, next: "resolved" | "dismissed") {
    const { error } = await db
      .from("reports")
      .update({ status: next })
      .eq("target_type", report.target_type)
      .eq("target_id", report.target_id)
      .eq("status", "open");
    if (error) throw new Error(error.message);
  }

  async function act(report: Report, action: "delete" | "dismiss" | "ban") {
    if (busyId) return;
    const target = targets[`${report.target_type}:${report.target_id}`];
    if (action === "delete" && !window.confirm("حذف المحتوى المبلغ عنه نهائيًا؟ لا يمكن التراجع.")) return;
    setBusyId(report.id);
    setMessage("");
    try {
      if (action === "delete") {
        const table = tables[report.target_type];
        if (!table) throw new Error("لا يمكن حذف هذا النوع من هنا.");
        if (table === "projects") {
          const { data } = await db.from("attachments").select("path").eq("project_id", report.target_id);
          const paths = ((data ?? []) as { path: string }[]).map((a) => a.path);
          if (paths.length) {
            const res = await db.storage.from("project-files").remove(paths);
            if (res.error) throw new Error("تعذر حذف ملفات المشروع من التخزين؛ لم يُحذف المشروع.");
          }
        }
        if (table === "posts") {
          const { data } = await db.from("posts").select("image_path").eq("id", report.target_id).maybeSingle();
          const img = (data as { image_path: string | null } | null)?.image_path;
          if (img) await db.storage.from("post-images").remove([img]);
        }
        const { error } = await db.from(table).delete().eq("id", report.target_id);
        if (error) throw new Error(error.message);
        await closeReports(report, "resolved");
        setMessage("تم حذف المحتوى وإغلاق البلاغ.");
      } else if (action === "dismiss") {
        await closeReports(report, "dismissed");
        setMessage("تم تجاهل البلاغ.");
      } else {
        if (!target) throw new Error("صاحب المحتوى غير معروف.");
        if (!(await setBanned(db, target.ownerId, true, target.ownerName))) return;
        await closeReports(report, "resolved");
        setMessage("تم حظر العضو وإغلاق البلاغ.");
      }
      setReload((n) => n + 1);
      onChanged?.();
    } catch (error) {
      setMessage(errorText(error, "تعذر تنفيذ الإجراء."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <Filters period={period} onPeriod={(p) => { setPeriod(p); setPage(0); }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="الحالة">
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value as "" | TargetType); setPage(0); }} aria-label="النوع">
          <option value="">كل الأنواع</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Filters>
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">جار تحميل البلاغات...</p>}
      {!loading && reports.length === 0 && <p className="notice">لا توجد بلاغات.</p>}
      <div className="admin-list">
        {reports.map((report) => {
          const target = targets[`${report.target_type}:${report.target_id}`];
          return (
            <article key={report.id} className="card admin-item">
              <div className="admin-item-main">
                <span>
                  <span className="badge">{typeLabels[report.target_type] ?? report.target_type}</span>{" "}
                  <span className="muted">{formatDate(report.created_at)}</span>
                </span>
                {target ? (
                  <Link href={target.href} className="admin-item-title">{target.text || "عرض المحتوى"}</Link>
                ) : (
                  <span className="muted">المحتوى غير موجود (ربما حُذف).</span>
                )}
                {target && <span className="muted">صاحب المحتوى: <Link href={`/profile/${target.ownerId}`}>{target.ownerName}</Link></span>}
                <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>السبب: {report.reason}</span>
                <span className="muted">
                  المبلِّغ: <Link href={`/profile/${report.reporter_id}`}>{report.reporter?.full_name || report.reporter?.username || "عضو"}</Link>
                </span>
              </div>
              {report.status === "open" && (
                <div className="admin-actions">
                  <button type="button" className="ghost" disabled={Boolean(busyId)} onClick={() => void act(report, "dismiss")}>تجاهل</button>
                  {tables[report.target_type] && target && (
                    <button type="button" className="secondary" disabled={Boolean(busyId)} onClick={() => void act(report, "delete")}>حذف المحتوى</button>
                  )}
                  {target && (
                    <button type="button" className="secondary" disabled={Boolean(busyId)} onClick={() => void act(report, "ban")}>حظر العضو</button>
                  )}
                  {busyId === report.id && <span className="muted">جار التنفيذ...</span>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
