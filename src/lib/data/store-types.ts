import type { Jurisdiction, Party, Platform } from "@/generated/prisma/enums";
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
}

export interface ConfirmPledgeInput {
  pledgeId: string;
  userId: string;
  confirmedAmountCents?: number | null;
  ocrAmountCents?: number | null;
  receiptUrl?: string | null;
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

export interface CreateCoalitionInput {
  createdById: string;
  coalitionName: string;
  description?: string | null;
  trackingPrefix: string;
  flatTrackingTag: boolean;
  candidateName: string;
  party: Party;
  office: string;
  state?: string | null;
  jurisdiction: Jurisdiction;
  donationUrl: string;
  platform: Platform;
  committeeName?: string | null;
  targetTitle: string;
  goalCents: number;
  deadline?: Date | null;
  suggestedAmounts: number[];
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

  createPledge(input: CreatePledgeInput): Promise<PledgeView>;
  getPledge(pledgeId: string): Promise<PledgeView | null>;
  getPledgeConfirmationContext(
    pledgeId: string,
  ): Promise<PledgeConfirmationContext | null>;
  confirmPledge(input: ConfirmPledgeInput): Promise<PledgeView | null>;
  listResumablePledges(userId: string): Promise<ResumablePledge[]>;

  logClickEvent(input: LogClickInput): Promise<void>;

  createCoalitionWithTarget(
    input: CreateCoalitionInput,
  ): Promise<{ coalitionSlug: string; targetSlug: string }>;
}
