"use client";

import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { markRead, targetOf, type NotificationRow } from "@/lib/notifications";

/** Marks a notification read (optimistically via onRead) and goes to its target. */
export function useNotificationOpen(db: SupabaseClient | null, onRead: (id: string) => void) {
  const router = useRouter();
  return async (n: NotificationRow) => {
    if (db && !n.read_at) {
      onRead(n.id);
      void markRead(db, n.id);
    }
    const target = targetOf(n);
    if (target.chatWith) window.dispatchEvent(new CustomEvent("open-chat", { detail: { id: target.chatWith } }));
    else if (target.href) router.push(target.href);
  };
}
