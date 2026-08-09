import "server-only";

import {
  INSECURE_DEVELOPMENT_IP_HASH_SALT,
  isUsableProductionIpHashSalt,
} from "@/lib/security-secrets";

export const DEFAULT_OPENAI_RECEIPT_MODEL = "gpt-5-mini";

/** Safe to serialize into a Server Component prop; it never exposes the key. */
export function isAiReceiptReviewConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() && receiptEvidenceSecret(),
  );
}

/** Stable secret for opaque evidence tokens, digests, and safety identifiers. */
export function receiptEvidenceSecret(): string | null {
  const configured = process.env.IP_HASH_SALT;
  if (process.env.NODE_ENV === "production") {
    return isUsableProductionIpHashSalt(configured) ? configured : null;
  }
  return configured?.trim()
    ? configured
    : INSECURE_DEVELOPMENT_IP_HASH_SALT;
}

export function receiptReviewRuntimeConfig(): {
  apiKey: string | null;
  model: string;
  imageDetail: "low" | "high" | "auto";
} {
  const detail = process.env.OPENAI_RECEIPT_IMAGE_DETAIL;
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    model:
      process.env.OPENAI_RECEIPT_MODEL?.trim() ||
      DEFAULT_OPENAI_RECEIPT_MODEL,
    // Receipt text is usually too small for the low-resolution vision path.
    imageDetail:
      detail === "low" || detail === "auto" || detail === "high"
        ? detail
        : "high",
  };
}
