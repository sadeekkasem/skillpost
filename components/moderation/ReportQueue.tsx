"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLanguage, useT } from "@/components/LanguageProvider";
import type { DictKey } from "@/lib/i18n";
import { loadTargets, type Report, type Target } from "@/components/admin/ReportsTab";

const deletable = new Set(["post", "project", "comment", "post_comment"]);

type Action = "dismiss" | "resolve" | "delete" | "suspend";

export default function ReportQueue({ db, onAction }: { db: SupabaseClient; onAction?: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [staff, setStaff] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await db
          .from("reports")
          .select("*,reporter:profiles!reports_reporter_id_fkey(username,full_name)")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Report[];
        const map = await loadTargets(db, rows);
        const owners = [...new Set(Object.values(map).map((x) => x.ownerId))];
        let staffIds = new Set<string>();
        if (owners.length) {
          const res = await db.from("profiles").select("id,is_admin,is_moderator").in("id", owners);
          const list = (res.data ?? []) as { id: string; is_admin: boolean; is_moderator: boolean }[];
          staffIds = new Set(list.filter((p) => p.is_admin || p.is_moderator).map((p) => p.id));
        }
        if (cancelled) return;
        setReports(rows);
        setTargets(map);
        setStaff(staffIds);
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : t("mod.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload, t]);

  async function act(report: Report, action: Action, target?: Target) {
    if (busy) return;
    const reason = (reasons[report.id] ?? "").trim();
    if (reason.length < 3) {
      setMessage(t("mod.reasonRequired"));
      return;
    }
    const d = days[report.id] ?? 1;
    if (action === "delete" && !window.confirm(t("mod.confirmDelete"))) return;
    if (action === "suspend" && !window.confirm(t("mod.confirmSuspend", { name: target?.ownerName ?? "", days: d }))) return;
    setBusy(report.id);
    setMessage("");
    try {
      if (action === "dismiss" || action === "resolve") {
        const { error } = await db.rpc("mod_resolve_report", {
          report_id: report.id,
          new_status: action === "dismiss" ? "dismissed" : "resolved",
          reason,
        });
        if (error) throw new Error(error.message);
        setMessage(t(action === "dismiss" ? "mod.done.dismiss" : "mod.done.resolve"));
      } else if (action === "delete") {
        const { data, error } = await db.rpc("mod_delete_content", {
          target_type: report.target_type,
          target_id: report.target_id,
          reason,
        });
        if (error) throw new Error(error.message);
        const out = (data ?? {}) as { bucket?: string | null; paths?: string[] };
        let filesOk = true;
        if (out.bucket && out.paths?.length) {
          const res = await db.storage.from(out.bucket).remove(out.paths);
          filesOk = !res.error;
        }
        setMessage(t(filesOk ? "mod.done.delete" : "mod.done.deleteFiles"));
      } else if (target) {
        const { data, error } = await db.rpc("mod_suspend_user", { target: target.ownerId, days: d, reason });
        if (error) throw new Error(error.message);
        const { error: closeError } = await db.rpc("mod_resolve_report", {
          report_id: report.id,
          new_status: "resolved",
          reason,
        });
        if (closeError) throw new Error(closeError.message);
        setMessage(t("mod.done.suspend", { date: new Date(String(data)).toLocaleString(lang) }));
      }
      setReasons((r) => ({ ...r, [report.id]: "" }));
      setReload((n) => n + 1);
      onAction?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("mod.failed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">{t("loading.text")}</p>}
      {!loading && reports.length === 0 && <p className="notice">{t("mod.noReports")}</p>}
      <div className="admin-list">
        {reports.map((report) => {
          const target = targets[`${report.target_type}:${report.target_id}`];
          const protectedTarget = Boolean(target && staff.has(target.ownerId));
          return (
            <article key={report.id} className="card admin-item">
              <div className="admin-item-main">
                <span>
                  <span className="badge">{t(`mod.type.${report.target_type}` as DictKey)}</span>{" "}
                  <span className="muted">{new Date(report.created_at).toLocaleString(lang)}</span>
                </span>
                {target ? (
                  <Link href={target.href} className="admin-item-title">{target.text || t("mod.view")}</Link>
                ) : (
                  <span className="muted">{t("mod.missing")}</span>
                )}
                {target && (
                  <span className="muted">
                    {t("mod.owner")} <Link href={`/profile/${target.ownerId}`}>{target.ownerName}</Link>
                  </span>
                )}
                <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t("mod.reason")} {report.reason}</span>
                <span className="muted">
                  {t("mod.reporter")}{" "}
                  <Link href={`/profile/${report.reporter_id}`}>
                    {report.reporter?.full_name || report.reporter?.username || t("mod.member")}
                  </Link>
                </span>
                {protectedTarget && <span className="muted">{t("mod.staffTarget")}</span>}
                <label style={{ marginTop: 8 }}>
                  {t("mod.actionReason")}
                  <input
                    value={reasons[report.id] ?? ""}
                    maxLength={500}
                    placeholder={t("mod.actionReasonHint")}
                    onChange={(e) => setReasons((r) => ({ ...r, [report.id]: e.target.value }))}
                  />
                </label>
              </div>
              <div className="admin-actions">
                <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void act(report, "dismiss")}>
                  {t("mod.dismiss")}
                </button>
                <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void act(report, "resolve")}>
                  {t("mod.resolve")}
                </button>
                {target && !protectedTarget && deletable.has(report.target_type) && (
                  <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void act(report, "delete")}>
                    {t("mod.delete")}
                  </button>
                )}
                {target && !protectedTarget && (
                  <span className="row">
                    <select
                      value={days[report.id] ?? 1}
                      onChange={(e) => setDays((d) => ({ ...d, [report.id]: Number(e.target.value) }))}
                      aria-label={t("mod.suspend")}
                      style={{ width: "auto", margin: 0 }}
                    >
                      <option value={1}>{t("mod.days1")}</option>
                      <option value={7}>{t("mod.days7")}</option>
                      <option value={30}>{t("mod.days30")}</option>
                    </select>
                    <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void act(report, "suspend", target)}>
                      {t("mod.suspend")}
                    </button>
                  </span>
                )}
                {busy === report.id && <span className="muted">{t("mod.working")}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
