/**
 * Shared view models.
 *
 * Everything the UI renders is defined here as plain serializable data, so the
 * same components work whether rows came from Prisma or from the in-memory
 * demo store. Enums are re-exported from the generated client (they compile to
 * plain constants with no runtime dependencies, so they are safe in client
 * bundles) to keep a single source of truth with the schema.
 */
export {
  ActivityType,
  Jurisdiction,
  MemberRole,
  Party,
  Platform,
  PledgeStatus,
  TargetStatus,
} from "@/generated/prisma/enums";

import type {
  ActivityType,
  Jurisdiction,
  Party,
  Platform,
  PledgeStatus,
} from "@/generated/prisma/enums";

export interface CandidateView {
  id: string;
  slug: string;
  fullName: string;
  party: Party;
  office: string;
  state: string | null;
  district: string | null;
  bio: string | null;
  photoUrl: string | null;
  /** Null when no official processor link has been supplied yet. */
  donationUrl: string | null;
  platform: Platform | null;
  /** Public campaign site, shown only as a lead for finding the real link. */
  websiteUrl: string | null;
  jurisdiction: Jurisdiction;
  committeeName: string | null;
  fecCommitteeId: string | null;
}

export interface CoalitionView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  trackingPrefix: string;
  flatTrackingTag: boolean;
  requireSignIn: boolean;
  memberCount: number;
}

/**
 * The three-way split that drives the layered progress bar. Keeping these
 * separate rather than collapsing to one "raised" number is deliberate: the
 * platform has no access to candidate backends, so it must be honest about
 * which dollars are receipt-backed and which are only self-reported.
 */
export interface ProgressSnapshot {
  goalCents: number;
  /** Receipt attached or admin-verified. */
  confirmedCents: number;
  /** Self-attested, no receipt. */
  attestedCents: number;
  /** Clicked out, outcome still unknown. */
  pendingCents: number;
  /** confirmed + attested. Pending is excluded; it hasn't happened yet. */
  raisedCents: number;
  percent: number;
  donorCount: number;
  daysRemaining: number | null;
}

export interface TargetView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goalCents: number;
  deadline: string | null;
  suggestedAmounts: number[];
  status: string;
  coalition: CoalitionView;
  candidate: CandidateView;
  progress: ProgressSnapshot;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorLabel: string | null;
  amountCents: number | null;
  message: string | null;
  createdAt: string;
  targetTitle: string | null;
  candidateName: string | null;
}

export interface PledgeView {
  id: string;
  targetId: string;
  userId: string;
  amountCents: number;
  confirmedAmountCents: number | null;
  status: PledgeStatus;
  trackingTagUsed: string;
  receiptUrl: string | null;
  createdAt: string;
}

/** A stale PENDING pledge, surfaced as the "finish confirming" banner. */
export interface ResumablePledge {
  pledgeId: string;
  amountCents: number;
  targetSlug: string;
  targetTitle: string;
  candidateName: string;
  createdAt: string;
}
