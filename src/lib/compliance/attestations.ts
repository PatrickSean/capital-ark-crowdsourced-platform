/**
 * Versioned attestation text.
 *
 * The pledge row stores which version a user agreed to, so we can always show
 * exactly what someone consented to on a given date rather than whatever the
 * current wording happens to be. Never edit a published version in place: add
 * a new one and move CURRENT_ATTESTATION_VERSION.
 */
export interface AttestationDefinition {
  version: string;
  effective: string;
  /** Shown next to the checkbox the user must tick before confirming. */
  checkboxLabel: string;
  /** The full clauses, expanded under a disclosure in the modal. */
  clauses: string[];
}

export const ATTESTATIONS: Record<string, AttestationDefinition> = {
  "2026-01-v1": {
    version: "2026-01-v1",
    effective: "2026-01-01",
    checkboxLabel:
      "I confirm I made this contribution myself, with my own funds.",
    clauses: [
      "This contribution is made from my own funds, not those of another person or entity.",
      "I am a United States citizen or a lawfully admitted permanent resident.",
      "This contribution is not made from the general treasury funds of a corporation, labor organization, or national bank.",
      "I am not a federal contractor.",
      "I am at least 18 years old.",
      "I am reporting this contribution to Capital Ark voluntarily, and I understand Capital Ark did not process it.",
    ],
  },

  // North Carolina is materially stricter than the FEC on the source of funds.
  // G.S. 163-278.19 bars contributions from any "business entity" -- not just
  // corporations, so an LLC, partnership or sole proprietorship's account is
  // out too -- and makes aiding such a contribution a Class 2 misdemeanor.
  // G.S. 163-278.13C separately bars registered lobbyists from giving to
  // legislators and Council of State members at all.
  "2026-01-nc-v1": {
    version: "2026-01-nc-v1",
    effective: "2026-01-01",
    checkboxLabel:
      "I confirm I gave my own personal money, not business funds.",
    clauses: [
      "This contribution is made from my own personal funds, on a personal card or account, not those of another person or entity.",
      "This contribution is not made from the funds of a corporation, business entity, LLC, partnership, labor union, professional association, or insurance company. North Carolina prohibits contributions from all of these.",
      "I am not being reimbursed by anyone for this contribution.",
      "I am not a lobbyist registered in North Carolina.",
      "I am a United States citizen or a lawfully admitted permanent resident.",
      "I am at least 18 years old.",
      "I am reporting this contribution to Capital Ark voluntarily, and I understand Capital Ark did not process it.",
    ],
  },
};

export const CURRENT_ATTESTATION_VERSION = "2026-01-v1";

/** Which attestation applies to a race, keyed by jurisdiction and state. */
export function attestationVersionFor(args: {
  jurisdiction: "FEDERAL" | "STATE";
  state?: string | null;
}): string {
  if (args.jurisdiction === "STATE" && args.state?.toUpperCase() === "NC") {
    return "2026-01-nc-v1";
  }
  return CURRENT_ATTESTATION_VERSION;
}

export function getAttestation(
  version: string = CURRENT_ATTESTATION_VERSION,
): AttestationDefinition {
  return ATTESTATIONS[version] ?? ATTESTATIONS[CURRENT_ATTESTATION_VERSION];
}

export interface ContributionLimit {
  /** Per-election cap on an individual's contribution, in cents. */
  perElectionCents: number;
  label: string;
  authority: string;
  sourceUrl: string;
}

/**
 * Per-election individual limits for the current cycle.
 *
 * Displayed so an organizer can see whether a goal is even reachable from the
 * number of people they have. These are indexed for inflation and must be
 * rechecked each odd-numbered year.
 */
export const CONTRIBUTION_LIMITS: Record<string, ContributionLimit> = {
  FEDERAL: {
    perElectionCents: 350_000,
    label: "$3,500 per election",
    authority: "FEC, 2025-2026 cycle",
    sourceUrl:
      "https://www.fec.gov/help-candidates-and-committees/candidate-taking-receipts/contribution-limits/",
  },
  NC: {
    perElectionCents: 680_000,
    label: "$6,800 per election",
    authority: "NCSBE, effective Jan 1 2025",
    sourceUrl: "https://www.ncsbe.gov/campaign-finance/candidate-committees",
  },
};

export function contributionLimitFor(args: {
  jurisdiction: "FEDERAL" | "STATE";
  state?: string | null;
}): ContributionLimit | null {
  if (args.jurisdiction === "FEDERAL") return CONTRIBUTION_LIMITS.FEDERAL;
  const key = args.state?.toUpperCase();
  return key ? (CONTRIBUTION_LIMITS[key] ?? null) : null;
}

/**
 * The standing platform disclaimer.
 *
 * Rendered in the footer sitewide and again inside the contribute modal, on
 * the principle that a disclaimer nobody sees at the point of action isn't
 * doing any work.
 */
export const PLATFORM_DISCLAIMER = {
  short:
    "Capital Ark is non-partisan software. We do not process, hold, or forward contributions, and we do not endorse any candidate.",
  full: [
    "Capital Ark is a non-partisan software vendor. We are not a political action committee, a political committee, or a fundraising agent for any candidate, campaign, or committee.",
    "We never process, hold, escrow, or forward contributions. Every contribution is made directly to the recipient committee on that committee's own official payment processor. Capital Ark never receives your payment information.",
    "Progress shown on this site is crowdsourced from what contributors tell us. It is not sourced from any candidate's records and should not be treated as an official fundraising total.",
    "Listing a candidate is not an endorsement. Candidates and committees do not pay to be listed and have no control over the goals groups set here.",
    "Contribution limits and reporting obligations are set by federal and state law and are enforced by the recipient committee's processor, not by Capital Ark.",
  ],
} as const;

/** Shown immediately above the outbound button, where it's unmissable. */
export const HANDOFF_NOTICE =
  "You're about to leave Capital Ark. Your contribution is made directly to the committee on their official processor, and we never see your payment details.";
