import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { attestationVersionFor } from "@/lib/compliance/attestations";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";
import {
  ContributionEvidenceType,
  ReceiptCheckStatus,
} from "@/generated/prisma/enums";
import {
  ReceiptEvidenceReuseError,
  ReceiptVerificationRequiredError,
} from "@/lib/data/errors";
import type { ReceiptEvidenceInput } from "@/lib/data/store-types";
import { verifyReceiptEvidenceToken } from "@/lib/receipts/receipt-evidence-token";
import { receiptEvidenceSecret } from "@/lib/receipts/config";

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
    receiptEvidenceToken: z.string().min(1).max(4096).nullable().optional(),
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
 * A contribution becomes public progress only after the server authenticates
 * a short-lived receipt-evidence token issued by /api/receipts/verify for this
 * exact user, pledge, target, candidate, and amount. Raw receipt bytes are not
 * accepted or persisted here.
 */
export async function POST(request: Request) {
  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  if (!body.declined && !body.receiptEvidenceToken) {
    return jsonError(
      422,
      "receipt_verification_required",
      "Upload a receipt and complete its verification before adding this contribution.",
    );
  }

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
  const requestedEvidenceType: ContributionEvidenceType | null = body.declined
    ? null
    : ContributionEvidenceType.RECEIPT_AI_CHECKED;

  // Ownership check before anything else: a pledge id must never be usable by
  // anyone but the person who created it.
  if (existing.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That pledge belongs to someone else.");
  }

  // A network retry after a successful confirmation is a read, not another
  // write. Return the first receipt-backed result before re-validating an
  // evidence token that may have expired since the original success.
  if (existing.status !== "PENDING") {
    if (!isCompatibleOutcome(existing.status, body.declined)) {
      return jsonError(
        409,
        "pledge_already_resolved",
        "That contribution was already resolved. Refresh to see its current status.",
      );
    }
    if (
      !body.declined &&
      existing.evidenceType !== requestedEvidenceType
    ) {
      return jsonError(
        409,
        "pledge_already_resolved",
        "That contribution was already recorded with a different evidence status. Refresh to see the saved result.",
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

  const confirmedAmountCents =
    body.confirmedAmountCents ?? existing.amountCents;
  let receiptEvidence: ReceiptEvidenceInput | null = null;

  if (!body.declined && body.receiptEvidenceToken) {
    const secret = receiptEvidenceSecret();
    const claims = secret
      ? verifyReceiptEvidenceToken(
          body.receiptEvidenceToken,
          {
            userId: user.id,
            pledgeId: existing.id,
            targetId: existing.targetId,
            candidateId: candidate.id,
            amountCents: confirmedAmountCents,
          },
          secret,
        )
      : null;
    if (!claims) {
      return jsonError(
        422,
        "invalid_receipt_evidence",
        "That receipt check expired or doesn't match this contribution. Upload the receipt again to retry verification.",
      );
    }

    receiptEvidence = {
      pledgeId: existing.id,
      userId: user.id,
      targetId: existing.targetId,
      candidateId: candidate.id,
      amountCents: confirmedAmountCents,
      status: ReceiptCheckStatus.AI_CHECKED_MATCH,
      model: claims.model,
      checkedAt: new Date(claims.checkedAt),
      extractedAmountCents: claims.extractedAmountCents,
      contributionDate: new Date(
        `${claims.contributionDate}T00:00:00.000Z`,
      ),
      candidateMatched: claims.candidateMatched,
      committeeMatched: claims.committeeMatched,
      amountMatched: true,
      processorMatched: true,
      datePlausible: true,
      reasons: [],
      evidenceHash: claims.evidenceHash,
    };
  }

  let updated;
  try {
    updated = await store.confirmPledge({
      pledgeId: body.pledgeId,
      userId: user.id,
      confirmedAmountCents: body.confirmedAmountCents ?? null,
      receiptEvidence,
      attestationVersion: requiredAttestationVersion,
      declined: body.declined,
    });
  } catch (cause) {
    if (cause instanceof ReceiptEvidenceReuseError) {
      return jsonError(
        409,
        "receipt_already_used",
        "That receipt was already used for another contribution. Upload a different receipt.",
      );
    }
    if (cause instanceof ReceiptVerificationRequiredError) {
      return jsonError(
        422,
        "receipt_verification_required",
        "Upload a receipt and complete its verification before adding this contribution.",
      );
    }
    return jsonError(500, "confirm_failed", "We couldn't record that. Please try again.");
  }

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
  if (!body.declined && updated.evidenceType !== requestedEvidenceType) {
    return jsonError(
      409,
      "pledge_already_resolved",
      "Another confirmation was saved first. Refresh to see its evidence status.",
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
  return status === "COMPLETED";
}
