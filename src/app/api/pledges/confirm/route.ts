import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { ATTESTATIONS, CURRENT_ATTESTATION_VERSION } from "@/lib/compliance/attestations";

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
    ocrAmountCents: z.number().int().positive().nullable().optional(),
    receiptUrl: z.string().max(500).nullable().optional(),
    attestationVersion: z.string().default(CURRENT_ATTESTATION_VERSION),
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

  if (!body.declined && !ATTESTATIONS[body.attestationVersion]) {
    return jsonError(
      422,
      "unknown_attestation",
      "That attestation version isn't recognized. Please refresh and try again.",
    );
  }

  const existing = await store.getPledge(body.pledgeId);
  if (!existing) {
    return jsonError(404, "pledge_not_found", "We couldn't find that pledge.");
  }

  // Ownership check before anything else: a pledge id must never be usable by
  // anyone but the person who created it.
  if (existing.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That pledge belongs to someone else.");
  }

  const updated = await store.confirmPledge({
    pledgeId: body.pledgeId,
    userId: user.id,
    confirmedAmountCents: body.confirmedAmountCents ?? null,
    ocrAmountCents: body.ocrAmountCents ?? null,
    receiptUrl: body.receiptUrl ?? null,
    attestationVersion: body.attestationVersion,
    declined: body.declined,
  });

  if (!updated) {
    return jsonError(409, "confirm_failed", "We couldn't record that. Please try again.");
  }

  // Recompute so the client can animate the bar to a true value rather than
  // trusting its own optimistic guess.
  const progress = await store.getProgress(updated.targetId);

  void hashIp(clientIp(request));

  return jsonOk({ pledge: updated, progress });
}
