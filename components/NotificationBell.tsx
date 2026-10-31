"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";
import NotificationItem from "@/components/NotificationItem";
import { useNotificationOpen } from "@/lib/useNotificationOpen";
import {
  fetchNotifications, fetchUnreadCount, isUnavailable, markAllRead, type NotificationRow,
} from "@/lib/notifications";

export default function NotificationBell() {
  const { t } = useLanguage();
  const [db] = useState(() => getClient());
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      const { data } = await db.auth.getUser();
      const uid = data.user?.id ?? "";
      setUserId(uid);
      if (!uid) { setItems([]); setUnread(0); return; }
      const [list, count] = await Promise.all([fetchNotifications(db, uid, 20), fetchUnreadCount(db, uid)]);
      if (isUnavailable(list.error) || isUnavailable(count.error)) { setDisabled(true); return; }
      if (!list.error) setItems((list.data ?? []) as unknown as NotificationRow[]);
      if (!count.error) setUnread(count.count ?? 0);
    } catch {
      // network error; next poll retries
    }
  }, [db]);

  useEffect(() => {
    if (disabled) return;
    const first = setTimeout(() => void load(), 0);
    const interval = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const sub = db?.auth.onAuthStateChange(() => { setTimeout(() => void load(), 0); });
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      sub?.data.subscription.unsubscribe();
    };
  }, [db, load, disabled]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openItem = useNotificationOpen(db, (id) => {
    const now = new Date().toISOString();
    setItems((c) => c.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    setUnread((c) => Math.max(0, c - 1));
  });

  async function readAll() {
    if (!db || !userId) return;
    const now = new Date().toISOString();
    setItems((c) => c.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    await markAllRead(db, userId);
  }

  if (!db || !userId || disabled) return null;

  return (
    <div ref={boxRef} className="notif-bell">
      <button
        type="button"
        className="notif-bell-btn"
        aria-label={unread > 0 ? t("notif.unread", { count: unread }) : t("notif.title")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div role="menu" className="notif-panel">
          <div className="notif-head">
            <strong>{t("notif.title")}</strong>
            {unread > 0 && (
              <button type="button" className="notif-link-btn" onClick={() => void readAll()}>{t("notif.markAll")}</button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">{t("notif.empty")}</p>
            ) : (
              items.map((item) => (
                <NotificationItem key={item.id} db={db} item={item} onOpen={(n) => { setOpen(false); void openItem(n); }} />
              ))
            )}
          </div>
          <Link href="/notifications" className="notif-all" onClick={() => setOpen(false)}>{t("notif.viewAll")}</Link>
        </div>
      )}
    </div>
  );
}
