import { z } from "zod";
import { store } from "@/lib/data";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import { getOrCreateSessionUser } from "@/lib/auth/session";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import {
  derivePrefix,
  detectPlatform,
  sanitizeTrackingTag,
} from "@/lib/tracking/link-builder";
import { isDriveCreationEnabled } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  coalitionName: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  trackingPrefix: z.string().trim().max(24).optional().nullable(),
  /** Send the bare prefix as the source code, with nothing appended. */
  flatTrackingTag: z.boolean().optional().default(false),

  candidateName: z.string().trim().min(2).max(80),
  office: z.string().trim().min(2).max(80),
  party: z.enum(Party),
  state: z.string().trim().length(2).optional().nullable(),
  jurisdiction: z.enum(Jurisdiction).default(Jurisdiction.FEDERAL),
  donationUrl: z.string().trim().min(4).max(500),
  committeeName: z.string().trim().max(120).optional().nullable(),

  goalCents: z.number().int().positive().max(100_000_000_00),
  deadline: z.string().datetime().optional().nullable(),
  suggestedAmounts: z.array(z.number().int().positive()).min(1).max(6),
});

/**
 * POST /api/coalitions
 *
 * The organizer wizard's single submit. Creates candidate, coalition,
 * membership and target in one transaction so a half-built drive can never
 * exist, and returns the shareable link the organizer actually came for.
 */
export async function POST(request: Request) {
  if (!isDriveCreationEnabled) {
    return jsonError(
      403,
      "drive_creation_review_required",
      "New drives are reviewed before publication during the curated launch.",
    );
  }

  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  const user = await getOrCreateSessionUser();
  if (!user) {
    return jsonError(
      401,
      "identity_required",
      "Please sign in to create a drive.",
    );
  }

  // A persistent database is not a demo sandbox. Anonymous visitors may
  // contribute to the audited public drive, but cannot publish new campaigns.
  if (user.isAnonymous && !store.isDemo) {
    return jsonError(
      403,
      "permanent_account_required",
      "A verified organizer account is required to create a drive.",
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

  // The processor is derived from the URL rather than asked for, which removes
  // a decision from the form and a whole category of mismatch bug.
  const platform = detectPlatform(body.donationUrl);
  if (!platform) {
    return jsonError(
      422,
      "unsupported_processor",
      "That link isn't a WinRed, ActBlue, or Anedot donation page. Capital Ark only supports official processors.",
    );
  }

  const trackingPrefix = body.trackingPrefix
    ? sanitizeTrackingTag(body.trackingPrefix)
    : derivePrefix(body.coalitionName);

  const { coalitionSlug, targetSlug } = await store.createCoalitionWithTarget({
    createdById: user.id,
    coalitionName: body.coalitionName,
    description: body.description ?? null,
    trackingPrefix: trackingPrefix || "COALITION",
    flatTrackingTag: body.flatTrackingTag,
    candidateName: body.candidateName,
    party: body.party,
    office: body.office,
    state: body.state ?? null,
    jurisdiction: body.jurisdiction,
    donationUrl: body.donationUrl,
    platform,
    committeeName: body.committeeName ?? null,
    targetTitle: `Raise ${formatGoal(body.goalCents)} for ${body.candidateName}`,
    goalCents: body.goalCents,
    deadline: body.deadline ? new Date(body.deadline) : null,
    suggestedAmounts: body.suggestedAmounts,
  });

  return jsonOk({ coalitionSlug, targetSlug, platform, trackingPrefix });
}

function formatGoal(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
