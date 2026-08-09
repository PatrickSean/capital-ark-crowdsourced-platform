export const PENDING_PLEDGE_TTL_MS = 72 * 60 * 60 * 1000;

export function pendingPledgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PENDING_PLEDGE_TTL_MS);
}

export function isExpiredPendingPledge(
  createdAt: Date | string,
  now: Date = new Date(),
): boolean {
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;

  return (
    !Number.isNaN(created.getTime()) &&
    created.getTime() < pendingPledgeCutoff(now).getTime()
  );
}
