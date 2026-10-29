"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportTarget = "post" | "project" | "comment" | "post_comment" | "profile";

type Props = {
  db: SupabaseClient | null;
  viewerId: string;
  ownerId: string;
  targetType: ReportTarget;
  targetId: string;
  label?: string;
};

export default function ReportButton({ db, viewerId, ownerId, targetType, targetId, label = "إبلاغ" }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!db || !viewerId || viewerId === ownerId) return null;

  async function report() {
    if (!db || busy || done) return;
    const input = window.prompt("ما سبب الإبلاغ؟ (حتى 500 حرف)");
    if (input === null) return;
    const reason = input.trim().slice(0, 500);
    if (!reason) {
      window.alert("يرجى كتابة سبب الإبلاغ.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await db
        .from("reports")
        .insert({ reporter_id: viewerId, target_type: targetType, target_id: targetId, reason });
      if (error) {
        if (error.code === "23505") {
          setDone(true);
          window.alert("سبق أن أبلغت عن هذا المحتوى، وسيراجعه المشرفون.");
        } else {
          window.alert(error.message);
        }
        return;
      }
      setDone(true);
      window.alert("شكرًا لك، تم إرسال البلاغ وسيراجعه المشرفون.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="secondary" disabled={busy || done} onClick={() => void report()} title="إبلاغ عن محتوى مخالف">
      {done ? "تم الإبلاغ" : label}
    </button>
  );
}
