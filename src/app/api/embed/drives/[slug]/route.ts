import { jsonError, jsonOk } from "@/lib/api/http";
import { store } from "@/lib/data";
import { getPublicEmbedDriveSnapshot } from "@/lib/embed-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, read-only data for Capital Ark's first-party drive embed.
 *
 * This route intentionally does not read cookies, sessions, referrers, or
 * client network data. It returns only the explicit public DTO assembled by
 * getPublicEmbedDriveSnapshot.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const snapshot = await getPublicEmbedDriveSnapshot(store, slug);

  if (!snapshot) {
    return jsonError(
      404,
      "drive_not_found",
      "That public fundraising drive no longer exists.",
    );
  }

  return jsonOk(snapshot, {
    headers: {
      // Polling clients can ask every 15 seconds while shared caches absorb
      // bursts from popular partner sites and briefly serve stale data during
      // refreshes.
      "cache-control":
        "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
    },
  });
}
