export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}

export function supabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function authConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function fixturesEnabled(): boolean {
  return process.env.ISLAMIC_DEV_FIXTURES === "1" && process.env.VERCEL_ENV !== "production";
}

export function inviteMailEnabled(): boolean {
  return process.env.ISLAMIC_SEND_INVITES === "true";
}

export function authMailEnabled(): boolean {
  return process.env.ISLAMIC_AUTH_ENABLED === "true";
}
