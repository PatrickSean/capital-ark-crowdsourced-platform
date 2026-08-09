import { jsonError } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint retained only to fail old clients safely. Receipt images now
 * pass through /api/receipts/verify in request memory and are discarded after
 * review; Capital Ark no longer issues URLs that persist raw receipt files.
 */
export async function POST() {
  return jsonError(
    410,
    "receipt_upload_replaced",
    "Use the receipt verification step to upload and verify a contribution receipt.",
  );
}
