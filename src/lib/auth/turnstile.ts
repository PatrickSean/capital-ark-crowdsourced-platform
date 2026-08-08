import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token.
 *
 * Supabase recommends a captcha on anonymous sign-ins, since an endpoint that
 * mints identities with no credentials is otherwise trivially scriptable, and
 * every identity can move a public progress bar.
 *
 * When TURNSTILE_SECRET_KEY isn't set the check is skipped, so local
 * development and demo mode don't require a Cloudflare account.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };

  if (!token) return { ok: false, reason: "missing-captcha-token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    return data.success
      ? { ok: true }
      : { ok: false, reason: data["error-codes"]?.join(",") ?? "captcha-failed" };
  } catch {
    // A Cloudflare outage should not take contributions offline. Anonymous
    // pledges are still rate limited and land in the lower-trust bar segment.
    return { ok: true, reason: "captcha-unavailable" };
  }
}
