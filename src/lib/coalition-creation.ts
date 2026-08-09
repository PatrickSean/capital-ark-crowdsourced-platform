import { z } from "zod";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import {
  detectPlatform,
  FORBIDDEN_PARAMS,
} from "@/lib/tracking/link-builder";

const MAX_TARGETS = 20;
// Prisma `Int` maps to a signed PostgreSQL int4. Reject out-of-range values at
// the API boundary instead of allowing an otherwise-valid request to 500.
const MAX_GOAL_CENTS = 2_147_483_647;
const MAX_SUGGESTED_AMOUNT_CENTS = 10_000_000;
const ORGANIZER_INPUT_PARAMS: ReadonlySet<string> = new Set([
  "amount",
  "amounts",
  "email",
  "firstname",
  "lastname",
  "first_name",
  "last_name",
  "employer",
  "employer_name",
  "occupation",
  "city",
  "state",
  "zip",
  "sc",
  "refcode",
  "source_code",
]);

function optionalText(maxLength: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maxLength).nullable().optional(),
  );
}

/**
 * Normalize an organizer-supplied processor URL before it is persisted.
 *
 * The public API deliberately accepts only the three supported payment
 * processors, only over HTTPS, and removes parameters that can trigger an
 * immediate or recurring charge. Platform verification is a separate review
 * status; accepting a processor host does not make a link Capital Ark-verified.
 */
export function normalizeDonationUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid donation-page URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Donation-page URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Donation-page URLs cannot include credentials.");
  }
  if (url.port) {
    throw new Error("Donation-page URLs cannot use a custom port.");
  }
  if (!detectPlatform(url.toString())) {
    throw new Error(
      "Use an official WinRed, ActBlue, or Anedot donation-page URL.",
    );
  }

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (
      FORBIDDEN_PARAMS.has(normalizedKey) ||
      ORGANIZER_INPUT_PARAMS.has(normalizedKey)
    ) {
      url.searchParams.delete(key);
    }
  }
  // Canonical ordering makes duplicate-link detection independent of the
  // organizer's query parameter order while preserving unknown form params.
  url.searchParams.sort();

  return url.toString();
}

const donationUrlSchema = z
  .string()
  .trim()
  .min(4)
  .max(500)
  .transform((value, context) => {
    try {
      return normalizeDonationUrl(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Enter a valid donation-page URL.",
      });
      return z.NEVER;
    }
  });

const targetSchema = z.object({
  candidateName: z.string().trim().min(2).max(80),
  office: z.string().trim().min(2).max(80),
  party: z.enum(Party),
  state: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter state abbreviation.")
    .transform((value) => value.toUpperCase()),
  jurisdiction: z.enum(Jurisdiction),
  donationUrl: donationUrlSchema,
  committeeName: optionalText(120),
  goalCents: z.number().int().positive().max(MAX_GOAL_CENTS),
  deadline: z.string().datetime().optional().nullable(),
  suggestedAmounts: z
    .array(
      z.number().int().positive().max(MAX_SUGGESTED_AMOUNT_CENTS),
    )
    .min(1)
    .max(6)
    .refine((values) => new Set(values).size === values.length, {
      message: "Suggested amounts must be unique.",
    }),
});

const coalitionFields = {
  coalitionName: z.string().trim().min(2).max(80),
  description: optionalText(500),
  trackingPrefix: optionalText(24),
  /** Send the bare prefix as the source code, with nothing appended. */
  flatTrackingTag: z.boolean().optional().default(false),
  /**
   * The organizer reviewed every identity and official link and understands
   * that a community drive is not platform-verified.
   */
  organizerAttested: z.literal(true),
} as const;

const multiTargetSchema = z.object({
  ...coalitionFields,
  targets: z.array(targetSchema).min(1).max(MAX_TARGETS),
});

/**
 * One-release compatibility adapter for clients that still submit a single
 * target at the top level. It intentionally still requires the attestation.
 */
const legacySingleTargetSchema = z
  .object({
    ...coalitionFields,
    candidateName: targetSchema.shape.candidateName,
    office: targetSchema.shape.office,
    party: targetSchema.shape.party,
    state: targetSchema.shape.state,
    jurisdiction: targetSchema.shape.jurisdiction,
    donationUrl: targetSchema.shape.donationUrl,
    committeeName: targetSchema.shape.committeeName,
    goalCents: targetSchema.shape.goalCents,
    deadline: targetSchema.shape.deadline,
    suggestedAmounts: targetSchema.shape.suggestedAmounts,
  })
  .transform(
    ({
      candidateName,
      office,
      party,
      state,
      jurisdiction,
      donationUrl,
      committeeName,
      goalCents,
      deadline,
      suggestedAmounts,
      ...coalition
    }) => ({
      ...coalition,
      targets: [
        {
          candidateName,
          office,
          party,
          state,
          jurisdiction,
          donationUrl,
          committeeName,
          goalCents,
          deadline,
          suggestedAmounts,
        },
      ],
    }),
  );

export const createCoalitionRequestSchema = z
  .union([multiTargetSchema, legacySingleTargetSchema])
  .superRefine((body, context) => {
    const seenIdentities = new Set<string>();
    const seenDonationUrls = new Set<string>();
    body.targets.forEach((target, index) => {
      const identity = [
        target.candidateName,
        target.office,
        target.state,
        target.jurisdiction,
      ]
        .map((part) => part.trim().toLocaleLowerCase("en-US"))
        .join("|");

      if (seenIdentities.has(identity)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index],
          message: "This candidate and office are already in the drive.",
        });
      }
      seenIdentities.add(identity);

      if (seenDonationUrls.has(target.donationUrl)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "donationUrl"],
          message: "This donation page is already used by another target.",
        });
      }
      seenDonationUrls.add(target.donationUrl);
    });
  });

export type CreateCoalitionRequest = z.infer<
  typeof createCoalitionRequestSchema
>;
