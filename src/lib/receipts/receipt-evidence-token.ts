import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_MS = 20 * 60_000;

const ClaimsSchema = z.object({
  version: z.literal(1),
  userId: z.string().uuid(),
  pledgeId: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
  candidateId: z.string().min(1).max(100),
  amountCents: z.number().int().positive().max(100_000_00),
  evidenceHash: z.string().regex(/^[0-9a-f]{64}$/),
  checkedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  model: z.string().min(1).max(100),
  extractedAmountCents: z.number().int().positive().max(100_000_00),
  contributionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  candidateMatched: z.boolean(),
  committeeMatched: z.boolean().nullable(),
  amountMatched: z.literal(true),
  processorMatched: z.literal(true),
  datePlausible: z.literal(true),
});

export type ReceiptEvidenceClaims = z.infer<typeof ClaimsSchema>;

export function hashReceiptEvidence(
  bytes: Uint8Array,
  secret: string,
): string {
  if (!secret) throw new Error("Receipt evidence secret is required.");
  // A keyed SHA-256 digest detects cross-pledge reuse without creating a
  // globally linkable fingerprint of a sensitive political receipt.
  return createHmac("sha256", secret)
    .update("capital-ark-receipt-image:v1\0")
    .update(bytes)
    .digest("hex");
}

export function receiptSafetyIdentifier(
  userId: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`capital-ark-openai-safety:v1:${userId}`)
    .digest("hex");
}

/**
 * Authenticated encryption keeps the receipt fingerprint and review metadata
 * opaque to the browser while allowing a stateless confirmation request.
 */
export function createReceiptEvidenceToken(
  claims: Omit<ReceiptEvidenceClaims, "version" | "checkedAt" | "expiresAt"> & {
    checkedAt?: number;
    expiresAt?: number;
  },
  secret: string,
  now = Date.now(),
): string {
  if (!secret) throw new Error("Receipt evidence secret is required.");
  const parsed = ClaimsSchema.parse({
    ...claims,
    version: 1,
    checkedAt: claims.checkedAt ?? now,
    expiresAt: claims.expiresAt ?? now + DEFAULT_TTL_MS,
  });

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from("capital-ark-receipt-evidence:v1"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(parsed), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function verifyReceiptEvidenceToken(
  token: string,
  expected: {
    userId: string;
    pledgeId: string;
    targetId: string;
    candidateId: string;
    amountCents: number;
  },
  secret: string,
  now = Date.now(),
): ReceiptEvidenceClaims | null {
  if (!secret || token.length > 4096) return null;
  const [version, ivText, ciphertextText, tagText, extra] = token.split(".");
  if (
    version !== TOKEN_VERSION ||
    !ivText ||
    !ciphertextText ||
    !tagText ||
    extra !== undefined
  ) {
    return null;
  }

  try {
    const iv = Buffer.from(ivText, "base64url");
    const ciphertext = Buffer.from(ciphertextText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      iv,
    );
    decipher.setAAD(Buffer.from("capital-ark-receipt-evidence:v1"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const claims = ClaimsSchema.parse(JSON.parse(plaintext));

    if (
      claims.expiresAt < now ||
      claims.checkedAt > now + 60_000 ||
      claims.userId !== expected.userId ||
      claims.pledgeId !== expected.pledgeId ||
      claims.targetId !== expected.targetId ||
      claims.candidateId !== expected.candidateId ||
      claims.amountCents !== expected.amountCents ||
      claims.extractedAmountCents !== expected.amountCents ||
      claims.checkedAt > claims.expiresAt ||
      (claims.candidateMatched !== true && claims.committeeMatched !== true)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256")
    .update(`capital-ark-receipt-token-key:v1:${secret}`)
    .digest();
}
