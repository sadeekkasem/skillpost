import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../../lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    return Response.json({}, { headers: { "Cache-Control": "public, max-age=30" } });
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.from("published_site_content").select("key,value");
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row && typeof row.key === "string" && typeof row.value === "string") {
      out[row.key] = row.value;
    }
  }
  return Response.json(out, { headers: { "Cache-Control": "public, max-age=60" } });
}
