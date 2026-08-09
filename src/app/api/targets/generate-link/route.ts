import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/data";
import { getOrCreateSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { clientIp, hashIp, jsonError, jsonOk, parseBody } from "@/lib/api/http";
import { LIMITS, rateLimit } from "@/lib/api/rate-limit";
import { buildContributionLink, buildTrackingTag } from "@/lib/tracking/link-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  targetId: z.string().min(1),
  amountCents: z.number().int().positive().max(100_000_00).nullable().optional(),
  /** Opt-in prefill. Off by default; we don't push PII at the processor
      unless the contributor asked us to save them the typing. */
  includePrefill: z.boolean().optional().default(false),
});

/**
 * POST /api/targets/generate-link
 *
 * The heart of the zero-custody model. Creates a PENDING pledge, builds the
 * outbound URL with this coalition's tracking code, logs the click, and hands
 * back a URL for the browser to navigate a already-opened tab to.
 *
 * Deliberately requires no coalition membership and accepts anonymous
 * identities: someone arriving from a link in a group chat must be able to
 * contribute without an account.
 */
export async function POST(request: Request) {
  const { data: body, error } = await parseBody(request, BodySchema);
  if (error) return error;

  const user = await getOrCreateSessionUser();
  if (!user) {
    // Only reachable in Supabase mode when the browser hasn't completed its
    // anonymous sign-in yet. The client retries after ensureIdentity().
    return jsonError(
      401,
      "identity_required",
      "We couldn't start a session. Please try again.",
      { supabaseConfigured: isSupabaseConfigured },
    );
  }

  const ip = clientIp(request);
  const ipHash = hashIp(ip);

  const perUser = rateLimit(
    `genlink:user:${user.id}`,
    LIMITS.generateLink.limit,
    LIMITS.generateLink.windowMs,
  );
  const perIp = rateLimit(
    `genlink:ip:${ipHash ?? "unknown"}`,
    LIMITS.generateLinkPerIp.limit,
    LIMITS.generateLinkPerIp.windowMs,
  );

  if (!perUser.allowed || !perIp.allowed) {
    const retry = Math.max(perUser.retryAfterSeconds, perIp.retryAfterSeconds);
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "That's a lot of contributions at once. Try again shortly.",
        },
      },
      { status: 429, headers: { "retry-after": String(retry) } },
    );
  }

  const target = await store.getTargetById(body.targetId);
  if (!target) {
    return jsonError(404, "target_not_found", "That fundraising drive no longer exists.");
  }

  if (target.status !== "ACTIVE") {
    return jsonError(409, "target_closed", "This drive has closed and is no longer accepting contributions.");
  }

  if (target.coalition.requireSignIn && user.isAnonymous) {
    return jsonError(
      403,
      "sign_in_required",
      `${target.coalition.name} asks contributors to sign in before pledging.`,
    );
  }

  const { donationUrl, platform } = target.candidate;
  if (!donationUrl || !platform) {
    return jsonError(
      409,
      "donation_link_missing",
      `${target.candidate.fullName}'s committee hasn't published a donation link here yet, so there's nowhere for us to send you.`,
    );
  }

  const amountCents = body.amountCents ?? null;

  const trackingTag = buildTrackingTag({
    prefix: target.coalition.trackingPrefix,
    targetId: target.id,
    userId: user.id,
    flat: target.coalition.flatTrackingTag,
  });

  let built;
  try {
    built = buildContributionLink({
      donationUrl,
      platform,
      trackingTag,
      amountCents,
      suggestedAmounts: target.suggestedAmounts,
      prefill: body.includePrefill
        ? { email: user.email, firstName: firstNameOf(user.displayName) }
        : null,
    });
  } catch (err) {
    // A malformed donation URL is an organizer data problem, not the
    // contributor's fault, so say so plainly rather than showing a 500.
    return jsonError(
      422,
      "invalid_donation_url",
      "This drive's donation link is misconfigured. The organizer has been notified.",
      { detail: err instanceof Error ? err.message : undefined },
    );
  }

  const pledge = await store.createPledge({
    userId: user.id,
    targetId: target.id,
    amountCents: amountCents ?? 0,
    trackingTag: built.trackingTag,
    isAnonymous: user.isAnonymous,
    ipHash,
  });

  await store.logClickEvent({
    targetId: target.id,
    platform,
    trackingTag: built.trackingTag,
    amountCents,
  });

  return jsonOk({
    outboundUrl: built.url,
    pledgeId: pledge.id,
    platform: built.platform,
    trackingTag: built.trackingTag,
    committeeName: target.candidate.committeeName,
    amountCents,
    strippedParams: built.strippedParams,
  });
}

function firstNameOf(displayName: string | null): string | null {
  if (!displayName) return null;
  return displayName.trim().split(/\s+/)[0] ?? null;
}
