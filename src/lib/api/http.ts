import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import {
  INSECURE_DEVELOPMENT_IP_HASH_SALT,
  isUsableProductionIpHashSalt,
} from "@/lib/security-secrets";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Parses and validates a JSON body, returning a typed result or a response. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: jsonError(400, "invalid_json", "Request body must be valid JSON."),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      data: null,
      error: jsonError(
        422,
        "validation_failed",
        "Some fields need attention.",
        {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      ),
    };
  }

  return { data: parsed.data, error: null };
}

/** Best-effort client IP from the usual proxy headers. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

/**
 * Salted hash of an IP.
 *
 * Stored instead of the raw address: enough to correlate abuse from a single
 * source, not enough to identify a donor. Political contribution data is
 * sensitive, and the platform has no legitimate need for raw addresses.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT;
  // Never create predictable hashes of sensitive production traffic. The
  // health check rejects a production deployment without a real salt; this
  // fallback exists only to keep zero-config local development convenient.
  if (
    process.env.NODE_ENV === "production" &&
    !isUsableProductionIpHashSalt(salt)
  ) {
    return null;
  }
  const effectiveSalt = salt?.trim()
    ? salt
    : INSECURE_DEVELOPMENT_IP_HASH_SALT;
  return createHash("sha256")
    .update(`${effectiveSalt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
