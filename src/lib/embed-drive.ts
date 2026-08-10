import "server-only";

import type {
  ActivityType,
  CoalitionVerificationStatus,
  Party,
} from "@/generated/prisma/enums";
import type { Store } from "@/lib/data/store-types";
import { percentOf } from "@/lib/money";

const EMBED_ACTIVITY_LIMIT = 2;
const EMBED_TARGET_LIMIT = 4;

type EmbedSnapshotStore = Pick<
  Store,
  "getCoalitionBySlug" | "listTargetsForCoalition" | "listActivity"
>;

/**
 * The complete public wire contract for a drive embed.
 *
 * Keep this allowlist intentionally narrower than the app's internal view
 * models. In particular, embeds never receive user/session data, internal
 * coalition, target, user, or pledge IDs, tracking configuration, processor
 * URLs, pending pledges, or receipt evidence. Adding a field here is a
 * privacy-boundary change and should be reviewed as such.
 */
export interface PublicEmbedDriveSnapshot {
  coalition: {
    slug: string;
    name: string;
    verificationStatus: CoalitionVerificationStatus;
  };
  progress: {
    goalCents: number;
    /** Receipt-backed dollars only. */
    confirmedCents: number;
    percent: number;
    activeTargetCount: number;
  };
  targets: Array<{
    slug: string;
    candidate: {
      fullName: string;
      party: Party;
      office: string;
      state: string | null;
      district: string | null;
      photoUrl: string | null;
    };
    progress: {
      /** Receipt-backed dollars only. */
      confirmedCents: number;
      percent: number;
      donorCount: number;
    };
  }>;
  activity: Array<{
    type: ActivityType;
    amountCents: number | null;
    /** UTC calendar day only; embeds do not expose exact event times. */
    createdAt: string;
    targetTitle: string | null;
    candidateName: string | null;
  }>;
}

/**
 * Build a privacy-minimized, public snapshot for an existing coalition drive.
 *
 * The Store is injected so this boundary stays easy to test and cannot
 * accidentally depend on request cookies or a user session.
 */
export async function getPublicEmbedDriveSnapshot(
  store: EmbedSnapshotStore,
  slug: string,
): Promise<PublicEmbedDriveSnapshot | null> {
  const coalition = await store.getCoalitionBySlug(slug);
  if (!coalition) return null;

  const [targets, activity] = await Promise.all([
    store.listTargetsForCoalition(coalition.id),
    store.listActivity(coalition.id, EMBED_ACTIVITY_LIMIT),
  ]);

  const progress = targets.reduce(
    (aggregate, target) => {
      aggregate.goalCents += target.progress.goalCents;
      aggregate.confirmedCents += target.progress.confirmedCents;
      if (target.status === "ACTIVE") aggregate.activeTargetCount += 1;
      return aggregate;
    },
    {
      goalCents: 0,
      confirmedCents: 0,
      activeTargetCount: 0,
    },
  );

  return {
    coalition: {
      slug: coalition.slug,
      name: coalition.name,
      verificationStatus: coalition.verificationStatus,
    },
    progress: {
      ...progress,
      percent: percentOf(progress.confirmedCents, progress.goalCents),
    },
    targets: targets.slice(0, EMBED_TARGET_LIMIT).map((target) => ({
      slug: target.slug,
      candidate: {
        fullName: target.candidate.fullName,
        party: target.candidate.party,
        office: target.candidate.office,
        state: target.candidate.state,
        district: target.candidate.district,
        photoUrl: target.candidate.photoUrl,
      },
      progress: {
        confirmedCents: target.progress.confirmedCents,
        percent: target.progress.percent,
        donorCount: target.progress.donorCount,
      },
    })),
    // Map every property individually. That keeps future additions to the
    // internal ActivityItem model from silently becoming public API fields.
    activity: activity.slice(0, EMBED_ACTIVITY_LIMIT).map((item) => ({
      type: item.type,
      amountCents: item.amountCents,
      createdAt: utcDay(item.createdAt),
      targetTitle: item.targetTitle,
      candidateName: item.candidateName,
    })),
  };
}

function utcDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
}
