const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * A short investigation window for salted network-address hashes.
 *
 * The in-process rate limiter uses the current request hash directly, so
 * clearing persisted hashes does not weaken live abuse prevention. Thirty
 * days leaves a bounded window for investigating repeated fraud reports.
 */
export const NETWORK_HASH_RETENTION_DAYS = 30;

export function networkHashCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - NETWORK_HASH_RETENTION_DAYS * DAY_MS);
}
