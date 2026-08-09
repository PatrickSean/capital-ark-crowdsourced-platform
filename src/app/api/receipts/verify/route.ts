import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, hashIp, jsonError, jsonOk } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { store } from "@/lib/data";
import { isNormalizedDonationUrlForPlatform } from "@/lib/coalition-creation";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";
import {
  MAX_RECEIPT_REQUEST_BYTES,
  ReceiptImageValidationError,
  evaluateReceipt,
  extractReceiptWithOpenAI,
  validateReceiptImage,
  type ReceiptReason,
} from "@/lib/receipts/receipt-review";
import { ReceiptCheckStatus } from "@/generated/prisma/enums";
import {
  createReceiptEvidenceToken,
  hashReceiptEvidence,
  receiptSafetyIdentifier,
} from "@/lib/receipts/receipt-evidence-token";
import {
  receiptEvidenceSecret,
  receiptReviewRuntimeConfig,
} from "@/lib/receipts/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AmountSchema = z.coerce.number().int().positive().max(100_000_00);
const NO_STORE = { "cache-control": "no-store" };
const DISCLAIMER =
  "AI checking is an automated consistency check, not conclusive proof that a contribution was made or accepted by the committee.";

class ReceiptRequestTooLargeError extends Error {}

/**
 * POST /api/receipts/verify
 *
 * Receives one explicitly-consented screenshot, validates it, sends it to the
 * Responses API, then discards the bytes. No filename, raw image, model text,
 * donor PII, or receipt identifier is logged or written to application storage.
 */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return jsonError(
      415,
      "multipart_required",
      "Upload one PNG, JPEG, or WebP receipt screenshot.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RECEIPT_REQUEST_BYTES
  ) {
    return jsonError(
      413,
      "receipt_too_large",
      "That request is too large. Crop the screenshot to the receipt and try again.",
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "identity_required", "Your session expired. Please try again.");
  }

  const limit = rateLimit(
    `receipt-review:${user.id}`,
    LIMITS.receiptReview.limit,
    LIMITS.receiptReview.windowMs,
  );
  const ipLimit = rateLimit(
    `receipt-review:ip:${hashIp(clientIp(request)) ?? "unknown"}`,
    LIMITS.receiptReviewPerIp.limit,
    LIMITS.receiptReviewPerIp.windowMs,
  );
  if (!limit.allowed || !ipLimit.allowed) {
    const retryAfterSeconds = Math.max(
      limit.retryAfterSeconds,
      ipLimit.retryAfterSeconds,
    );
    return jsonError(
      429,
      "rate_limited",
      "Too many receipt checks at once. Try again shortly.",
      { retryAfterSeconds },
    );
  }

  let form: FormData;
  try {
    form = await readBoundedMultipartFormData(request);
  } catch (error) {
    if (error instanceof ReceiptRequestTooLargeError) {
      return jsonError(
        413,
        "receipt_too_large",
        "That request is too large. Crop the screenshot to the receipt and try again.",
      );
    }
    return jsonError(400, "invalid_form", "We couldn't read that upload.");
  }

  if (form.get("consent") !== "true") {
    return jsonError(
      422,
      "ai_consent_required",
      "Choose the AI analysis option before sending a receipt for review.",
    );
  }

  const pledgeId = form.get("pledgeId");
  const amount = AmountSchema.safeParse(form.get("confirmedAmountCents"));
  const receipt = form.get("receipt");
  if (typeof pledgeId !== "string" || pledgeId.length < 1 || pledgeId.length > 100) {
    return jsonError(422, "invalid_pledge", "Choose a contribution to confirm.");
  }
  if (!amount.success) {
    return jsonError(422, "invalid_amount", "Enter the amount shown on the receipt.");
  }
  if (!(receipt instanceof File)) {
    return jsonError(422, "receipt_required", "Choose one receipt screenshot.");
  }

  const context = await store.getPledgeConfirmationContext(pledgeId);
  if (!context) {
    return jsonError(404, "pledge_not_found", "We couldn't find that contribution.");
  }
  if (context.pledge.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That contribution belongs to someone else.");
  }
  if (context.pledge.status !== "PENDING") {
    return jsonError(409, "pledge_already_resolved", "That contribution was already resolved.");
  }
  if (isExpiredPendingPledge(context.pledge.createdAt)) {
    return jsonError(409, "pledge_expired", "That contribution intent expired. Please start again.");
  }

  const target = await store.getTargetById(context.pledge.targetId);
  if (
    !target ||
    !target.candidate.platform ||
    !isNormalizedDonationUrlForPlatform(
      target.candidate.donationUrl,
      target.candidate.platform,
    ) ||
    !target.candidate.donationUrlVerifiedAt
  ) {
    return jsonError(
      409,
      "receipt_context_unavailable",
      "This recipient does not have enough verified processor information for receipt checking.",
    );
  }

  let bytes: Uint8Array;
  let mimeType: "image/png" | "image/jpeg" | "image/webp";
  try {
    bytes = new Uint8Array(await receipt.arrayBuffer());
    mimeType = validateReceiptImage(receipt.type, bytes);
  } catch (error) {
    if (error instanceof ReceiptImageValidationError) {
      return jsonError(
        error.code === "receipt_too_large" ? 413 : 422,
        error.code,
        error.message,
      );
    }
    return jsonError(422, "invalid_receipt_image", "That receipt image could not be read.");
  }

  const config = receiptReviewRuntimeConfig();
  if (!config.apiKey) {
    await store.recordReceiptReview({
      pledgeId,
      userId: user.id,
      status: ReceiptCheckStatus.AI_UNAVAILABLE,
      checkedAt: new Date(),
      reasons: ["ai_not_configured"],
    });
    return unavailable(
      "ai_not_configured",
      "AI receipt checking isn't available right now. You can still self-report your contribution.",
    );
  }

  const secret = receiptEvidenceSecret();
  if (!secret) {
    await store.recordReceiptReview({
      pledgeId,
      userId: user.id,
      status: ReceiptCheckStatus.AI_UNAVAILABLE,
      checkedAt: new Date(),
      reasons: ["secure_token_unavailable"],
    });
    return unavailable(
      "secure_token_unavailable",
      "Receipt checking isn't available right now. You can still self-report your contribution.",
    );
  }

  const expected = {
    candidateName: target.candidate.fullName,
    committeeName: target.candidate.committeeName,
    processor: target.candidate.platform,
    amountCents: amount.data,
  };

  try {
    const extraction = await extractReceiptWithOpenAI({
      bytes,
      mimeType,
      apiKey: config.apiKey,
      model: config.model,
      safetyIdentifier: receiptSafetyIdentifier(user.id, secret),
      imageDetail: config.imageDetail,
      signal: AbortSignal.timeout(20_000),
    });
    const evaluation = evaluateReceipt(extraction, expected);
    if (!evaluation.accepted) {
      const recorded = await store.recordReceiptReview({
        pledgeId,
        userId: user.id,
        status: ReceiptCheckStatus.AI_NEEDS_REVIEW,
        model: config.model,
        checkedAt: new Date(),
        extractedAmountCents: extraction.amountCents,
        contributionDate: extraction.contributionDate
          ? new Date(`${extraction.contributionDate}T00:00:00.000Z`)
          : null,
        candidateMatched: evaluation.matches.candidate,
        committeeMatched: evaluation.matches.committee,
        amountMatched: evaluation.matches.amount,
        processorMatched: evaluation.matches.processor,
        datePlausible: evaluation.matches.datePlausible,
        reasons: evaluation.reasons.map((reason) => reason.code),
      });
      if (!recorded) return pledgeChanged();
      return resultResponse({
        status: "needs_review",
        receiptBacked: false,
        aiChecked: true,
        evidenceToken: null,
        reasons: evaluation.reasons,
      });
    }

    // These are guaranteed by accepted=true, but keep a type-safe fail-closed
    // boundary between the evaluator and evidence-token issuance.
    if (
      extraction.amountCents === null ||
      extraction.contributionDate === null ||
      evaluation.matches.amount !== true ||
      evaluation.matches.processor !== true ||
      evaluation.matches.datePlausible !== true ||
      (evaluation.matches.candidate !== true &&
        evaluation.matches.committee !== true)
    ) {
      return unavailable(
        "incomplete_review",
        "The receipt check was incomplete. You can still self-report your contribution.",
      );
    }

    const evidenceToken = createReceiptEvidenceToken(
      {
        userId: user.id,
        pledgeId,
        targetId: target.id,
        amountCents: amount.data,
        evidenceHash: hashReceiptEvidence(bytes, secret),
        model: config.model,
        extractedAmountCents: extraction.amountCents,
        contributionDate: extraction.contributionDate,
        candidateMatched: evaluation.matches.candidate === true,
        committeeMatched: evaluation.matches.committee,
        amountMatched: true,
        processorMatched: true,
        datePlausible: true,
      },
      secret,
    );

    const recorded = await store.recordReceiptReview({
      pledgeId,
      userId: user.id,
      status: ReceiptCheckStatus.AI_CHECKED_MATCH,
      model: config.model,
      checkedAt: new Date(),
      extractedAmountCents: extraction.amountCents,
      contributionDate: new Date(
        `${extraction.contributionDate}T00:00:00.000Z`,
      ),
      candidateMatched: evaluation.matches.candidate,
      committeeMatched: evaluation.matches.committee,
      amountMatched: true,
      processorMatched: true,
      datePlausible: true,
      reasons: [],
    });
    if (!recorded) return pledgeChanged();

    return resultResponse({
      status: "ai_checked",
      receiptBacked: true,
      aiChecked: true,
      evidenceToken,
      reasons: [],
    });
  } catch {
    await store.recordReceiptReview({
      pledgeId,
      userId: user.id,
      status: ReceiptCheckStatus.AI_UNAVAILABLE,
      model: config.model,
      checkedAt: new Date(),
      reasons: ["ai_temporarily_unavailable"],
    });
    return unavailable(
      "ai_temporarily_unavailable",
      "We couldn't check the receipt right now. You can still self-report your contribution.",
    );
  } finally {
    // Drop our reference as soon as the request finishes; raw receipt bytes are
    // never persisted by this route.
    bytes = new Uint8Array(0);
  }
}

function pledgeChanged() {
  return jsonError(
    409,
    "pledge_already_resolved",
    "That contribution changed while the receipt was being checked. Refresh to see its status.",
  );
}

function resultResponse(args: {
  status: "ai_checked" | "needs_review";
  receiptBacked: boolean;
  aiChecked: boolean;
  evidenceToken: string | null;
  reasons: ReceiptReason[];
}) {
  return jsonOk(
    {
      ...args,
      canSelfReport: true,
      disclaimer: DISCLAIMER,
    },
    { headers: NO_STORE },
  );
}

function unavailable(code: string, message: string) {
  return jsonOk(
    {
      status: "unavailable" as const,
      receiptBacked: false,
      aiChecked: false,
      canSelfReport: true,
      evidenceToken: null,
      reasons: [{ code, message }],
      disclaimer: DISCLAIMER,
    },
    { headers: NO_STORE },
  );
}

/**
 * Buffers multipart input only up to the documented request ceiling before
 * handing it to the platform parser. `Content-Length` is merely an early hint;
 * this streaming count also covers chunked and deliberately forged requests.
 */
async function readBoundedMultipartFormData(
  request: Request,
): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  const reader = request.body?.getReader();
  if (!contentType || !reader) throw new Error("Missing multipart body.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RECEIPT_REQUEST_BYTES) {
        await reader.cancel();
        throw new ReceiptRequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
    ),
    totalBytes,
  );
  return new Request("http://localhost/receipt-upload", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  }).formData();
}
