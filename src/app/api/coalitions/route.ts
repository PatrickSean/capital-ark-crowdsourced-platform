import { store } from "@/lib/data";
import { CoalitionVerificationStatus } from "@/generated/prisma/enums";
import { getOrCreateSessionUser } from "@/lib/auth/session";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import {
  derivePrefix,
  detectPlatform,
  sanitizeTrackingTag,
} from "@/lib/tracking/link-builder";
import { isDriveCreationEnabled } from "@/lib/auth/config";
import { createCoalitionRequestSchema } from "@/lib/coalition-creation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coalitions
 *
 * The organizer wizard's single submit. Creates all candidates, the coalition,
 * membership and targets in one transaction so a half-built drive can never
 * exist. Public submissions remain visibly community-created until reviewed.
 */
export async function POST(request: Request) {
  if (!isDriveCreationEnabled) {
    return jsonError(
      403,
      "drive_creation_paused",
      "New drive creation is temporarily paused.",
    );
  }

  const { data: body, error } = await parseBody(
    request,
    createCoalitionRequestSchema,
  );
  if (error) return error;

  const user = await getOrCreateSessionUser();
  if (!user) {
    return jsonError(
      401,
      "identity_required",
      "Please sign in to create a drive.",
    );
  }

  const limit = rateLimit(
    `coalition:${hashIp(clientIp(request)) ?? user.id}`,
    LIMITS.createCoalition.limit,
    LIMITS.createCoalition.windowMs,
  );
  if (!limit.allowed) {
    return jsonError(
      429,
      "rate_limited",
      "You've created several drives just now. Try again in a bit.",
    );
  }

  // The request schema has already normalized each URL and restricted it to a
  // supported HTTPS processor host. Derive the enum server-side so a client
  // can never claim a mismatched processor.
  const normalizedTargets = body.targets.map((target) => ({
    ...target,
    platform: detectPlatform(target.donationUrl),
  }));
  if (normalizedTargets.some((target) => target.platform === null)) {
    return jsonError(
      422,
      "unsupported_processor",
      "Every link must be a WinRed, ActBlue, or Anedot donation page.",
    );
  }

  const trackingPrefix = body.trackingPrefix
    ? sanitizeTrackingTag(body.trackingPrefix)
    : derivePrefix(body.coalitionName);
  const effectiveTrackingPrefix = trackingPrefix || "COALITION";

  const created = await store.createCoalitionWithTargets({
    createdById: user.id,
    coalitionName: body.coalitionName,
    description: body.description ?? null,
    trackingPrefix: effectiveTrackingPrefix,
    flatTrackingTag: body.flatTrackingTag,
    targets: normalizedTargets.map((target) => {
      // Guarded above; keeping the assertion here makes the store contract
      // accurately non-null without trusting a client-supplied platform.
      if (!target.platform) {
        throw new Error("Validated donation URL has no processor.");
      }
      return {
        candidateName: target.candidateName,
        party: target.party,
        office: target.office,
        state: target.state,
        jurisdiction: target.jurisdiction,
        donationUrl: target.donationUrl,
        platform: target.platform,
        committeeName: target.committeeName ?? null,
        targetTitle:
          `Raise ${formatGoal(target.goalCents)} for ` + target.candidateName,
        goalCents: target.goalCents,
        deadline: target.deadline ? new Date(target.deadline) : null,
        suggestedAmounts: target.suggestedAmounts,
      };
    }),
  });

  return jsonOk({
    ...created,
    trackingPrefix: effectiveTrackingPrefix,
    verificationStatus: CoalitionVerificationStatus.COMMUNITY_UNVERIFIED,
  });
}

function formatGoal(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
