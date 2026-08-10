import {
  ActivityType,
  CoalitionVerificationStatus,
  ContributionEvidenceType,
  PledgeStatus,
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
import { computeProgress } from "./progress";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";
import * as fixtures from "./fixtures";
import * as ncHemp from "./campaigns/nc-hemp";
import type {
  ConfirmPledgeInput,
  CreateCoalitionInput,
  CreatePledgeInput,
  ReceiptReviewInput,
  Store,
} from "./store-types";
import {
  IdempotencyConflictError,
  ReceiptEvidenceReuseError,
  ReceiptVerificationRequiredError,
} from "./errors";
import { isAcceptedReceiptEvidenceFor } from "@/lib/receipts/accepted-evidence";

/**
 * In-memory store backing demo mode.
 *
 * This exists so the app is fully walkable the moment it's cloned, with no
 * Supabase project and no Postgres. Everything is process-local and resets on
 * restart, which is exactly what you want for a demo and exactly what you must
 * not ship to production — `DATABASE_URL` switches the app to Prisma instead.
 */

interface PledgeRecord {
  id: string;
  userId: string;
  targetId: string;
  amountCents: number;
  confirmedAmountCents: number | null;
  ocrAmountCents: number | null;
  status: PledgeStatus;
  trackingTagUsed: string;
  clientRequestId: string | null;
  receiptUrl: string | null;
  evidenceType: ContributionEvidenceType | null;
  receiptCheckStatus: ReceiptCheckStatus;
  receiptEvidenceHash: string | null;
  receiptCheckModel: string | null;
  receiptCheckedAt: Date | null;
  receiptExtractedAmountCents: number | null;
  receiptContributionDate: Date | null;
  receiptCandidateMatched: boolean | null;
  receiptCommitteeMatched: boolean | null;
  receiptAmountMatched: boolean | null;
  receiptProcessorMatched: boolean | null;
  receiptDatePlausible: boolean | null;
  receiptCheckReasons: string[];
  isAnonymousAtPledge: boolean;
  attestedAt: Date | null;
  attestationVersion: string | null;
  createdAt: Date;
}

interface ActivityRecord {
  id: string;
  coalitionId: string;
  targetId: string | null;
  type: ActivityType;
  evidenceType: ContributionEvidenceType | null;
  actorLabel: string | null;
  amountCents: number | null;
  message: string | null;
  createdAt: Date;
}

interface DemoState {
  users: Map<string, fixtures.FixtureUser>;
  coalitions: Map<string, fixtures.FixtureCoalition>;
  candidates: Map<string, fixtures.FixtureCandidate>;
  targets: Map<string, fixtures.FixtureTarget & { coalitionId: string }>;
  memberships: Map<
    string,
    { userId: string; coalitionId: string; role: string }
  >;
  pledges: Map<string, PledgeRecord>;
  activity: ActivityRecord[];
}

function buildEmbeddableDriveCatalog(
  coalitions: Iterable<fixtures.FixtureCoalition>,
  targets: Iterable<fixtures.FixtureTarget & { coalitionId: string }>,
) {
  const targetRows = [...targets];

  return [...coalitions]
    .filter((coalition) => coalition.isPublic)
    .map((coalition) => ({
      name: coalition.name,
      slug: coalition.slug,
      // Demo targets do not persist a status yet and are all exposed as ACTIVE
      // by toTargetView. Keep this count aligned with that model.
      targetCount: targetRows.filter(
        (target) => target.coalitionId === coalition.id,
      ).length,
    }))
    .filter((drive) => drive.targetCount > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function seedState(): DemoState {
  const state: DemoState = {
    users: new Map(),
    coalitions: new Map(),
    candidates: new Map(),
    targets: new Map(),
    memberships: new Map(),
    pledges: new Map(),
    activity: [],
  };

  for (const u of fixtures.users) state.users.set(u.id, { ...u });
  for (const c of fixtures.candidates) state.candidates.set(c.id, { ...c });
  state.coalitions.set(fixtures.coalition.id, { ...fixtures.coalition });

  for (const t of fixtures.targets) {
    state.targets.set(t.id, { ...t, coalitionId: fixtures.coalition.id });
  }

  for (const m of fixtures.memberships) {
    state.memberships.set(`${fixtures.coalition.id}:${m.userId}`, {
      userId: m.userId,
      coalitionId: fixtures.coalition.id,
      role: m.role,
    });
  }

  // The NC Hemp Industry drive is real organizer data rather than demo filler,
  // so it is seeded with no pledges at all: every bar starts at zero and only
  // moves when a contributor actually reports something.
  state.users.set(ncHemp.hempOrganizer.id, { ...ncHemp.hempOrganizer });
  state.coalitions.set(ncHemp.hempCoalition.id, { ...ncHemp.hempCoalition });
  for (const c of ncHemp.hempCandidates) state.candidates.set(c.id, { ...c });
  for (const t of ncHemp.hempTargets) {
    state.targets.set(t.id, { ...t, coalitionId: ncHemp.hempCoalition.id });
  }
  state.memberships.set(
    `${ncHemp.hempCoalition.id}:${ncHemp.hempOrganizer.id}`,
    {
      userId: ncHemp.hempOrganizer.id,
      coalitionId: ncHemp.hempCoalition.id,
      role: "OWNER",
    },
  );

  // Factual launch history keeps a new, zero-dollar drive from looking broken
  // without inventing contribution activity. Production seeds the same stable
  // rows, so local and deployed pages tell the same story.
  for (const [index, target] of ncHemp.hempTargets.entries()) {
    const activityId = ncHemp.hempLaunchActivityIds[index];
    if (!activityId) continue;

    state.activity.push({
      id: activityId,
      coalitionId: ncHemp.hempCoalition.id,
      targetId: target.id,
      type: ActivityType.TARGET_CREATED,
      evidenceType: null,
      actorLabel: null,
      amountCents: null,
      message: target.title,
      createdAt: ncHemp.HEMP_LAUNCHED_AT,
    });
  }

  for (const p of fixtures.pledges) {
    const createdAt = new Date(Date.now() - p.minutesAgo * 60_000);
    state.pledges.set(p.id, {
      id: p.id,
      userId: p.userId,
      targetId: p.targetId,
      amountCents: p.amountCents,
      confirmedAmountCents: p.confirmedAmountCents,
      ocrAmountCents: null,
      status: p.status,
      trackingTagUsed: `${fixtures.coalition.trackingPrefix}-DEMO`,
      clientRequestId: null,
      receiptUrl: p.hasReceipt ? "demo/receipt.png" : null,
      evidenceType:
        p.status === PledgeStatus.COMPLETED
          ? ContributionEvidenceType.RECEIPT_ATTACHED
          : p.status === PledgeStatus.UNVERIFIED
            ? ContributionEvidenceType.SELF_REPORTED
            : null,
      receiptCheckStatus: ReceiptCheckStatus.NOT_REQUESTED,
      receiptEvidenceHash: null,
      receiptCheckModel: null,
      receiptCheckedAt: null,
      receiptExtractedAmountCents: null,
      receiptContributionDate: null,
      receiptCandidateMatched: null,
      receiptCommitteeMatched: null,
      receiptAmountMatched: null,
      receiptProcessorMatched: null,
      receiptDatePlausible: null,
      receiptCheckReasons: [],
      isAnonymousAtPledge: p.isAnonymousAtPledge,
      attestedAt: p.status === PledgeStatus.PENDING ? null : createdAt,
      attestationVersion:
        p.status === PledgeStatus.PENDING ? null : "2026-01-v1",
      createdAt,
    });

    if (
      p.status === PledgeStatus.COMPLETED ||
      p.status === PledgeStatus.UNVERIFIED
    ) {
      state.activity.push({
        id: `act-${p.id}`,
        coalitionId: fixtures.coalition.id,
        targetId: p.targetId,
        type: ActivityType.PLEDGE_CONFIRMED,
        evidenceType:
          p.status === PledgeStatus.COMPLETED
            ? ContributionEvidenceType.RECEIPT_ATTACHED
            : ContributionEvidenceType.SELF_REPORTED,
        actorLabel: labelFor(state, p.userId, p.isAnonymousAtPledge),
        amountCents: p.confirmedAmountCents,
        message: null,
        createdAt,
      });
    }
  }

  state.activity.sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  return state;
}

/** Anonymous pledgers are never named; we don't have an identity to show. */
function labelFor(
  state: DemoState,
  userId: string,
  isAnonymous: boolean,
): string {
  if (isAnonymous) return "Someone";
  return state.users.get(userId)?.displayName ?? "A supporter";
}

// Survive HMR so a dev session doesn't lose pledges on every file save.
const globalForDemo = globalThis as unknown as { demoState?: DemoState };
const state: DemoState = globalForDemo.demoState ?? seedState();
globalForDemo.demoState = state;

function toCandidateView(c: fixtures.FixtureCandidate): CandidateView {
  return {
    id: c.id,
    slug: c.slug,
    fullName: c.fullName,
    legalName: c.legalName,
    party: c.party,
    office: c.office,
    state: c.state,
    district: c.district,
    bio: c.bio,
    photoUrl: c.photoUrl,
    donationUrl: c.donationUrl,
    platform: c.platform,
    websiteUrl: c.websiteUrl,
    officialProfileUrl: c.officialProfileUrl,
    officialDataVerifiedAt: c.officialDataVerifiedAt?.toISOString() ?? null,
    donationUrlVerifiedAt: c.donationUrlVerifiedAt?.toISOString() ?? null,
    jurisdiction: c.jurisdiction,
    committeeName: c.committeeName,
    ncsbeCommitteeId: c.ncsbeCommitteeId,
    fecCandidateId: c.fecCandidateId,
    fecCommitteeId: c.fecCommitteeId,
  };
}

function toCoalitionView(c: fixtures.FixtureCoalition): CoalitionView {
  const memberCount = [...state.memberships.values()].filter(
    (m) => m.coalitionId === c.id,
  ).length;

  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    logoUrl: c.logoUrl,
    trackingPrefix: c.trackingPrefix,
    flatTrackingTag: c.flatTrackingTag,
    requireSignIn: c.requireSignIn,
    verificationStatus: c.verificationStatus,
    reviewedAt: c.reviewedAt?.toISOString() ?? null,
    memberCount,
  };
}

function progressFor(targetId: string): ProgressSnapshot {
  expireDemoPledges();
  const target = state.targets.get(targetId);
  if (!target) {
    return computeProgress(0, null, []);
  }

  const rows = [...state.pledges.values()]
    .filter((p) => p.targetId === targetId)
    .map((p) => ({
      status: p.status,
      amountCents: p.amountCents,
      confirmedAmountCents: p.confirmedAmountCents,
      userId: p.userId,
      evidenceType: p.evidenceType,
    }));

  return computeProgress(target.goalCents, target.deadline, rows);
}

function toTargetView(
  target: fixtures.FixtureTarget & { coalitionId: string },
): TargetView | null {
  const coalition = state.coalitions.get(target.coalitionId);
  const candidate = state.candidates.get(target.candidateId);
  if (!coalition || !candidate) return null;

  return {
    id: target.id,
    slug: target.slug,
    title: target.title,
    description: target.description,
    goalCents: target.goalCents,
    deadline: target.deadline ? target.deadline.toISOString() : null,
    suggestedAmounts: target.suggestedAmounts,
    status: "ACTIVE",
    coalition: toCoalitionView(coalition),
    candidate: toCandidateView(candidate),
    progress: progressFor(target.id),
  };
}

function toPledgeView(p: PledgeRecord): PledgeView {
  return {
    id: p.id,
    targetId: p.targetId,
    userId: p.userId,
    amountCents: p.amountCents,
    confirmedAmountCents: p.confirmedAmountCents,
    status: p.status,
    trackingTagUsed: p.trackingTagUsed,
    receiptUrl: p.receiptUrl,
    evidenceType: p.evidenceType,
    receiptCheckStatus: p.receiptCheckStatus,
    createdAt: p.createdAt.toISOString(),
  };
}

function applyReceiptReview(
  pledge: PledgeRecord,
  review: ReceiptReviewInput,
): void {
  pledge.receiptCheckStatus = review.status;
  pledge.receiptCheckModel = review.model ?? null;
  pledge.receiptCheckedAt = review.checkedAt;
  pledge.receiptExtractedAmountCents =
    review.extractedAmountCents ?? null;
  pledge.receiptContributionDate = review.contributionDate ?? null;
  pledge.receiptCandidateMatched = review.candidateMatched ?? null;
  pledge.receiptCommitteeMatched = review.committeeMatched ?? null;
  pledge.receiptAmountMatched = review.amountMatched ?? null;
  pledge.receiptProcessorMatched = review.processorMatched ?? null;
  pledge.receiptDatePlausible = review.datePlausible ?? null;
  pledge.receiptCheckReasons = [...review.reasons];
}

function toActivityItem(activity: ActivityRecord): ActivityItem {
  const target = activity.targetId ? state.targets.get(activity.targetId) : null;
  const candidate = target ? state.candidates.get(target.candidateId) : null;

  return {
    id: activity.id,
    type: activity.type,
    evidenceType: activity.evidenceType,
    amountCents: activity.amountCents,
    message: activity.message,
    createdAt: activity.createdAt.toISOString(),
    targetTitle: target?.title ?? null,
    targetSlug: target?.slug ?? null,
    candidateName: candidate?.fullName ?? null,
  };
}

function isPublicActivity(activity: ActivityRecord): boolean {
  return (
    activity.type !== ActivityType.PLEDGE_CONFIRMED ||
    activity.evidenceType === ContributionEvidenceType.RECEIPT_ATTACHED ||
    activity.evidenceType === ContributionEvidenceType.RECEIPT_AI_CHECKED
  );
}

export const demoStore: Store = {
  isDemo: true,

  async ensureUser(userId, patch) {
    const existing = state.users.get(userId);
    if (existing) {
      state.users.set(userId, { ...existing, ...patch });
      return;
    }
    state.users.set(userId, {
      id: userId,
      email: patch?.email ?? null,
      displayName: patch?.displayName ?? null,
      isAnonymous: patch?.isAnonymous ?? true,
    });
  },

  async getCoalitionBySlug(slug) {
    const coalition = [...state.coalitions.values()].find(
      (c) => c.slug === slug,
    );
    return coalition ? toCoalitionView(coalition) : null;
  },

  async listCoalitions() {
    return [...state.coalitions.values()].map(toCoalitionView);
  },

  async listEmbeddableDrives() {
    return buildEmbeddableDriveCatalog(
      state.coalitions.values(),
      state.targets.values(),
    );
  },

  async listTargetsForCoalition(coalitionId) {
    return [...state.targets.values()]
      .filter((t) => t.coalitionId === coalitionId)
      .map(toTargetView)
      .filter((t): t is TargetView => t !== null);
  },

  async getTargetBySlug(slug) {
    const target = [...state.targets.values()].find((t) => t.slug === slug);
    return target ? toTargetView(target) : null;
  },

  async getTargetById(targetId) {
    const target = state.targets.get(targetId);
    return target ? toTargetView(target) : null;
  },

  async getProgress(targetId) {
    return progressFor(targetId);
  },

  async listActivity(coalitionId, limit = 20) {
    return state.activity
      .filter(
        (a) => a.coalitionId === coalitionId && isPublicActivity(a),
      )
      .slice(0, limit)
      .map(toActivityItem);
  },

  async listActivityForTarget(targetId, limit = 20) {
    return state.activity
      .filter((a) => a.targetId === targetId && isPublicActivity(a))
      .slice(0, limit)
      .map(toActivityItem);
  },

  async createPledge(input: CreatePledgeInput) {
    if (input.clientRequestId) {
      const existing = [...state.pledges.values()].find(
        (pledge) =>
          pledge.userId === input.userId &&
          pledge.clientRequestId === input.clientRequestId,
      );
      if (existing) {
        if (
          existing.targetId !== input.targetId ||
          existing.amountCents !== input.amountCents
        ) {
          throw new IdempotencyConflictError();
        }
        return toPledgeView(existing);
      }
    }

    const record: PledgeRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      targetId: input.targetId,
      amountCents: input.amountCents,
      confirmedAmountCents: null,
      ocrAmountCents: null,
      status: PledgeStatus.PENDING,
      trackingTagUsed: input.trackingTag,
      clientRequestId: input.clientRequestId ?? null,
      receiptUrl: null,
      evidenceType: null,
      receiptCheckStatus: ReceiptCheckStatus.NOT_REQUESTED,
      receiptEvidenceHash: null,
      receiptCheckModel: null,
      receiptCheckedAt: null,
      receiptExtractedAmountCents: null,
      receiptContributionDate: null,
      receiptCandidateMatched: null,
      receiptCommitteeMatched: null,
      receiptAmountMatched: null,
      receiptProcessorMatched: null,
      receiptDatePlausible: null,
      receiptCheckReasons: [],
      isAnonymousAtPledge: input.isAnonymous,
      attestedAt: null,
      attestationVersion: null,
      createdAt: new Date(),
    };
    state.pledges.set(record.id, record);
    return toPledgeView(record);
  },

  async getPledge(pledgeId) {
    expireDemoPledges();
    const p = state.pledges.get(pledgeId);
    return p ? toPledgeView(p) : null;
  },

  async getPledgeConfirmationContext(pledgeId) {
    expireDemoPledges();
    const pledge = state.pledges.get(pledgeId);
    if (!pledge) return null;

    const target = state.targets.get(pledge.targetId);
    const candidate = target
      ? state.candidates.get(target.candidateId)
      : null;
    if (!candidate) return null;

    return {
      pledge: toPledgeView(pledge),
      candidate: {
        id: candidate.id,
        jurisdiction: candidate.jurisdiction,
        state: candidate.state,
      },
    };
  },

  async recordReceiptReview(input) {
    const pledge = state.pledges.get(input.pledgeId);
    if (
      !pledge ||
      pledge.userId !== input.userId ||
      pledge.status !== PledgeStatus.PENDING
    ) {
      return false;
    }
    applyReceiptReview(pledge, input);
    return true;
  },

  async confirmPledge(input: ConfirmPledgeInput) {
    expireDemoPledges();
    const pledge = state.pledges.get(input.pledgeId);
    if (!pledge) return null;
    if (pledge.userId !== input.userId) return null;

    // Idempotent: re-confirming an already resolved pledge is a no-op rather
    // than a double count. Return-detection can legitimately fire twice.
    if (pledge.status !== PledgeStatus.PENDING) {
      return toPledgeView(pledge);
    }

    if (input.declined) {
      pledge.status = PledgeStatus.DECLINED;
      pledge.evidenceType = null;
      return toPledgeView(pledge);
    }

    const target = state.targets.get(pledge.targetId);
    const candidate = target
      ? state.candidates.get(target.candidateId)
      : null;
    const confirmedAmountCents =
      input.confirmedAmountCents ?? pledge.amountCents;
    const receiptEvidence = input.receiptEvidence;
    if (
      !target ||
      !candidate ||
      !isAcceptedReceiptEvidenceFor(receiptEvidence, {
        pledgeId: pledge.id,
        userId: pledge.userId,
        targetId: target.id,
        candidateId: candidate.id,
        amountCents: confirmedAmountCents,
      })
    ) {
      throw new ReceiptVerificationRequiredError();
    }

    if (
      [...state.pledges.values()].some(
        (other) =>
          other.id !== pledge.id &&
          other.receiptEvidenceHash === receiptEvidence.evidenceHash,
      )
    ) {
      throw new ReceiptEvidenceReuseError();
    }

    pledge.confirmedAmountCents = confirmedAmountCents;
    pledge.ocrAmountCents = null;
    pledge.receiptUrl = null;
    pledge.evidenceType = ContributionEvidenceType.RECEIPT_AI_CHECKED;
    applyReceiptReview(pledge, receiptEvidence);
    pledge.receiptEvidenceHash = receiptEvidence.evidenceHash;
    pledge.status = PledgeStatus.COMPLETED;
    pledge.attestedAt = new Date();
    pledge.attestationVersion = input.attestationVersion;

    state.activity.unshift({
      id: crypto.randomUUID(),
      coalitionId: target.coalitionId,
      targetId: target.id,
      type: ActivityType.PLEDGE_CONFIRMED,
      evidenceType: ContributionEvidenceType.RECEIPT_AI_CHECKED,
      actorLabel: null,
      amountCents: pledge.confirmedAmountCents,
      message: null,
      createdAt: new Date(),
    });

    return toPledgeView(pledge);
  },

  async listResumablePledges(userId) {
    expireDemoPledges();
    return [...state.pledges.values()]
      .filter((p) => p.userId === userId && p.status === PledgeStatus.PENDING)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map<ResumablePledge | null>((p) => {
        const target = state.targets.get(p.targetId);
        const candidate = target
          ? state.candidates.get(target.candidateId)
          : null;
        if (!target || !candidate) return null;
        return {
          pledgeId: p.id,
          amountCents: p.amountCents,
          targetSlug: target.slug,
          targetTitle: target.title,
          candidateName: candidate.fullName,
          createdAt: p.createdAt.toISOString(),
        };
      })
      .filter((p): p is ResumablePledge => p !== null);
  },

  async logClickEvent() {
    // Demo mode keeps no analytics history; the Prisma store persists these.
  },

  async createCoalitionWithTargets(input: CreateCoalitionInput) {
    if (input.targets.length < 1 || input.targets.length > 20) {
      throw new RangeError("A drive must contain between 1 and 20 targets.");
    }

    const coalitionId = crypto.randomUUID();
    const coalitionSlug = uniqueSlug(input.coalitionName, (s) =>
      [...state.coalitions.values()].some((c) => c.slug === s),
    );

    const reservedCandidateSlugs = new Set<string>();
    const reservedTargetSlugs = new Set<string>();
    const staged = input.targets.map((target) => {
      const candidateId = crypto.randomUUID();
      const candidateSlug = uniqueSlug(target.candidateName, (slug) =>
        reservedCandidateSlugs.has(slug) ||
        [...state.candidates.values()].some(
          (candidate) => candidate.slug === slug,
        ),
      );
      reservedCandidateSlugs.add(candidateSlug);

      const targetId = crypto.randomUUID();
      const targetSlug = uniqueSlug(
        `${target.candidateName}-${input.coalitionName}`,
        (slug) =>
          reservedTargetSlugs.has(slug) ||
          [...state.targets.values()].some(
            (fundraisingTarget) => fundraisingTarget.slug === slug,
          ),
      );
      reservedTargetSlugs.add(targetSlug);

      const candidate: fixtures.FixtureCandidate = {
        id: candidateId,
        slug: candidateSlug,
        fullName: target.candidateName,
        legalName: null,
        party: target.party,
        office: target.office,
        state: target.state,
        district: null,
        bio: null,
        photoUrl: null,
        donationUrl: target.donationUrl,
        donationUrlVerifiedAt: null,
        platform: target.platform,
        websiteUrl: null,
        officialProfileUrl: null,
        officialDataVerifiedAt: null,
        jurisdiction: target.jurisdiction,
        committeeName: target.committeeName ?? null,
        ncsbeCommitteeId: null,
        fecCandidateId: null,
        fecCommitteeId: null,
      };
      const fundraisingTarget: fixtures.FixtureTarget & {
        coalitionId: string;
      } = {
        id: targetId,
        slug: targetSlug,
        candidateId,
        coalitionId,
        title: target.targetTitle,
        description: input.description ?? null,
        goalCents: target.goalCents,
        deadline: target.deadline ?? null,
        suggestedAmounts: target.suggestedAmounts,
      };

      return { candidate, fundraisingTarget, platform: target.platform };
    });

    const now = new Date();
    const coalition: fixtures.FixtureCoalition = {
      id: coalitionId,
      slug: coalitionSlug,
      name: input.coalitionName,
      description: input.description ?? null,
      logoUrl: null,
      trackingPrefix: input.trackingPrefix,
      flatTrackingTag: input.flatTrackingTag,
      requireSignIn: false,
      verificationStatus:
        CoalitionVerificationStatus.COMMUNITY_UNVERIFIED,
      reviewedAt: null,
      organizerAttestedAt: now,
      isPublic: true,
      createdById: input.createdById,
    };

    // Commit the fully staged graph together. No visible state is mutated until
    // every candidate and target has been validated and allocated a unique id.
    state.coalitions.set(coalitionId, coalition);

    state.memberships.set(`${coalitionId}:${input.createdById}`, {
      userId: input.createdById,
      coalitionId,
      role: "OWNER",
    });

    for (const { candidate, fundraisingTarget } of staged) {
      state.candidates.set(candidate.id, candidate);
      state.targets.set(fundraisingTarget.id, fundraisingTarget);
    }
    state.activity.unshift(
      ...staged.map(({ fundraisingTarget }) => ({
        id: crypto.randomUUID(),
        coalitionId,
        targetId: fundraisingTarget.id,
        type: ActivityType.TARGET_CREATED,
        evidenceType: null,
        actorLabel: null,
        amountCents: null,
        message: fundraisingTarget.title,
        createdAt: now,
      })),
    );

    const targets = staged.map(({ candidate, fundraisingTarget, platform }) => ({
      candidateName: candidate.fullName,
      targetSlug: fundraisingTarget.slug,
      platform,
    }));

    return {
      coalitionSlug,
      firstTargetSlug: targets[0]!.targetSlug,
      targets,
    };
  },
};

function expireDemoPledges(now = new Date()): void {
  for (const pledge of state.pledges.values()) {
    if (
      pledge.status === PledgeStatus.PENDING &&
      isExpiredPendingPledge(pledge.createdAt, now)
    ) {
      pledge.status = PledgeStatus.EXPIRED;
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = slugify(base) || "coalition";
  if (!taken(root)) return root;

  for (let i = 2; i < 100; i++) {
    const candidate = `${root}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export { buildEmbeddableDriveCatalog, slugify, uniqueSlug };
