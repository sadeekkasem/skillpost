import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../../lib/supabase/env";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const buckets = new Map<string, { windowStart: number; count: number }>();

function empty() {
  return new Response(null, { status: 204 });
}

function clientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function allowIp(ip: string): boolean {
  const now = Date.now();
  if (buckets.size > 4000) {
    for (const [key, value] of buckets) {
      if (now - value.windowStart >= WINDOW_MS) buckets.delete(key);
    }
  }
  const current = buckets.get(ip);
  if (!current || now - current.windowStart >= WINDOW_MS) {
    buckets.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  if (!allowIp(clientIp(request))) return empty();

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
