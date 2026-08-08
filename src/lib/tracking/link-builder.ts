/**
 * The URL parameter engine.
 *
 * Capital Ark never processes a payment. The entire mechanism by which a
 * contribution is attributed to a coalition is this file: we take the
 * candidate's own official donation URL, append a tracking code plus optional
 * prefill, and send the user there. Nothing is proxied, re-hosted, or framed.
 *
 * Parameter names below are taken from each processor's published docs:
 *   WinRed   https://support.winred.com/en/articles/3790570-use-url-parameters
 *   ActBlue  https://help.actblue.com/hc/en-us/articles/16870060622359
 *   Anedot   https://help.anedot.com/knowledge/url-parameter
 */
import { Platform } from "@/generated/prisma/enums";
import { centsToUrlAmount } from "@/lib/money";

/**
 * Parameters that cause an immediate charge with no confirmation screen.
 *
 * WinRed's `oc=true` ("one click") and ActBlue's `express_lane=true` both bill
 * a stored payment method the instant the link is opened. ActBlue's own
 * documentation warns that misusing express lane means charging people for
 * donations they never agreed to.
 *
 * A platform that generates links on behalf of third parties must never be
 * able to emit these, so they are stripped unconditionally -- including from
 * the candidate's stored donation URL, which is organizer-supplied input and
 * therefore untrusted. `recurring` is included because silently enrolling
 * someone into a monthly commitment is the same class of surprise.
 */
export const FORBIDDEN_PARAMS: ReadonlySet<string> = new Set([
  "oc",
  "express_lane",
  "recurring",
  "recurring_frequency",
  "amtx",
]);

/** Processors truncate long source codes; keep tags comfortably under. */
export const MAX_TAG_LENGTH = 40;

export interface DonorPrefill {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  employer?: string | null;
  occupation?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface BuildLinkOptions {
  donationUrl: string;
  platform: Platform;
  trackingTag: string;
  amountCents?: number | null;
  /** Rendered as the processor's preset amount buttons where supported. */
  suggestedAmounts?: number[] | null;
  prefill?: DonorPrefill | null;
}

export interface BuiltLink {
  url: string;
  platform: Platform;
  trackingTag: string;
  /** Forbidden params found on the organizer-supplied URL and removed. */
  strippedParams: string[];
}

/**
 * Normalizes a tracking tag into something every processor accepts.
 *
 * Source codes flow into third-party reporting tools and CSV exports, so the
 * output is restricted to uppercase alphanumerics, hyphen and underscore.
 */
export function sanitizeTrackingTag(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return cleaned.slice(0, MAX_TAG_LENGTH).replace(/[-_]+$/g, "");
}

/**
 * Derives a coalition's tracking prefix from its display name, so organizers
 * never have to know what a source code is.
 */
export function derivePrefix(coalitionName: string): string {
  const words = coalitionName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "COALITION";

  // Multi-word names become an acronym, which keeps room in the 40-char tag
  // budget for the target and user segments. Short tokens are kept whole so
  // initialisms survive: "NC Small Business Coalition" -> "NCSBC", not "NSBC".
  if (words.length > 1) {
    const acronym = words.map((w) => (w.length <= 3 ? w : w[0])).join("");
    if (acronym.length >= 3) return acronym.slice(0, 12);
  }

  return words.join("").slice(0, 12);
}

/**
 * Builds the tag actually sent to the processor.
 *
 * Default shape is PREFIX-TARGET6-USER6. The two id fragments make the tag
 * unique per person per drive so a coalition can reconcile its own reporting,
 * while the prefix keeps every tag from one coalition greppable.
 *
 * `flat` collapses that to the bare prefix. The recipient committee is the
 * audience for this string, and a committee only ever sees its own
 * contributions, so the id fragments buy them nothing while making the code
 * harder to eyeball in a processor export. The cost is real though: with a flat
 * tag the processor's own report can no longer tell two of our contributors
 * apart, so per-donor reconciliation lives solely in our pledge rows.
 */
export function buildTrackingTag(args: {
  prefix: string;
  targetId: string;
  userId?: string | null;
  flat?: boolean;
}): string {
  const prefix = sanitizeTrackingTag(args.prefix);
  if (args.flat) return prefix;

  const short = (id: string) => id.replace(/-/g, "").slice(-6).toUpperCase();

  const parts = [prefix, short(args.targetId)];
  if (args.userId) parts.push(short(args.userId));

  return sanitizeTrackingTag(parts.join("-"));
}

/** Maps a donation URL's host to its processor. Powers the organizer wizard. */
export function detectPlatform(rawUrl: string): Platform | null {
  let host: string;
  try {
    host = new URL(normalizeUrl(rawUrl)).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host === "winred.com" || host.endsWith(".winred.com")) return Platform.WINRED;
  if (host === "actblue.com" || host.endsWith(".actblue.com")) return Platform.ACTBLUE;
  if (host === "anedot.com" || host.endsWith(".anedot.com")) return Platform.ANEDOT;

  return null;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.WINRED]: "WinRed",
  [Platform.ACTBLUE]: "ActBlue",
  [Platform.ANEDOT]: "Anedot",
};

/**
 * Display name for a processor, for the copy that names it in a sentence.
 * Falls back to a generic phrase for targets that have no link yet, so those
 * screens read normally instead of showing "undefined".
 */
export function platformLabel(platform: Platform | null | undefined): string {
  return platform ? PLATFORM_LABELS[platform] : "the campaign's donation page";
}

/** Tolerates organizers pasting "secure.winred.com/x" without a scheme. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type ParamMap = Record<string, string | undefined>;

/**
 * Per-processor parameter mapping. Each adapter returns the params to set;
 * the shared builder handles sanitization, stripping and serialization, so an
 * adapter can never accidentally bypass the forbidden-parameter rule.
 */
const ADAPTERS: Record<
  Platform,
  (opts: BuildLinkOptions) => ParamMap
> = {
  [Platform.WINRED]: (opts) => ({
    sc: opts.trackingTag,
    amount: amountParam(opts.amountCents),
    email: opts.prefill?.email ?? undefined,
    employer_name: opts.prefill?.employer ?? undefined,
    occupation: opts.prefill?.occupation ?? undefined,
    zip: opts.prefill?.zip ?? undefined,
  }),

  [Platform.ACTBLUE]: (opts) => ({
    refcode: opts.trackingTag,
    amount: amountParam(opts.amountCents),
    firstname: opts.prefill?.firstName ?? undefined,
    lastname: opts.prefill?.lastName ?? undefined,
    email: opts.prefill?.email ?? undefined,
  }),

  [Platform.ANEDOT]: (opts) => ({
    source_code: opts.trackingTag,
    amount: amountParam(opts.amountCents),
    amounts: opts.suggestedAmounts?.length
      ? opts.suggestedAmounts.map((c) => centsToUrlAmount(c)).join(",")
      : undefined,
    first_name: opts.prefill?.firstName ?? undefined,
    last_name: opts.prefill?.lastName ?? undefined,
    email: opts.prefill?.email ?? undefined,
    employer: opts.prefill?.employer ?? undefined,
    occupation: opts.prefill?.occupation ?? undefined,
    city: opts.prefill?.city ?? undefined,
    state: opts.prefill?.state ?? undefined,
    zip: opts.prefill?.zip ?? undefined,
  }),
};

function amountParam(cents?: number | null): string | undefined {
  if (cents == null || cents <= 0) return undefined;
  return centsToUrlAmount(cents);
}

/**
 * Appends tracking and prefill to a candidate's own donation URL.
 *
 * Throws on a URL that isn't parseable or isn't https, since the only thing
 * worse than an untracked contribution is sending a donor somewhere unsafe.
 */
export function buildContributionLink(opts: BuildLinkOptions): BuiltLink {
  const url = new URL(normalizeUrl(opts.donationUrl));

  if (url.protocol !== "https:") {
    throw new Error(
      `Donation URLs must be https. Received: ${url.protocol}//${url.host}`,
    );
  }

  // Strip forbidden params already present on the stored URL. Organizers paste
  // these from campaign emails, which routinely contain one-click codes.
  const strippedParams: string[] = [];
  for (const key of [...url.searchParams.keys()]) {
    if (FORBIDDEN_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
      strippedParams.push(key);
    }
  }

  const tag = sanitizeTrackingTag(opts.trackingTag);
  const params = ADAPTERS[opts.platform]({ ...opts, trackingTag: tag });

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    if (FORBIDDEN_PARAMS.has(key.toLowerCase())) continue;
    url.searchParams.set(key, value);
  }

  return {
    url: url.toString(),
    platform: opts.platform,
    trackingTag: tag,
    strippedParams,
  };
}
