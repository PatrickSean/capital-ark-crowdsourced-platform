const GOOGLE_FORMS_ORIGIN = "https://docs.google.com";
const RESPONDER_PATH = /^\/forms\/d\/e\/([A-Za-z0-9_-]+)\/viewform$/;
const MAX_URL_LENGTH = 2_048;

export const GOOGLE_FORMS_RESPONDER_URL_HELP =
  "Paste the full Google Forms responder URL ending in /viewform.";

export type GoogleFormsResponderUrlResult =
  | { ok: true; normalizedUrl: string | null }
  | { ok: false; error: string };

/**
 * Accepts only a Google Forms responder URL on the exact company-owned form
 * endpoint. Builder fields stay in the browser; this helper performs no I/O.
 * Existing query parameters and fragments are deliberately discarded so the
 * generated iframe receives only Google's `embedded=true` switch.
 */
export function normalizeGoogleFormsResponderUrl(
  rawValue: string,
): GoogleFormsResponderUrlResult {
  const value = rawValue.trim();
  if (!value) return { ok: true, normalizedUrl: null };
  if (value.length > MAX_URL_LENGTH) {
    return { ok: false, error: GOOGLE_FORMS_RESPONDER_URL_HELP };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: GOOGLE_FORMS_RESPONDER_URL_HELP };
  }

  if (
    url.origin !== GOOGLE_FORMS_ORIGIN ||
    url.username ||
    url.password
  ) {
    return { ok: false, error: GOOGLE_FORMS_RESPONDER_URL_HELP };
  }

  const match = RESPONDER_PATH.exec(url.pathname);
  const formId = match?.[1];
  if (!formId) {
    return { ok: false, error: GOOGLE_FORMS_RESPONDER_URL_HELP };
  }

  return {
    ok: true,
    normalizedUrl: `${GOOGLE_FORMS_ORIGIN}/forms/d/e/${formId}/viewform?embedded=true`,
  };
}
