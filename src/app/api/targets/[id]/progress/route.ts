import { store } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/targets/:id/progress
 *
 * Public and unauthenticated: a shared link has to render a live progress bar
 * before the visitor has any session. Returns only aggregates, never pledge
 * rows, so nothing identifying leaves the database.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const target = await store.getTargetById(id);
  if (!target) {
    return jsonError(404, "target_not_found", "That fundraising drive no longer exists.");
  }

  const progress = await store.getProgress(id);

  return jsonOk(
    {
      targetId: id,
      ...progress,
    },
    {
      headers: {
        // Brief shared cache so a link going around a group chat doesn't
        // hammer the database, while still feeling live.
        "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
      },
    },
  );
}
