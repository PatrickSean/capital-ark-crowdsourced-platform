import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { jsonError, jsonOk, parseBody } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.email("Enter a valid email address."),
});

/**
 * POST /api/account/claim
 *
 * Converts an anonymous visitor into a permanent account by linking an email
 * identity to their existing user. Supabase keeps the same user id through
 * this, so every pledge they already made carries over with no migration and
 * no reconciliation step.
 *
 * Offered only after a pledge is recorded. It is never a precondition for
 * contributing.
 */
export async function POST(request: Request) {
  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  const user = await getSessionUser();
  if (!user) {
    return jsonError(
      401,
      "identity_required",
      "Your session expired. Please try again.",
    );
  }

  if (!user.isAnonymous) {
    return jsonOk({ status: "already_claimed" as const, email: user.email });
  }

  if (!isSupabaseConfigured) {
    return jsonError(
      503,
      "account_linking_unavailable",
      "Account linking is not enabled on this deployment.",
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return jsonError(
      500,
      "auth_unavailable",
      "Account linking isn't available right now.",
    );
  }

  // updateUser() attaches an email identity to the current anonymous user.
  // Supabase sends a confirmation link; the account isn't permanent until the
  // user clicks it, so we don't flip isAnonymous locally yet.
  const { error: linkError } = await supabase.auth.updateUser({
    email: body.email,
  });

  if (linkError) {
    return jsonError(
      400,
      "link_failed",
      linkError.message ||
        "We couldn't link that email. It may already belong to another account.",
    );
  }

  await store.ensureUser(user.id, { email: body.email });

  return jsonOk({ status: "verification_sent" as const, email: body.email });
}
