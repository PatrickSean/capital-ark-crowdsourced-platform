import { z } from "zod";
import { store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { jsonError, jsonOk, parseBody } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pledgeId: z.string().min(1),
  contentType: z
    .string()
    .refine((v) => ["image/png", "image/jpeg", "image/webp", "image/heic"].includes(v), {
      message: "Receipts must be a PNG, JPEG, WebP, or HEIC image.",
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

  const pledge = await store.getPledge(body.pledgeId);
  if (!pledge || pledge.userId !== user.id) {
    return jsonError(403, "not_your_pledge", "That pledge belongs to someone else.");
  }

  const extension = body.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const objectKey = `${user.id}/${body.pledgeId}-${Date.now()}.${extension}`;

  if (!isSupabaseConfigured) {
    // Demo mode has no storage backend. Receipts are accepted and OCR'd
    // entirely in the browser, and we record only that one was attached.
    return jsonOk({
      mode: "demo" as const,
      objectKey,
      uploadUrl: null,
      token: null,
    });
  }

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
