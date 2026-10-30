"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Filters, PAGE_SIZE, Pager, cleanQuery, errorText, formatDate, matchUserIds, setBanned, sinceIso,
  type Period,
} from "./shared";

export type ContentKind = "projects" | "posts" | "comments" | "post_comments";

type Author = { id: string; username: string; full_name: string; is_banned?: boolean } | null;

type Row = {
  id: string;
  user_id: string;
  created_at: string;
  title?: string;
  content?: string;
  description?: string;
  project_id?: string;
  image_path?: string | null;
  author?: Author;
};

const config: Record<ContentKind, { label: string; select: string; text: "title" | "content"; fk: string }> = {
  projects: { label: "المشاريع", select: "id,user_id,created_at,title,description", text: "title", fk: "projects_user_id_fkey" },
  posts: { label: "المنشورات", select: "id,user_id,created_at,content,image_path", text: "content", fk: "posts_user_id_fkey" },
  comments: { label: "تعليقات المشاريع", select: "id,user_id,created_at,content,project_id", text: "content", fk: "comments_user_id_fkey" },
  post_comments: { label: "تعليقات المنشورات", select: "id,user_id,created_at,content", text: "content", fk: "post_comments_user_id_fkey" },
};

function linkFor(kind: ContentKind, row: Row) {
  if (kind === "projects") return `/projects/${row.id}`;
  if (kind === "comments" && row.project_id) return `/projects/${row.project_id}`;
  return `/profile/${row.user_id}`;
}

type Props = {
  db: SupabaseClient;
  kinds: ContentKind[];
  defaultPeriod?: Period;
  onChanged?: () => void;
};

export default function ContentList({ db, kinds, defaultPeriod = "all", onChanged }: Props) {
  const [kind, setKind] = useState<ContentKind>(kinds[0]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const c = config[kind];
        let req = db
          .from(kind)
          .select(`${c.select},author:profiles!${c.fk}(id,username,full_name)`, { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        const since = sinceIso(period);
        if (since) req = req.gte("created_at", since);
        const q = cleanQuery(query);
        if (q) {
          const ids = await matchUserIds(db, q);
          const parts = [`${c.text}.ilike.*${q}*`];
          if (ids.length) parts.push(`user_id.in.(${ids.join(",")})`);
          req = req.or(parts.join(","));
        }
        const { data, error, count } = await req;
        if (error) throw new Error(error.message);
        if (cancelled) return;
        setRows((data ?? []) as unknown as Row[]);
        setTotal(count ?? 0);
      } catch (error) {
        if (!cancelled) setMessage(errorText(error, "تعذر تحميل القائمة."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [db, kind, query, period, page, reload]);

  async function remove(row: Row) {
    if (busy) return;
    const label = row.title || (row.content ?? "").slice(0, 40);
    if (!window.confirm(`حذف «${label}» نهائيًا؟ لا يمكن التراجع.`)) return;
    setBusy(row.id);
    setMessage("");
    try {
      if (kind === "projects") {
        const { data } = await db.from("attachments").select("path").eq("project_id", row.id);
        const paths = ((data ?? []) as { path: string }[]).map((a) => a.path);
        if (paths.length) {
          const res = await db.storage.from("project-files").remove(paths);
          if (res.error) throw new Error("تعذر حذف ملفات المشروع من التخزين؛ لم يُحذف المشروع.");
        }
      }
      const { error } = await db.from(kind).delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      if (kind === "posts" && row.image_path) await db.storage.from("post-images").remove([row.image_path]);
      setMessage("تم الحذف.");
      setReload((n) => n + 1);
      onChanged?.();
    } catch (error) {
      setMessage(errorText(error, "تعذر الحذف."));
    } finally {
      setBusy("");
    }
  }

  async function ban(row: Row) {
    if (busy || !row.author) return;
    setBusy(row.id);
    setMessage("");
    try {
      if (await setBanned(db, row.user_id, true, row.author.full_name || row.author.username)) {
        setMessage("تم حظر العضو.");
        onChanged?.();
      }
    } catch (error) {
      setMessage(errorText(error, "تعذر الحظر."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      {kinds.length > 1 && (
        <div className="admin-subtabs">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className={k === kind ? "" : "ghost"}
              onClick={() => {
                setKind(k);
                setPage(0);
              }}
            >
              {config[k].label}
            </button>
          ))}
        </div>
      )}
      <Filters
        query={query}
        onQuery={(q) => {
          setQuery(q);
          setPage(0);
        }}
        placeholder="ابحث بالعنوان/النص أو اسم العضو"
        period={period}
        onPeriod={(p) => {
          setPeriod(p);
          setPage(0);
        }}
      />
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">جار التحميل...</p>}
      {!loading && rows.length === 0 && <p className="notice">لا توجد عناصر.</p>}
      <div className="admin-list">
        {rows.map((row) => (
          <article key={row.id} className="card admin-item">
            <div className="admin-item-main">
              <Link href={linkFor(kind, row)} className="admin-item-title">
                {row.title || (row.content ?? "").slice(0, 140) || "(بدون نص)"}
              </Link>
              <span className="muted">
                {row.author ? (
                  <Link href={`/profile/${row.user_id}`}>{row.author.full_name || row.author.username}</Link>
                ) : (
                  "عضو"
                )}{" "}
                · {formatDate(row.created_at)}
              </span>
            </div>
            <div className="admin-actions">
              <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void remove(row)}>
                {busy === row.id ? "جار التنفيذ..." : "حذف"}
              </button>
              <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void ban(row)}>
                حظر الكاتب
              </button>
            </div>
          </article>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
