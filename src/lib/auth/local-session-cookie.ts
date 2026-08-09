import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;

function signatureFor(id: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`capital-ark-local-session:${id}`)
    .digest("hex");
}

/** A server-minted visitor id plus a tamper-evident HMAC. */
export function signLocalSessionId(id: string, secret: string): string {
  if (!UUID_PATTERN.test(id)) throw new Error("Local session id must be a UUID.");
  if (!secret) throw new Error("Local session signing secret is required.");
  return `${id}.${signatureFor(id, secret)}`;
}

/** Returns only authentic, well-formed ids; malformed cookies fail closed. */
export function verifyLocalSessionCookie(
  value: string,
  secret: string,
): string | null {
  const separator = value.lastIndexOf(".");
  if (separator < 0 || !secret) return null;

  const id = value.slice(0, separator);
  const supplied = value.slice(separator + 1);
  if (!UUID_PATTERN.test(id) || !SIGNATURE_PATTERN.test(supplied)) return null;

  const expected = signatureFor(id, secret);
  const suppliedBytes = Buffer.from(supplied, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (suppliedBytes.length !== expectedBytes.length) return null;

  return timingSafeEqual(suppliedBytes, expectedBytes) ? id : null;
}
