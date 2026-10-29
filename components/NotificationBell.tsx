"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase";

type NotificationType = "post_like" | "post_comment" | "project_like" | "project_comment" | "friend_request" | "friend_accept";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
  actor?: { username: string | null; full_name: string | null } | null;
};

const TEXT: Record<NotificationType, string> = {
  post_like: "أعجب بمنشورك",
  post_comment: "علّق على منشورك",
  project_like: "أعجب بمشروعك",
  project_comment: "علّق على مشروعك",
  friend_request: "أرسل لك طلب صداقة",
  friend_accept: "قبل طلب صداقتك",
};

function relativeTime(value: string): string {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  if (Number.isNaN(diff)) return "";
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / 2592000), "month");
}

export default function NotificationBell() {
  const [db] = useState(() => getClient());
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const { data } = await db.auth.getUser();
      const uid = data.user?.id ?? "";
      setUserId(uid);
      if (!uid) {
        setItems([]);
        setUnread(0);
        return;
      }
      const [list, count] = await Promise.all([
        db
          .from("notifications")
          .select("*,actor:profiles!notifications_actor_id_fkey(username,full_name)")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20),
        db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
      ]);
      if (!list.error) setItems((list.data ?? []) as unknown as NotificationRow[]);
      if (!count.error) setUnread(count.count ?? 0);
    } catch {
      // ignore network errors; next poll retries
    }
  }, [db]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 60000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const sub = db?.auth.onAuthStateChange(() => {
      setTimeout(() => void load(), 0);
    });
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      sub?.data.subscription.unsubscribe();
    };
  }, [db, load]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openItem(item: NotificationRow) {
    setOpen(false);
    if (db && !item.read_at) {
      const now = new Date().toISOString();
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read_at: now } : n)));
      setUnread((c) => Math.max(0, c - 1));
      await db.from("notifications").update({ read_at: now }).eq("id", item.id);
    }
    if (item.project_id) router.push(`/projects/${item.project_id}`);
    else if (item.type === "friend_request" || item.type === "friend_accept") router.push("/friends");
    else if (item.post_id) router.push(`/profile/${item.user_id}`);
    else router.push("/");
  }

  async function markAllRead() {
    if (!db || !userId) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    await db.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
  }

  if (!db || !userId) return null;

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="secondary"
        aria-label={unread > 0 ? `الإشعارات (${unread} غير مقروء)` : "الإشعارات"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative", padding: "4px 10px", lineHeight: 1 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-6px",
              left: "-6px",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "999px",
              backgroundColor: "#dc2626",
              color: "white",
              fontSize: "12px",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "min(340px, 92vw)",
            maxHeight: "70vh",
            overflowY: "auto",
            background: "white",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 50,
            textAlign: "right",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
            <strong>الإشعارات</strong>
            {unread > 0 && (
              <button type="button" className="secondary" onClick={() => void markAllRead()} style={{ fontSize: "13px", padding: "2px 8px" }}>
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted" style={{ padding: "12px", margin: 0 }}>
              لا توجد إشعارات.
            </p>
          ) : (
            items.map((item) => {
              const name = item.actor?.full_name || item.actor?.username || "مستخدم";
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void openItem(item)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "right",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    borderRadius: 0,
                    background: item.read_at ? "white" : "#eff6ff",
                    color: "#0f172a",
                    cursor: "pointer",
                    fontWeight: item.read_at ? 400 : 600,
                  }}
                >
                  <div style={{ overflowWrap: "anywhere" }}>
                    {name} {TEXT[item.type] ?? ""}
                  </div>
                  <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                    {relativeTime(item.created_at)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}