import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { attestationVersionFor } from "@/lib/compliance/attestations";
import { isReceiptObjectKeyFor } from "@/lib/receipt-key";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    pledgeId: z.string().min(1),
    /** True when the user tells us they didn't end up contributing. */
    declined: z.boolean().optional().default(false),
    confirmedAmountCents: z
      .number()
      .int()
      .positive()
      .max(100_000_00)
      .nullable()
      .optional(),
    ocrAmountCents: z
      .number()
      .int()
      .positive()
      .max(100_000_00)
      .nullable()
      .optional(),
    receiptUrl: z.string().max(500).nullable().optional(),
    attestationVersion: z.string().min(1).optional(),
    attested: z.boolean().optional().default(false),
  })
  .refine((v) => v.declined || v.attested, {
    message: "You must confirm the attestation before we can record a contribution.",
    path: ["attested"],
  });

/**
 * POST /api/pledges/confirm
 *
 * Self-attestation. This is the only way a pledge becomes "raised", because
 * the platform has no access to candidate backends and never will.
 *
 * A pledge with a receipt lands as COMPLETED; without one it lands as
 * UNVERIFIED and shows in the lighter bar segment. Both are honest, and the
 * UI never pretends otherwise.
 */
export async function POST(request: Request) {
  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "identity_required", "Your session expired. Please try again.");
  }

  const limit = rateLimit(
    `confirm:${user.id}`,
    LIMITS.confirmPledge.limit,
    LIMITS.confirmPledge.windowMs,
  );
  if (!limit.allowed) {
    return jsonError(429, "rate_limited", "Too many updates at once. Try again shortly.");
  }

  const context = await store.getPledgeConfirmationContext(body.pledgeId);
  if (!context) {
    return jsonError(404, "pledge_not_found", "We couldn't find that pledge.");
  }

  const { pledge: existing, candidate } = context;

  // Ownership check before anything else: a pledge id must never be usable by
  // anyone but the person who created it.
  if (existing.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That pledge belongs to someone else.");
  }

  // A network retry after a successful confirmation is a read, not another
  // write. Return the first result before re-validating transient inputs such
  // as a signed receipt upload.
  if (existing.status !== "PENDING") {
    if (!isCompatibleOutcome(existing.status, body.declined)) {
      return jsonError(
        409,
        "pledge_already_resolved",
        "That contribution was already resolved. Refresh to see its current status.",
      );
    }
    const progress = await store.getProgress(existing.targetId);
    return jsonOk({ pledge: existing, progress });
  }

  if (isExpiredPendingPledge(existing.createdAt)) {
    return jsonError(
      409,
      "pledge_expired",
      "That contribution intent expired. Please start again from the campaign page.",
    );
  }

  // The candidate attached to the pledge is authoritative. A client cannot
  // select the more permissive federal text for a North Carolina state race.
  const requiredAttestationVersion = attestationVersionFor(candidate);
  if (
    !body.declined &&
    body.attestationVersion !== requiredAttestationVersion
  ) {
    return jsonError(
      422,
      "wrong_attestation",
      "The contribution rules changed. Please refresh and confirm the current statement.",
    );
  }

  let receiptUrl: string | null = null;
  if (!body.declined && body.receiptUrl) {
    if (!isSupabaseConfigured) {
      return jsonError(
        422,
        "receipt_storage_unavailable",
        "Receipt uploads aren't enabled on this deployment. Please confirm without one.",
      );
    }

    if (!isReceiptObjectKeyFor(body.receiptUrl, user.id, existing.id)) {
      return jsonError(
        422,
        "invalid_receipt_key",
        "That receipt isn't attached to this contribution.",
      );
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return jsonError(
        503,
        "storage_unavailable",
        "Receipt storage isn't available right now. Please try again without the receipt.",
      );
    }

    try {
      const { data: receiptExists } = await supabase.storage
        .from("receipts")
        .exists(body.receiptUrl);
      if (!receiptExists) {
        return jsonError(
          422,
          "receipt_not_found",
          "The receipt upload didn't finish. Please try again or confirm without it.",
        );
      }
    } catch {
      return jsonError(
        503,
        "storage_unavailable",
        "We couldn't verify the receipt right now. Please try again or confirm without it.",
      );
    }

    receiptUrl = body.receiptUrl;
  }

  const updated = await store.confirmPledge({
    pledgeId: body.pledgeId,
    userId: user.id,
    confirmedAmountCents: body.confirmedAmountCents ?? null,
    ocrAmountCents: body.ocrAmountCents ?? null,
    receiptUrl,
    attestationVersion: requiredAttestationVersion,
    declined: body.declined,
  });

  if (!updated) {
    return jsonError(409, "confirm_failed", "We couldn't record that. Please try again.");
  }

  // Another tab may have won the conditional update with the opposite action
  // after our initial read. Never report that conflicting outcome as success.
  if (!isCompatibleOutcome(updated.status, body.declined)) {
    return jsonError(
      409,
      "pledge_already_resolved",
      "That contribution was already resolved. Refresh to see its current status.",
    );
  }

  // Recompute so the client can animate the bar to a true value rather than
  // trusting its own optimistic guess.
  const progress = await store.getProgress(updated.targetId);

  void hashIp(clientIp(request));

  return jsonOk({ pledge: updated, progress });
}

function isCompatibleOutcome(status: string, declined: boolean): boolean {
  if (declined) return status === "DECLINED";
  return status === "COMPLETED" || status === "UNVERIFIED";
}
