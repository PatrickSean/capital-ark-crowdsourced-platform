import type {
  ContributionEvidenceType,
  Jurisdiction,
  Party,
  Platform,
  ReceiptCheckStatus,
} from "@/generated/prisma/enums";
import type {
  ActivityItem,
  CandidateView,
  CoalitionView,
  PledgeView,
  ProgressSnapshot,
  ResumablePledge,
  TargetView,
} from "@/lib/domain/types";

export interface PledgeConfirmationContext {
  pledge: PledgeView;
  candidate: Pick<CandidateView, "jurisdiction" | "state">;
}

export interface CreatePledgeInput {
  userId: string;
  targetId: string;
  amountCents: number;
  trackingTag: string;
  isAnonymous: boolean;
  ipHash?: string | null;
  userAgent?: string | null;
  clientRequestId?: string | null;
}

export interface ReceiptReviewInput {
  pledgeId: string;
  userId: string;
  status: ReceiptCheckStatus;
  model?: string | null;
  checkedAt: Date;
  extractedAmountCents?: number | null;
  contributionDate?: Date | null;
  candidateMatched?: boolean | null;
  committeeMatched?: boolean | null;
  amountMatched?: boolean | null;
  processorMatched?: boolean | null;
  datePlausible?: boolean | null;
  reasons: string[];
}

export interface ReceiptEvidenceInput extends ReceiptReviewInput {
  evidenceHash: string;
}

export interface ConfirmPledgeInput {
  pledgeId: string;
  userId: string;
  confirmedAmountCents?: number | null;
  ocrAmountCents?: number | null;
  receiptUrl?: string | null;
  evidenceType?: ContributionEvidenceType | null;
  receiptEvidence?: ReceiptEvidenceInput | null;
  attestationVersion: string;
  declined?: boolean;
}

export interface LogClickInput {
  pledgeId: string;
  targetId: string;
  userId: string | null;
  platform: Platform;
  trackingTag: string;
  generatedUrl: string;
  amountCents: number | null;
  referrer?: string | null;
  ipHash?: string | null;
}

export interface CreateCoalitionTargetInput {
  candidateName: string;
  party: Party;
  office: string;
  state: string;
  jurisdiction: Jurisdiction;
  donationUrl: string;
  platform: Platform;
  committeeName?: string | null;
  targetTitle: string;
  goalCents: number;
  deadline?: Date | null;
  suggestedAmounts: number[];
}

export interface CreateCoalitionInput {
  createdById: string;
  coalitionName: string;
  description?: string | null;
  trackingPrefix: string;
  flatTrackingTag: boolean;
  targets: CreateCoalitionTargetInput[];
}

export interface CreatedCoalitionTarget {
  candidateName: string;
  targetSlug: string;
  platform: Platform;
}

export interface CreatedCoalition {
  coalitionSlug: string;
  firstTargetSlug: string;
  targets: CreatedCoalitionTarget[];
}

export interface UserPatch {
  email?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  employer?: string | null;
  occupation?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/**
 * The single data interface the whole app talks to. Two implementations back
 * it: Prisma when DATABASE_URL is set, and an in-memory demo store otherwise.
 */
export interface Store {
  readonly isDemo: boolean;

  ensureUser(userId: string, patch?: UserPatch): Promise<void>;

  getCoalitionBySlug(slug: string): Promise<CoalitionView | null>;
  listCoalitions(): Promise<CoalitionView[]>;
  listTargetsForCoalition(coalitionId: string): Promise<TargetView[]>;
  getTargetBySlug(slug: string): Promise<TargetView | null>;
  getTargetById(targetId: string): Promise<TargetView | null>;
  getProgress(targetId: string): Promise<ProgressSnapshot>;
  listActivity(coalitionId: string, limit?: number): Promise<ActivityItem[]>;
  listActivityForTarget(
    targetId: string,
    limit?: number,
  ): Promise<ActivityItem[]>;

  createPledge(input: CreatePledgeInput): Promise<PledgeView>;
  getPledge(pledgeId: string): Promise<PledgeView | null>;
  getPledgeConfirmationContext(
    pledgeId: string,
  ): Promise<PledgeConfirmationContext | null>;
  recordReceiptReview(input: ReceiptReviewInput): Promise<boolean>;
  confirmPledge(input: ConfirmPledgeInput): Promise<PledgeView | null>;
  listResumablePledges(userId: string): Promise<ResumablePledge[]>;

  logClickEvent(input: LogClickInput): Promise<void>;

  createCoalitionWithTargets(
    input: CreateCoalitionInput,
  ): Promise<CreatedCoalition>;
}
