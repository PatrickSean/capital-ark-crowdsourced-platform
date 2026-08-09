import type { PrismaClient } from "@/generated/prisma/client";
import { PledgeStatus } from "@/generated/prisma/enums";
import { pendingPledgeCutoff } from "@/lib/pledge-expiry";
import { networkHashCutoff } from "@/lib/privacy-retention";

export interface DatabaseRetentionResult {
  expiredCount: number;
  hashesClearedCount: number;
  pendingCutoff: Date;
  hashCutoff: Date;
}

/**
 * Applies the two bounded pledge-retention rules in one transaction.
 *
 * Public progress already excludes stale pending rows, so a delayed job cannot
 * inflate totals. Network hashes are used only for a recent investigation
 * window; live request rate limits do not query these persisted values.
 */
export async function runDatabaseRetention(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<DatabaseRetentionResult> {
  const pendingCutoff = pendingPledgeCutoff(now);
  const hashCutoff = networkHashCutoff(now);
  const [expired, hashesCleared] = await prisma.$transaction([
    prisma.pledge.updateMany({
      where: {
        status: PledgeStatus.PENDING,
        createdAt: { lt: pendingCutoff },
      },
      data: { status: PledgeStatus.EXPIRED },
    }),
    prisma.pledge.updateMany({
      where: {
        ipHash: { not: null },
        createdAt: { lt: hashCutoff },
      },
      data: { ipHash: null },
    }),
  ]);

  return {
    expiredCount: expired.count,
    hashesClearedCount: hashesCleared.count,
    pendingCutoff,
    hashCutoff,
  };
}
