"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = { loading: boolean; userId: string | null; isAdmin: boolean; isModerator: boolean };

/** Reads the signed-in member's admin/moderator flags. If the moderators migration has not run
 *  (no is_moderator column), falls back to is_admin only so nothing breaks. */
export async function loadRole(db: SupabaseClient): Promise<Omit<Role, "loading">> {
  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) return { userId: null, isAdmin: false, isModerator: false };
  const full = await db.from("profiles").select("is_admin,is_moderator").eq("id", userId).maybeSingle();
  if (!full.error) {
    const row = full.data as { is_admin?: boolean; is_moderator?: boolean } | null;
    return { userId, isAdmin: row?.is_admin === true, isModerator: row?.is_moderator === true };
  }
  const basic = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return { userId, isAdmin: (basic.data as { is_admin?: boolean } | null)?.is_admin === true, isModerator: false };
}

export function useRole(db: SupabaseClient | null): Role {
  const [role, setRole] = useState<Role>({ loading: true, userId: null, isAdmin: false, isModerator: false });
  useEffect(() => {
    let cancelled = false;
    if (!db) {
      setRole({ loading: false, userId: null, isAdmin: false, isModerator: false });
      return;
    }
    loadRole(db)
      .then((r) => !cancelled && setRole({ loading: false, ...r }))
      .catch(() => !cancelled && setRole({ loading: false, userId: null, isAdmin: false, isModerator: false }));
    return () => {
      cancelled = true;
    };
  }, [db]);
  return role;
}

/** True when the error means the moderators migration has not been applied yet. */
export function isMissingFeature(message: string) {
  return /does not exist|schema cache|could not find|function/i.test(message);
}
