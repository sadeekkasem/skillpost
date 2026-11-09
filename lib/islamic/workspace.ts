import { fixturesEnabled } from "../supabase/env";
import { createSupabaseServerClient } from "../supabase/server";
import { TEST_WORKSPACE } from "./fixtures";
import type { StaffRole, Workspace } from "./types";

export async function loadWorkspace(): Promise<Workspace> {
  if (fixturesEnabled()) return TEST_WORKSPACE;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { role: null, lessons: [], invitations: [] };
  const { data, error } = await supabase.rpc("islamic_staff_workspace");
  if (error || !data) return { role: null, lessons: [], invitations: [] };
  const payload = data as Record<string, unknown>;
  const role = (payload.role as StaffRole | null) ?? null;
  return {
    role,
    sheikhs: (payload.sheikhs as Workspace["sheikhs"]) ?? undefined,
    sheikh: (payload.sheikh as Workspace["sheikh"]) ?? null,
    lessons: (payload.lessons as Workspace["lessons"]) ?? [],
    invitations: (payload.invitations as Workspace["invitations"]) ?? [],
  };
}
