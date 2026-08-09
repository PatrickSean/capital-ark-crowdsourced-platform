import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import {
  buildReceiptObjectKey,
  RECEIPT_CONTENT_TYPES,
} from "@/lib/receipt-key";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pledgeId: z.string().min(1),
  contentType: z.enum(RECEIPT_CONTENT_TYPES, {
    error: "Receipts must be a PNG, JPEG, WebP, or HEIC image.",
  }),
});

const RECEIPTS_BUCKET = "receipts";

/**
 * POST /api/receipts/upload-url
 *
 * Issues a short-lived signed upload URL so receipt images go straight from
 * the browser to private storage. They never transit our server, which keeps
 * documents containing donor names and partial card numbers out of our logs
 * and off our disks entirely.
 *
 * The object key is prefixed with the user's id, which is what the storage
 * RLS policy keys off (see prisma/sql/rls.sql).
 */
export async function POST(request: Request) {
  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "identity_required", "Your session expired. Please try again.");
  }

  const limit = rateLimit(
    `receipt:${user.id}`,
    LIMITS.receiptUpload.limit,
    LIMITS.receiptUpload.windowMs,
  );
  if (!limit.allowed) {
    return jsonError(
      429,
      "rate_limited",
      "Too many receipt uploads at once. Try again shortly.",
    );
  }

  const pledge = await store.getPledge(body.pledgeId);
  if (!pledge || pledge.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That pledge belongs to someone else.");
  }

  if (pledge.status !== "PENDING") {
    return jsonError(
      409,
      "pledge_already_resolved",
      "That contribution has already been confirmed.",
    );
  }

  if (isExpiredPendingPledge(pledge.createdAt)) {
    return jsonError(
      409,
      "pledge_expired",
      "That contribution intent expired. Please start again from the campaign page.",
    );
  }

  if (!isSupabaseConfigured) {
    // A receipt key must never imply an object exists when this deployment has
    // no private storage. The contributor can still confirm as self-reported.
    return jsonError(
      503,
      "receipt_storage_unavailable",
      "Receipt uploads aren't enabled on this deployment. You can still confirm without one.",
    );
  }

  const objectKey = buildReceiptObjectKey({
    userId: user.id,
    pledgeId: body.pledgeId,
    contentType: body.contentType,
  });

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return jsonError(500, "storage_unavailable", "Receipt storage isn't available right now.");
  }

  const { data, error: signError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUploadUrl(objectKey);

  if (signError || !data) {
    return jsonError(500, "storage_unavailable", "We couldn't prepare the upload. You can still confirm without a receipt.");
  }

  return jsonOk({
    mode: "supabase" as const,
    objectKey,
    uploadUrl: data.signedUrl,
    token: data.token,
  });
}
