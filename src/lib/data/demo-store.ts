import { ActivityType, PledgeStatus } from "@/generated/prisma/enums";
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
import * as fixtures from "./fixtures";
import * as ncHemp from "./campaigns/nc-hemp";
import type {
  ConfirmPledgeInput,
  CreateCoalitionInput,
  CreatePledgeInput,
  Store,
} from "./store-types";

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
  receiptUrl: string | null;
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
      receiptUrl: p.hasReceipt ? "demo/receipt.png" : null,
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
        actorLabel: labelFor(state, p.userId, p.isAnonymousAtPledge),
        amountCents: p.confirmedAmountCents,
        message: null,
        createdAt,
      });
    }
  }

  state.activity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    party: c.party,
    office: c.office,
    state: c.state,
    district: c.district,
    bio: c.bio,
    photoUrl: c.photoUrl,
    donationUrl: c.donationUrl,
    platform: c.platform,
    websiteUrl: c.websiteUrl,
    jurisdiction: c.jurisdiction,
    committeeName: c.committeeName,
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
    memberCount,
  };
}

function progressFor(targetId: string): ProgressSnapshot {
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
    createdAt: p.createdAt.toISOString(),
  };
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
      .filter((a) => a.coalitionId === coalitionId)
      .slice(0, limit)
      .map<ActivityItem>((a) => {
        const target = a.targetId ? state.targets.get(a.targetId) : null;
        const candidate = target
          ? state.candidates.get(target.candidateId)
          : null;
        return {
          id: a.id,
          type: a.type,
          actorLabel: a.actorLabel,
          amountCents: a.amountCents,
          message: a.message,
          createdAt: a.createdAt.toISOString(),
          targetTitle: target?.title ?? null,
          candidateName: candidate?.fullName ?? null,
        };
      });
  },

  async createPledge(input: CreatePledgeInput) {
    const record: PledgeRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      targetId: input.targetId,
      amountCents: input.amountCents,
      confirmedAmountCents: null,
      ocrAmountCents: null,
      status: PledgeStatus.PENDING,
      trackingTagUsed: input.trackingTag,
      receiptUrl: null,
      isAnonymousAtPledge: input.isAnonymous,
      attestedAt: null,
      attestationVersion: null,
      createdAt: new Date(),
    };
    state.pledges.set(record.id, record);
    return toPledgeView(record);
  },

  async getPledge(pledgeId) {
    const p = state.pledges.get(pledgeId);
    return p ? toPledgeView(p) : null;
  },

  async confirmPledge(input: ConfirmPledgeInput) {
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
      return toPledgeView(pledge);
    }

    pledge.confirmedAmountCents =
      input.confirmedAmountCents ?? pledge.amountCents;
    pledge.ocrAmountCents = input.ocrAmountCents ?? null;
    pledge.receiptUrl = input.receiptUrl ?? null;
    pledge.status = input.receiptUrl
      ? PledgeStatus.COMPLETED
      : PledgeStatus.UNVERIFIED;
    pledge.attestedAt = new Date();
    pledge.attestationVersion = input.attestationVersion;

    const target = state.targets.get(pledge.targetId);
    if (target) {
      state.activity.unshift({
        id: crypto.randomUUID(),
        coalitionId: target.coalitionId,
        targetId: target.id,
        type: ActivityType.PLEDGE_CONFIRMED,
        actorLabel: labelFor(state, pledge.userId, pledge.isAnonymousAtPledge),
        amountCents: pledge.confirmedAmountCents,
        message: null,
        createdAt: new Date(),
      });
    }

    return toPledgeView(pledge);
  },

  async listResumablePledges(userId) {
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

  async createCoalitionWithTarget(input: CreateCoalitionInput) {
    const candidateId = crypto.randomUUID();
    state.candidates.set(candidateId, {
      id: candidateId,
      slug: slugify(input.candidateName),
      fullName: input.candidateName,
      legalName: null,
      party: input.party,
      office: input.office,
      state: input.state ?? "",
      district: null,
      bio: null,
      photoUrl: null,
      donationUrl: input.donationUrl,
      donationUrlVerifiedAt: null,
      platform: input.platform,
      websiteUrl: null,
      officialProfileUrl: null,
      officialDataVerifiedAt: null,
      jurisdiction: input.jurisdiction,
      committeeName: input.committeeName ?? input.candidateName,
      ncsbeCommitteeId: null,
      fecCandidateId: null,
      fecCommitteeId: null,
    });

    const coalitionId = crypto.randomUUID();
    const coalitionSlug = uniqueSlug(input.coalitionName, (s) =>
      [...state.coalitions.values()].some((c) => c.slug === s),
    );
    state.coalitions.set(coalitionId, {
      id: coalitionId,
      slug: coalitionSlug,
      name: input.coalitionName,
      description: input.description ?? null,
      logoUrl: null,
      trackingPrefix: input.trackingPrefix,
      flatTrackingTag: input.flatTrackingTag,
      requireSignIn: false,
      isPublic: true,
      createdById: input.createdById,
    });

    state.memberships.set(`${coalitionId}:${input.createdById}`, {
      userId: input.createdById,
      coalitionId,
      role: "OWNER",
    });

    const targetId = crypto.randomUUID();
    const targetSlug = uniqueSlug(
      `${input.candidateName}-${input.coalitionName}`,
      (s) => [...state.targets.values()].some((t) => t.slug === s),
    );
    state.targets.set(targetId, {
      id: targetId,
      slug: targetSlug,
      candidateId,
      coalitionId,
      title: input.targetTitle,
      description: input.description ?? null,
      goalCents: input.goalCents,
      deadline: input.deadline ?? new Date(Date.now() + 30 * 86_400_000),
      suggestedAmounts: input.suggestedAmounts,
    });

    return { coalitionSlug, targetSlug };
  },
};

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

export { slugify, uniqueSlug };
