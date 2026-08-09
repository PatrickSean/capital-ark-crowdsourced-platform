import "server-only";

import {
  ActivityType,
  CoalitionVerificationStatus,
  PledgeStatus,
  TargetStatus,
} from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type {
  ActivityItem,
  CandidateView,
  CoalitionView,
  PledgeView,
  ResumablePledge,
  TargetView,
} from "@/lib/domain/types";
import { computeProgress, daysUntil } from "./progress";
import { slugify, uniqueSlug } from "./demo-store";
import { pendingPledgeCutoff } from "@/lib/pledge-expiry";
import type {
  ConfirmPledgeInput,
  CreateCoalitionInput,
  CreatePledgeInput,
  LogClickInput,
  Store,
  UserPatch,
} from "./store-types";

type CoalitionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  trackingPrefix: string;
  flatTrackingTag: boolean;
  requireSignIn: boolean;
  verificationStatus: CoalitionVerificationStatus;
  reviewedAt: Date | null;
  _count?: { members: number };
};

type CandidateRow = {
  id: string;
  slug: string;
  fullName: string;
  legalName: string | null;
  party: CandidateView["party"];
  office: string;
  state: string | null;
  district: string | null;
  bio: string | null;
  photoUrl: string | null;
  donationUrl: string | null;
  platform: CandidateView["platform"];
  websiteUrl: string | null;
  officialProfileUrl: string | null;
  officialDataVerifiedAt: Date | null;
  donationUrlVerifiedAt: Date | null;
  jurisdiction: CandidateView["jurisdiction"];
  committeeName: string | null;
  ncsbeCommitteeId: string | null;
  fecCandidateId: string | null;
  fecCommitteeId: string | null;
};

function toCoalitionView(row: CoalitionRow): CoalitionView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    trackingPrefix: row.trackingPrefix,
    flatTrackingTag: row.flatTrackingTag,
    requireSignIn: row.requireSignIn,
    verificationStatus: row.verificationStatus,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    memberCount: row._count?.members ?? 0,
  };
}

function toCandidateView(row: CandidateRow): CandidateView {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.fullName,
    legalName: row.legalName,
    party: row.party,
    office: row.office,
    state: row.state,
    district: row.district,
    bio: row.bio,
    photoUrl: row.photoUrl,
    donationUrl: row.donationUrl,
    platform: row.platform,
    websiteUrl: row.websiteUrl,
    officialProfileUrl: row.officialProfileUrl,
    officialDataVerifiedAt: row.officialDataVerifiedAt?.toISOString() ?? null,
    donationUrlVerifiedAt: row.donationUrlVerifiedAt?.toISOString() ?? null,
    jurisdiction: row.jurisdiction,
    committeeName: row.committeeName,
    ncsbeCommitteeId: row.ncsbeCommitteeId,
    fecCandidateId: row.fecCandidateId,
    fecCommitteeId: row.fecCommitteeId,
  };
}

const targetInclude = (cutoff: Date): Prisma.FundraisingTargetInclude => ({
    coalition: { include: { _count: { select: { members: true } } } },
    candidate: true,
    pledges: {
      // A failed maintenance sweep must never leave stale intents visible in
      // public totals. Resolved rows are retained; old PENDING rows are not.
      where: {
        OR: [
          { status: { not: PledgeStatus.PENDING } },
          { createdAt: { gte: cutoff } },
        ],
      },
      select: {
        status: true,
        amountCents: true,
        confirmedAmountCents: true,
        userId: true,
      },
    },
  });

type TargetWithRelations = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goalCents: number;
  deadline: Date | null;
  suggestedAmounts: number[];
  status: string;
  coalition: CoalitionRow;
  candidate: CandidateRow;
  pledges: {
    status: PledgeStatus;
    amountCents: number;
    confirmedAmountCents: number | null;
    userId: string;
  }[];
};

function toTargetView(row: TargetWithRelations): TargetView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    goalCents: row.goalCents,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    suggestedAmounts: row.suggestedAmounts,
    status: row.status,
    coalition: toCoalitionView(row.coalition),
    candidate: toCandidateView(row.candidate),
    progress: computeProgress(row.goalCents, row.deadline, row.pledges),
  };
}

function toPledgeView(row: {
  id: string;
  targetId: string;
  userId: string;
  amountCents: number;
  confirmedAmountCents: number | null;
  status: PledgeStatus;
  trackingTagUsed: string;
  receiptUrl: string | null;
  createdAt: Date;
}): PledgeView {
  return {
    id: row.id,
    targetId: row.targetId,
    userId: row.userId,
    amountCents: row.amountCents,
    confirmedAmountCents: row.confirmedAmountCents,
    status: row.status,
    trackingTagUsed: row.trackingTagUsed,
    receiptUrl: row.receiptUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createPrismaStore(prisma: PrismaClient): Store {
  return {
    isDemo: false,

    async ensureUser(userId: string, patch: UserPatch = {}) {
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: patch.email ?? null,
          displayName: patch.displayName ?? null,
          isAnonymous: patch.isAnonymous ?? true,
          employer: patch.employer ?? null,
          occupation: patch.occupation ?? null,
          city: patch.city ?? null,
          state: patch.state ?? null,
          zip: patch.zip ?? null,
        },
        update: Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        ),
      });
    },

    async getCoalitionBySlug(slug) {
      const row = await prisma.coalition.findFirst({
        where: { slug, isPublic: true },
        include: { _count: { select: { members: true } } },
      });
      return row ? toCoalitionView(row) : null;
    },

    async listCoalitions() {
      const rows = await prisma.coalition.findMany({
        where: { isPublic: true },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toCoalitionView);
    },

    async listTargetsForCoalition(coalitionId) {
      await maybeExpireStalePledges(prisma);
      const rows = await prisma.fundraisingTarget.findMany({
        where: { coalitionId, status: TargetStatus.ACTIVE },
        include: targetInclude(pendingPledgeCutoff()),
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => toTargetView(r as unknown as TargetWithRelations));
    },

    async getTargetBySlug(slug) {
      await maybeExpireStalePledges(prisma);
      const row = await prisma.fundraisingTarget.findFirst({
        where: {
          slug,
          status: TargetStatus.ACTIVE,
          coalition: { isPublic: true },
        },
        include: targetInclude(pendingPledgeCutoff()),
      });
      return row ? toTargetView(row as unknown as TargetWithRelations) : null;
    },

    async getTargetById(targetId) {
      await maybeExpireStalePledges(prisma);
      const row = await prisma.fundraisingTarget.findFirst({
        where: {
          id: targetId,
          status: TargetStatus.ACTIVE,
          coalition: { isPublic: true },
        },
        include: targetInclude(pendingPledgeCutoff()),
      });
      return row ? toTargetView(row as unknown as TargetWithRelations) : null;
    },

    async getProgress(targetId) {
      await maybeExpireStalePledges(prisma);
      const cutoff = pendingPledgeCutoff();
      const target = await prisma.fundraisingTarget.findFirst({
        where: {
          id: targetId,
          status: TargetStatus.ACTIVE,
          coalition: { isPublic: true },
        },
        select: { goalCents: true, deadline: true },
      });
      if (!target) return computeProgress(0, null, []);

      // One grouped aggregate rather than loading pledge rows: the public
      // progress endpoint is the hottest read in the app.
      const grouped = await prisma.pledge.groupBy({
        by: ["status"],
        where: {
          targetId,
          OR: [
            { status: { not: PledgeStatus.PENDING } },
            { createdAt: { gte: cutoff } },
          ],
        },
        _sum: { amountCents: true, confirmedAmountCents: true },
      });

      const donors = await prisma.pledge.findMany({
        where: {
          targetId,
          status: { in: [PledgeStatus.COMPLETED, PledgeStatus.UNVERIFIED] },
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      const sumFor = (status: PledgeStatus, useConfirmed: boolean) => {
        const row = grouped.find((g) => g.status === status);
        if (!row) return 0;
        return (
          (useConfirmed
            ? row._sum.confirmedAmountCents
            : row._sum.amountCents) ?? 0
        );
      };

      const confirmedCents = sumFor(PledgeStatus.COMPLETED, true);
      const attestedCents = sumFor(PledgeStatus.UNVERIFIED, true);
      const pendingCents = sumFor(PledgeStatus.PENDING, false);
      const raisedCents = confirmedCents + attestedCents;

      return {
        goalCents: target.goalCents,
        confirmedCents,
        attestedCents,
        pendingCents,
        raisedCents,
        percent:
          target.goalCents > 0
            ? Math.min(
                100,
                Math.round((raisedCents / target.goalCents) * 1000) / 10,
              )
            : 0,
        donorCount: donors.length,
        daysRemaining: daysUntil(target.deadline),
      };
    },

    async listActivity(coalitionId, limit = 20) {
      const rows = await prisma.activityEvent.findMany({
        where: { coalitionId },
        include: { target: { include: { candidate: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return rows.map<ActivityItem>((a) => ({
        id: a.id,
        type: a.type,
        actorLabel: a.actorLabel,
        amountCents: a.amountCents,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        targetTitle: a.target?.title ?? null,
        candidateName: a.target?.candidate?.fullName ?? null,
      }));
    },

    async createPledge(input: CreatePledgeInput) {
      const row = await prisma.pledge.create({
        data: {
          userId: input.userId,
          targetId: input.targetId,
          amountCents: input.amountCents,
          trackingTagUsed: input.trackingTag,
          isAnonymousAtPledge: input.isAnonymous,
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent ?? null,
          status: PledgeStatus.PENDING,
        },
      });
      return toPledgeView(row);
    },

    async getPledge(pledgeId) {
      const row = await prisma.pledge.findUnique({ where: { id: pledgeId } });
      return row ? toPledgeView(row) : null;
    },

    async getPledgeConfirmationContext(pledgeId) {
      const row = await prisma.pledge.findUnique({
        where: { id: pledgeId },
        include: { target: { include: { candidate: true } } },
      });
      if (!row) return null;

      return {
        pledge: toPledgeView(row),
        candidate: {
          jurisdiction: row.target.candidate.jurisdiction,
          state: row.target.candidate.state,
        },
      };
    },

    async confirmPledge(input: ConfirmPledgeInput) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.pledge.findUnique({
          where: { id: input.pledgeId },
          include: { target: true, user: true },
        });

        if (!existing || existing.userId !== input.userId) return null;

        // A repeated request returns the first result. More importantly, the
        // conditional update below also makes two simultaneous first requests
        // race for one PENDING row; only the winner may write an activity event.
        if (existing.status !== PledgeStatus.PENDING) {
          return toPledgeView(existing);
        }

        const confirmedAmountCents =
          input.confirmedAmountCents ?? existing.amountCents;
        const status = input.declined
          ? PledgeStatus.DECLINED
          : input.receiptUrl
            ? PledgeStatus.COMPLETED
            : PledgeStatus.UNVERIFIED;

        const claimed = await tx.pledge.updateMany({
          where: {
            id: input.pledgeId,
            userId: input.userId,
            status: PledgeStatus.PENDING,
          },
          data: input.declined
            ? { status }
            : {
                confirmedAmountCents,
                ocrAmountCents: input.ocrAmountCents ?? null,
                receiptUrl: input.receiptUrl ?? null,
                status,
                attestedAt: new Date(),
                attestationVersion: input.attestationVersion,
              },
        });

        if (claimed.count === 0) {
          const resolved = await tx.pledge.findFirst({
            where: { id: input.pledgeId, userId: input.userId },
          });
          return resolved ? toPledgeView(resolved) : null;
        }

        if (!input.declined) {
          await tx.activityEvent.create({
            data: {
              coalitionId: existing.target.coalitionId,
              targetId: existing.targetId,
              actorId: existing.userId,
              type: ActivityType.PLEDGE_CONFIRMED,
              actorLabel: existing.isAnonymousAtPledge
                ? "Someone"
                : (existing.user.displayName ?? "A supporter"),
              amountCents: confirmedAmountCents,
            },
          });
        }

        const updated = await tx.pledge.findUnique({
          where: { id: input.pledgeId },
        });
        return updated ? toPledgeView(updated) : null;
      });
    },

    async listResumablePledges(userId) {
      await maybeExpireStalePledges(prisma);
      const rows = await prisma.pledge.findMany({
        where: {
          userId,
          status: PledgeStatus.PENDING,
          createdAt: { gte: pendingPledgeCutoff() },
        },
        include: { target: { include: { candidate: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return rows.map<ResumablePledge>((p) => ({
        pledgeId: p.id,
        amountCents: p.amountCents,
        targetSlug: p.target.slug,
        targetTitle: p.target.title,
        candidateName: p.target.candidate.fullName,
        createdAt: p.createdAt.toISOString(),
      }));
    },

    async logClickEvent(input: LogClickInput) {
      await prisma.linkClickEvent.create({
        data: {
          pledgeId: input.pledgeId,
          targetId: input.targetId,
          userId: input.userId,
          platform: input.platform,
          trackingTag: input.trackingTag,
          generatedUrl: input.generatedUrl,
          amountCents: input.amountCents,
          referrer: input.referrer ?? null,
          ipHash: input.ipHash ?? null,
        },
      });
    },

    async createCoalitionWithTargets(input: CreateCoalitionInput) {
      if (input.targets.length < 1 || input.targets.length > 20) {
        throw new RangeError("A drive must contain between 1 and 20 targets.");
      }

      const coalitionSlug = await nextFreeSlug(input.coalitionName, async (s) =>
        Boolean(await prisma.coalition.findUnique({ where: { slug: s } })),
      );
      const reservedCandidateSlugs = new Set<string>();
      const reservedTargetSlugs = new Set<string>();
      const slugs: { candidateSlug: string; targetSlug: string }[] = [];

      for (const target of input.targets) {
        const candidateSlug = await nextFreeSlug(
          target.candidateName,
          async (slug) =>
            reservedCandidateSlugs.has(slug) ||
            Boolean(
              await prisma.candidate.findUnique({ where: { slug } }),
            ),
        );
        reservedCandidateSlugs.add(candidateSlug);

        const targetSlug = await nextFreeSlug(
          `${target.candidateName}-${input.coalitionName}`,
          async (slug) =>
            reservedTargetSlugs.has(slug) ||
            Boolean(
              await prisma.fundraisingTarget.findUnique({ where: { slug } }),
            ),
        );
        reservedTargetSlugs.add(targetSlug);
        slugs.push({ candidateSlug, targetSlug });
      }

      const createdTargets = await prisma.$transaction(async (tx) => {
        const coalition = await tx.coalition.create({
          data: {
            slug: coalitionSlug,
            name: input.coalitionName,
            description: input.description ?? null,
            trackingPrefix: input.trackingPrefix,
            flatTrackingTag: input.flatTrackingTag,
            verificationStatus:
              CoalitionVerificationStatus.COMMUNITY_UNVERIFIED,
            organizerAttestedAt: new Date(),
            createdById: input.createdById,
            members: { create: { userId: input.createdById, role: "OWNER" } },
          },
        });

        const created = [];
        for (const [index, target] of input.targets.entries()) {
          const targetSlugs = slugs[index];
          if (!targetSlugs) {
            throw new Error("Missing allocated target slug.");
          }

          const candidate = await tx.candidate.create({
            data: {
              slug: targetSlugs.candidateSlug,
              fullName: target.candidateName,
              party: target.party,
              office: target.office,
              state: target.state,
              jurisdiction: target.jurisdiction,
              donationUrl: target.donationUrl,
              platform: target.platform,
              committeeName: target.committeeName ?? null,
            },
          });

          const fundraisingTarget = await tx.fundraisingTarget.create({
            data: {
              slug: targetSlugs.targetSlug,
              coalitionId: coalition.id,
              candidateId: candidate.id,
              title: target.targetTitle,
              description: input.description ?? null,
              goalCents: target.goalCents,
              deadline: target.deadline ?? null,
              suggestedAmounts: target.suggestedAmounts,
              createdById: input.createdById,
            },
          });

          await tx.activityEvent.create({
            data: {
              coalitionId: coalition.id,
              targetId: fundraisingTarget.id,
              type: ActivityType.TARGET_CREATED,
              message: target.targetTitle,
            },
          });

          created.push({
            candidateName: target.candidateName,
            targetSlug: fundraisingTarget.slug,
            platform: target.platform,
          });
        }

        return created;
      });

      const firstTarget = createdTargets[0];
      if (!firstTarget) {
        throw new Error("A created drive must contain at least one target.");
      }

      return {
        coalitionSlug,
        firstTargetSlug: firstTarget.targetSlug,
        targets: createdTargets,
      };
    },
  };
}

const EXPIRY_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastExpirySweepAt = 0;
let expirySweep: Promise<void> | null = null;

async function maybeExpireStalePledges(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  if (now - lastExpirySweepAt < EXPIRY_SWEEP_INTERVAL_MS) return;
  if (expirySweep) return expirySweep;

  expirySweep = prisma.pledge
    .updateMany({
      where: {
        status: PledgeStatus.PENDING,
        createdAt: { lt: pendingPledgeCutoff(new Date(now)) },
      },
      data: { status: PledgeStatus.EXPIRED },
    })
    .then(() => {
      lastExpirySweepAt = now;
    })
    .catch((error: unknown) => {
      // Reads independently exclude stale rows, so a transient write failure
      // cannot inflate totals. Retry on the next request rather than taking a
      // public campaign page offline.
      console.error("Failed to expire stale contribution intents", error);
    })
    .finally(() => {
      expirySweep = null;
    });

  return expirySweep;
}

async function nextFreeSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  if (!(await taken(root))) return root;

  for (let i = 2; i < 50; i++) {
    const candidate = `${root}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export { uniqueSlug };
