/**
 * Auth configuration flags, safe to import from both server and client.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * `local` is the deliberate first-launch mode on DigitalOcean: opaque,
 * HTTP-only visitor identities are persisted in Postgres, while account
 * claiming and receipt storage stay hidden. `supabase` enables those features.
 * Leaving this unset preserves the zero-config local demo experience.
 */
export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "auto";
export const isLocalAuthConfigured = AUTH_MODE === "local";
export const isSupabaseConfigured =
  AUTH_MODE !== "local" && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function authConfigurationError(): string | null {
  if (!new Set(["auto", "local", "supabase"]).has(AUTH_MODE)) {
    return "NEXT_PUBLIC_AUTH_MODE must be local or supabase.";
  }
  if (AUTH_MODE === "supabase" && !isSupabaseConfigured) {
    return "Supabase auth mode requires both public Supabase keys.";
  }
  if (AUTH_MODE === "local" && (SUPABASE_URL || SUPABASE_ANON_KEY)) {
    return "Local auth mode must not be mixed with Supabase public keys.";
  }
  return null;
}

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Public drive creation is deliberately opt-in in production.
 *
 * This remains an operational and abuse-response kill switch. When enabled,
 * stable visitors may publish shareable community drives after explicitly
 * attesting to candidate identity and official links. Those drives remain
 * unverified unless a trusted server-side review promotes them.
 */
export const isDriveCreationEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DRIVE_CREATION === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DRIVE_CREATION !== "false");

/**
 * Cookie holding the demo-mode identity.
 *
 * Demo mode still needs a stable per-visitor id so pledges, the resume banner
 * and "your pledges" all behave exactly as they will in production. The value
 * is an opaque UUID with a server-side HMAC. It carries no claims, but signing
 * prevents a caller from choosing another user's stable id once local-mode
 * identities own persistent drives and pledges.
 */
export const DEMO_UID_COOKIE = "ca_demo_uid";
