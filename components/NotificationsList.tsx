"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";
import NotificationItem from "@/components/NotificationItem";
import { useNotificationOpen } from "@/lib/useNotificationOpen";
import { fetchNotifications, isUnavailable, markAllRead, type NotificationRow } from "@/lib/notifications";

const PAGE = 30;

export default function NotificationsList() {
  const { t } = useLanguage();
  const [db] = useState(() => getClient());
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  const loadPage = useCallback(async (user: string, before?: string) => {
    if (!db) return;
    const { data, error } = await fetchNotifications(db, user, PAGE, before);
    if (error) { setState(isUnavailable(error) ? "unavailable" : "ready"); return; }
    const rows = (data ?? []) as unknown as NotificationRow[];
    setItems((c) => (before ? [...c, ...rows] : rows));
    setMore(rows.length === PAGE);
    setState("ready");
  }, [db]);

  useEffect(() => {
    if (!db) { setState("unavailable"); return; }
    void db.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? "";
      setUid(id);
      if (id) void loadPage(id); else setState("ready");
    });
  }, [db, loadPage]);

  const openItem = useNotificationOpen(db, (id) => {
    const now = new Date().toISOString();
    setItems((c) => c.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  });

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="notif-page">
      <div className="notif-page-head">
        <h1>{t("notif.title")}</h1>
        {hasUnread && db && uid && (
          <button type="button" className="secondary" onClick={() => {
            const now = new Date().toISOString();
            setItems((c) => c.map((n) => (n.read_at ? n : { ...n, read_at: now })));
            void markAllRead(db, uid);
          }}>{t("notif.markAll")}</button>
        )}
      </div>
      {state === "loading" ? (
        <p className="muted">…</p>
      ) : state === "unavailable" ? (
        <p className="notice">{t("notif.unavailable")}</p>
      ) : !uid ? (
        <p className="notice"><Link href="/account">{t("notif.signIn")}</Link></p>
      ) : items.length === 0 ? (
        <p className="notice">{t("notif.empty")}</p>
      ) : (
        <div className="card notif-page-list">
          {items.map((n) => <NotificationItem key={n.id} db={db!} item={n} onOpen={(x) => void openItem(x)} />)}
          {more && (
            <button type="button" className="secondary notif-more" onClick={() => void loadPage(uid, items[items.length - 1]?.created_at)}>
              {t("notif.loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
