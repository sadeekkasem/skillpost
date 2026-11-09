import { fixturesEnabled } from "../supabase/env";
import { createSupabaseServerClient } from "../supabase/server";
import { TEST_ADMIN_EXTRAS } from "./fixtures";
import type { AccountRecord, AdminExtras, AuditRecord, SiteContentRecord } from "./types";
import { loadVisitorStats } from "./visitor-stats";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadAdminExtras(): Promise<AdminExtras> {
  if (fixturesEnabled()) return TEST_ADMIN_EXTRAS;
  const empty: AdminExtras = {
    audit: [],
    accounts: [],
    siteContent: [],
    stats: await loadVisitorStats(),
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;
  const [audit, accounts, content, stats] = await Promise.all([
    supabase.rpc("islamic_admin_list_audit", { p_limit: 80 }),
    supabase.rpc("islamic_admin_list_accounts"),
    supabase.rpc("islamic_admin_list_site_content"),
    loadVisitorStats(),
  ]);
  return {
    audit: asArray<AuditRecord>(audit.data),
    accounts: asArray<AccountRecord>(accounts.data),
    siteContent: asArray<SiteContentRecord>(content.data),
    stats,
  };
}
