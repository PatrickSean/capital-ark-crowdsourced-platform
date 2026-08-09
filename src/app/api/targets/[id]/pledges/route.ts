import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { store } from "@/lib/data";
import { IdempotencyConflictError } from "@/lib/data/errors";
import { isNormalizedDonationUrlForPlatform } from "@/lib/coalition-creation";
import { buildTrackingTag } from "@/lib/tracking/link-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const AlreadyContributedBodySchema = z.object({
  amountCents: z.number().int().positive().max(100_000_00),
});

const IdempotencyKeySchema = z.string().uuid();

/**
 * POST /api/targets/[id]/pledges
 *
 * Starts confirmation for a contribution made before arriving at Capital Ark.
 * It deliberately creates no outbound URL and no LinkClickEvent. A required
 * idempotency key makes a retry return the same PENDING pledge.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { data: body, error } = await parseBody(
    request,
    AlreadyContributedBodySchema,
  );
  if (error) return error;

  const idempotencyKey = IdempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success) {
    return jsonError(
      422,
      "idempotency_key_required",
      "Please retry with a valid request identifier.",
    );
  }

  const user = await getOrCreateSessionUser();
  if (!user) {
    return jsonError(
      401,
      "identity_required",
      "We couldn't start a session. Please try again.",
      { supabaseConfigured: isSupabaseConfigured },
    );
  }

  const ipHash = hashIp(clientIp(request));
  const perUser = rateLimit(
    `direct-pledge:user:${user.id}`,
    LIMITS.directPledge.limit,
    LIMITS.directPledge.windowMs,
  );
  const perIp = rateLimit(
    `direct-pledge:ip:${ipHash ?? "unknown"}`,
    LIMITS.directPledgePerIp.limit,
    LIMITS.directPledgePerIp.windowMs,
  );
  if (!perUser.allowed || !perIp.allowed) {
    const retry = Math.max(perUser.retryAfterSeconds, perIp.retryAfterSeconds);
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "That's a lot of contribution reports at once. Try again shortly.",
        },
      },
      { status: 429, headers: { "retry-after": String(retry) } },
    );
  }

  const { id: targetId } = await context.params;
  const target = await store.getTargetById(targetId);
  if (!target) {
    return jsonError(404, "target_not_found", "That fundraising drive no longer exists.");
  }
  if (target.status !== "ACTIVE") {
    return jsonError(409, "target_closed", "This drive has closed.");
  }
  if (
    !isNormalizedDonationUrlForPlatform(
      target.candidate.donationUrl,
      target.candidate.platform,
    )
  ) {
    return jsonError(
      409,
      "recipient_unavailable",
      "This recipient does not have a supported official contribution page.",
    );
  }
  if (target.coalition.requireSignIn && user.isAnonymous) {
    return jsonError(
      403,
      "sign_in_required",
      `${target.coalition.name} asks contributors to sign in before reporting a contribution.`,
    );
  }

  const trackingTag = buildTrackingTag({
    prefix: target.coalition.trackingPrefix,
    targetId: target.id,
    userId: user.id,
    flat: target.coalition.flatTrackingTag,
  });

  try {
    const pledge = await store.createPledge({
      userId: user.id,
      targetId: target.id,
      amountCents: body.amountCents,
      trackingTag,
      isAnonymous: user.isAnonymous,
      ipHash,
      clientRequestId: idempotencyKey.data,
    });
    return jsonOk({ pledge }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    if (cause instanceof IdempotencyConflictError) {
      return jsonError(
        409,
        "idempotency_conflict",
        "That request identifier was already used for a different contribution.",
      );
    }
    return jsonError(500, "pledge_create_failed", "We couldn't start confirmation. Please try again.");
  }
}
