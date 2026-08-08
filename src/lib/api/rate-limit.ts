import "server-only";

/**
 * In-process sliding-window rate limiter.
 *
 * Sized for the actual threat: anonymous visitors can create pledges, and
 * pledges move a public progress bar, so an unthrottled endpoint lets one
 * script inflate a coalition's numbers.
 *
 * This is per-instance state. It's the right default for a single-region
 * deployment and for demo mode; a multi-instance deployment should swap the
 * backing map for Redis or Supabase, which is why the interface is narrow.
 */
interface Window {
  hits: number[];
}

const buckets = new Map<string, Window>();

// Bound memory: a long-running process must not accumulate one entry per
// unique visitor forever.
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => t < cutoff)) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t >= cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
  };
}

export const LIMITS = {
  /** Outbound link generation, per identity. Generous: people do retry. */
  generateLink: { limit: 12, windowMs: 60_000 },
  /** Same, per IP, to catch one script cycling anonymous identities. */
  generateLinkPerIp: { limit: 40, windowMs: 60_000 },
  confirmPledge: { limit: 20, windowMs: 60_000 },
  createCoalition: { limit: 5, windowMs: 60 * 60_000 },
} as const;
