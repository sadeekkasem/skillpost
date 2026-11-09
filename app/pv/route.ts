import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../../lib/supabase/env";

export const dynamic = "force-dynamic";

function empty() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  let path = "/";
  try {
    const body = (await request.json()) as { path?: unknown };
    if (typeof body.path === "string") path = body.path;
  } catch {
    // ignore malformed bodies
  }
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await client.rpc("islamic_record_page_view", { p_path: path });
  }
  return empty();
}

export function GET() {
  return empty();
}
