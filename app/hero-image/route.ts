import { NextResponse } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "../../lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fallback = new URL("/images/hero-madinah.webp", request.url);
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    return NextResponse.redirect(fallback);
  }
  const upstream = await fetch(`${url}/storage/v1/object/public/islamic-site/hero.webp`, {
    headers: { apikey: key },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.redirect(fallback);
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
