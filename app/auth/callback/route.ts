import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "../../../lib/supabase/env";
import { safeInternalPath } from "../../../lib/auth/paths";

export async function GET(request: NextRequest) {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type");
  const next = safeInternalPath(requestUrl.searchParams.get("next"));
  const loginWith = (reason: string) => {
    const u = new URL("/login", request.url);
    u.searchParams.set("e", reason);
    if (next) u.searchParams.set("next", next);
    return u;
  };
  if (!url || !key) return NextResponse.redirect(loginWith("config"));
  if (!code && !tokenHash) return NextResponse.redirect(loginWith(requestUrl.searchParams.get("error") ? "expired" : "missing"));

  const redirectTo = loginWith("norole");
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

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (otpType === "magiclink" || otpType === "signup" || otpType === "invite" || otpType === "recovery" || otpType === "email_change") ? otpType : "email" })
    : await supabase.auth.exchangeCodeForSession(code as string);
  if (error) {
    // PKCE links only work in the same browser that requested them; otherwise the verifier cookie is missing.
    const reason = /code verifier|code_verifier|both auth code and code verifier/i.test(error.message) ? "browser" : "expired";
    return NextResponse.redirect(loginWith(reason));
  }

  await supabase.rpc("islamic_accept_pending_invitations");
  const { data } = await supabase.rpc("islamic_staff_workspace");
  const role = data && typeof data === "object" && "role" in data ? data.role : null;
  if (next) response.headers.set("location", new URL(next, request.url).toString());
  else if (role === "admin") response.headers.set("location", new URL("/admin", request.url).toString());
  else if (role === "sheikh") response.headers.set("location", new URL("/sheikh", request.url).toString());
  else if (role === "student") response.headers.set("location", new URL("/student", request.url).toString());
  return response;
}
