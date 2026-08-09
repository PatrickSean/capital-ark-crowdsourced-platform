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
  CoalitionVerificationStatus,
  ContributionEvidenceType,
  Jurisdiction,
  MemberRole,
  Party,
  Platform,
  PledgeStatus,
  ReceiptCheckStatus,
  TargetStatus,
} from "@/generated/prisma/enums";

import type {
  ActivityType,
  CoalitionVerificationStatus,
  ContributionEvidenceType,
  Jurisdiction,
  Party,
  Platform,
  PledgeStatus,
  ReceiptCheckStatus,
} from "@/generated/prisma/enums";

export interface CandidateView {
  id: string;
  slug: string;
  fullName: string;
  legalName: string | null;
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
  officialProfileUrl: string | null;
  officialDataVerifiedAt: string | null;
  donationUrlVerifiedAt: string | null;
  jurisdiction: Jurisdiction;
  committeeName: string | null;
  ncsbeCommitteeId: string | null;
  fecCandidateId: string | null;
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
  verificationStatus: CoalitionVerificationStatus;
  reviewedAt: string | null;
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
  /** Receipt-backed, not confirmation from committee records. */
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
  evidenceType: ContributionEvidenceType | null;
  amountCents: number | null;
  message: string | null;
  createdAt: string;
  targetTitle: string | null;
  targetSlug: string | null;
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
  evidenceType: ContributionEvidenceType | null;
  receiptCheckStatus: ReceiptCheckStatus;
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
