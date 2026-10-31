"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useLanguage } from "@/components/LanguageProvider";
import { avatarUrl, relativeTime, TEXT_KEY, type NotificationRow } from "@/lib/notifications";

export default function NotificationItem({
  db, item, onOpen,
}: { db: SupabaseClient; item: NotificationRow; onOpen: (n: NotificationRow) => void }) {
  const { t, lang } = useLanguage();
  const name = item.actor?.full_name || item.actor?.username || t("notif.someone");
  const img = avatarUrl(db, item.actor?.avatar_path);
  return (
    <button type="button" role="menuitem" className={`notif-item${item.read_at ? "" : " unread"}`} onClick={() => onOpen(item)}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="notif-avatar" src={img} alt="" width={36} height={36} loading="lazy" />
      ) : (
        <span className="notif-avatar notif-avatar-fallback" aria-hidden>{name.trim().charAt(0)}</span>
      )}
      <span className="notif-body">
        <span className="notif-text"><b>{name}</b> {t(TEXT_KEY[item.type] ?? "notif.someone")}</span>
        <span className="notif-time">{relativeTime(item.created_at, lang)}</span>
      </span>
      {!item.read_at && <span className="notif-dot" aria-hidden />}
    </button>
  );
}
