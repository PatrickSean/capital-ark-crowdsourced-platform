import type { PrismaClient } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDatabaseRetention } from "@/lib/data/database-retention";

const updateMany = vi.fn();
const transaction = vi.fn(async (operations: Promise<{ count: number }>[]) =>
  Promise.all(operations),
);
const prisma = {
  pledge: { updateMany },
  $transaction: transaction,
} as unknown as PrismaClient;

describe("database retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
  });

  it("expires stale intent and clears only hashes older than 30 days", async () => {
    const result = await runDatabaseRetention(
      prisma,
      new Date("2026-08-09T12:00:00.000Z"),
    );

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: "PENDING",
        createdAt: { lt: new Date("2026-08-06T12:00:00.000Z") },
      },
      data: { status: "EXPIRED" },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        ipHash: { not: null },
        createdAt: { lt: new Date("2026-07-10T12:00:00.000Z") },
      },
      data: { ipHash: null },
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(result).toEqual({
      expiredCount: 2,
      hashesClearedCount: 3,
      pendingCutoff: new Date("2026-08-06T12:00:00.000Z"),
      hashCutoff: new Date("2026-07-10T12:00:00.000Z"),
    });
  });
});
