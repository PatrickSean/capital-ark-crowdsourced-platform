import "server-only";

import {
  ActivityType,
  PledgeStatus,
  TargetStatus,
} from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
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
  _count?: { members: number };
};

type CandidateRow = {
  id: string;
  slug: string;
  fullName: string;
  party: CandidateView["party"];
  office: string;
  state: string | null;
  district: string | null;
  bio: string | null;
  photoUrl: string | null;
  donationUrl: string | null;
  platform: CandidateView["platform"];
  websiteUrl: string | null;
  jurisdiction: CandidateView["jurisdiction"];
  committeeName: string | null;
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
    memberCount: row._count?.members ?? 0,
  };
}

function toCandidateView(row: CandidateRow): CandidateView {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.fullName,
    party: row.party,
    office: row.office,
    state: row.state,
    district: row.district,
    bio: row.bio,
    photoUrl: row.photoUrl,
    donationUrl: row.donationUrl,
    platform: row.platform,
    websiteUrl: row.websiteUrl,
    jurisdiction: row.jurisdiction,
    committeeName: row.committeeName,
    fecCommitteeId: row.fecCommitteeId,
  };
}

const targetInclude = {
  coalition: { include: { _count: { select: { members: true } } } },
  candidate: true,
  pledges: {
    select: {
      status: true,
      amountCents: true,
      confirmedAmountCents: true,
      userId: true,
    },
  },
} as const;

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
      const rows = await prisma.fundraisingTarget.findMany({
        where: { coalitionId, status: TargetStatus.ACTIVE },
        include: targetInclude,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => toTargetView(r as unknown as TargetWithRelations));
    },

    async getTargetBySlug(slug) {
      const row = await prisma.fundraisingTarget.findFirst({
        where: {
          slug,
          status: TargetStatus.ACTIVE,
          coalition: { isPublic: true },
        },
        include: targetInclude,
      });
      return row ? toTargetView(row as unknown as TargetWithRelations) : null;
    },

    async getTargetById(targetId) {
      const row = await prisma.fundraisingTarget.findFirst({
        where: {
          id: targetId,
          status: TargetStatus.ACTIVE,
          coalition: { isPublic: true },
        },
        include: targetInclude,
      });
      return row ? toTargetView(row as unknown as TargetWithRelations) : null;
    },

    async getProgress(targetId) {
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
        where: { targetId },
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

    async confirmPledge(input: ConfirmPledgeInput) {
      const existing = await prisma.pledge.findUnique({
        where: { id: input.pledgeId },
        include: { target: true, user: true },
      });

      if (!existing || existing.userId !== input.userId) return null;

      // Idempotent by design: tab-return detection can fire more than once,
      // and a double-confirm must never double-count toward the goal.
      if (existing.status !== PledgeStatus.PENDING) {
        return toPledgeView(existing);
      }

      if (input.declined) {
        const declined = await prisma.pledge.update({
          where: { id: input.pledgeId },
          data: { status: PledgeStatus.DECLINED },
        });
        return toPledgeView(declined);
      }

      const confirmedAmountCents =
        input.confirmedAmountCents ?? existing.amountCents;
      const status = input.receiptUrl
        ? PledgeStatus.COMPLETED
        : PledgeStatus.UNVERIFIED;

      const [updated] = await prisma.$transaction([
        prisma.pledge.update({
          where: { id: input.pledgeId },
          data: {
            confirmedAmountCents,
            ocrAmountCents: input.ocrAmountCents ?? null,
            receiptUrl: input.receiptUrl ?? null,
            status,
            attestedAt: new Date(),
            attestationVersion: input.attestationVersion,
          },
        }),
        prisma.activityEvent.create({
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
        }),
      ]);

      return toPledgeView(updated);
    },

    async listResumablePledges(userId) {
      const rows = await prisma.pledge.findMany({
        where: { userId, status: PledgeStatus.PENDING },
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

    async createCoalitionWithTarget(input: CreateCoalitionInput) {
      const coalitionSlug = await nextFreeSlug(input.coalitionName, async (s) =>
        Boolean(await prisma.coalition.findUnique({ where: { slug: s } })),
      );
      const targetSlug = await nextFreeSlug(
        `${input.candidateName}-${input.coalitionName}`,
        async (s) =>
          Boolean(
            await prisma.fundraisingTarget.findUnique({ where: { slug: s } }),
          ),
      );
      const candidateSlug = await nextFreeSlug(input.candidateName, async (s) =>
        Boolean(await prisma.candidate.findUnique({ where: { slug: s } })),
      );

      await prisma.$transaction(async (tx) => {
        const candidate = await tx.candidate.create({
          data: {
            slug: candidateSlug,
            fullName: input.candidateName,
            party: input.party,
            office: input.office,
            state: input.state ?? null,
            jurisdiction: input.jurisdiction,
            donationUrl: input.donationUrl,
            platform: input.platform,
            committeeName: input.committeeName ?? input.candidateName,
          },
        });

        const coalition = await tx.coalition.create({
          data: {
            slug: coalitionSlug,
            name: input.coalitionName,
            description: input.description ?? null,
            trackingPrefix: input.trackingPrefix,
            flatTrackingTag: input.flatTrackingTag,
            createdById: input.createdById,
            members: { create: { userId: input.createdById, role: "OWNER" } },
          },
        });

        await tx.fundraisingTarget.create({
          data: {
            slug: targetSlug,
            coalitionId: coalition.id,
            candidateId: candidate.id,
            title: input.targetTitle,
            description: input.description ?? null,
            goalCents: input.goalCents,
            deadline: input.deadline ?? null,
            suggestedAmounts: input.suggestedAmounts,
            createdById: input.createdById,
          },
        });

        await tx.activityEvent.create({
          data: {
            coalitionId: coalition.id,
            type: ActivityType.TARGET_CREATED,
            message: input.targetTitle,
          },
        });
      });

      return { coalitionSlug, targetSlug };
    },
  };
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
