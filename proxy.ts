import { NextResponse, type NextRequest } from "next/server";
import { copyCookies, refreshAuthCookies } from "./lib/supabase/middleware";
import { fixturesEnabled } from "./lib/supabase/env";

const staffPrefixes = ["/admin", "/sheikh", "/student"];

function isStaffPath(pathname: string): boolean {
  return staffPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  if (fixturesEnabled()) {
    return NextResponse.next({ request });
  }

  const { response, userId } = await refreshAuthCookies(request);
  if (isStaffPath(request.nextUrl.pathname) && !userId) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return copyCookies(response, NextResponse.redirect(login));
  }
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/login/:path*",
    "/admin",
    "/admin/:path*",
    "/sheikh",
    "/sheikh/:path*",
    "/student",
    "/student/:path*",
    "/auth/:path*",
    "/hifz",
    "/hifz/:path*",
  ],
};
