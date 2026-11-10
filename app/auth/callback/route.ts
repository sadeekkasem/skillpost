import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "../../../lib/supabase/env";

const allowedExact = new Set(["/login", "/admin", "/sheikh", "/student"]);
const allowedPrefixes = ["/admin/", "/sheikh/", "/student/"];

function safeInternalPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return null;
  }
  const path = raw.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (allowedExact.has(path) || allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return path;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeInternalPath(requestUrl.searchParams.get("next"));
  if (!url || !key || !code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const redirectTo = new URL("/login", request.url);
  const response = NextResponse.redirect(redirectTo);
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return response;

  await supabase.rpc("islamic_accept_pending_invitations");
  const { data } = await supabase.rpc("islamic_staff_workspace");
  const role = data && typeof data === "object" && "role" in data ? data.role : null;
  if (role === "admin") response.headers.set("location", new URL("/admin", request.url).toString());
  else if (role === "sheikh") response.headers.set("location", new URL("/sheikh", request.url).toString());
  else if (role === "student") response.headers.set("location", new URL("/student", request.url).toString());
  else if (next) response.headers.set("location", new URL(next, request.url).toString());
  return response;
}
