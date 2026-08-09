import { describe, expect, it } from "vitest";
import {
  createReceiptEvidenceToken,
  hashReceiptEvidence,
  receiptSafetyIdentifier,
  verifyReceiptEvidenceToken,
} from "./receipt-evidence-token";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const CLAIMS = {
  userId: USER_ID,
  pledgeId: "pledge-1",
  targetId: "target-1",
  amountCents: 50_000,
  evidenceHash: "a".repeat(64),
  model: "gpt-5-mini",
  extractedAmountCents: 50_000,
  contributionDate: "2026-08-08",
  candidateMatched: true,
  committeeMatched: true,
  amountMatched: true as const,
  processorMatched: true as const,
  datePlausible: true as const,
};

describe("receipt evidence tokens", () => {
  it("round-trips authentic matching evidence", () => {
    const token = createReceiptEvidenceToken(CLAIMS, "test-secret", 1_000);
    const result = verifyReceiptEvidenceToken(
      token,
      {
        userId: USER_ID,
        pledgeId: "pledge-1",
        targetId: "target-1",
        amountCents: 50_000,
      },
      "test-secret",
      2_000,
    );
    expect(result).toMatchObject(CLAIMS);
    expect(token).not.toContain(CLAIMS.evidenceHash);
  });

  it("rejects tampering, wrong binding, and expiration", () => {
    const token = createReceiptEvidenceToken(CLAIMS, "test-secret", 1_000);
    const parts = token.split(".");
    const ciphertext = parts[2]!;
    parts[2] = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    const tampered = parts.join(".");
    expect(
      verifyReceiptEvidenceToken(
        tampered,
        {
          userId: USER_ID,
          pledgeId: "pledge-1",
          targetId: "target-1",
          amountCents: 50_000,
        },
        "test-secret",
        2_000,
      ),
    ).toBeNull();
    expect(
      verifyReceiptEvidenceToken(
        token,
        {
          userId: USER_ID,
          pledgeId: "another",
          targetId: "target-1",
          amountCents: 50_000,
        },
        "test-secret",
        2_000,
      ),
    ).toBeNull();
    expect(
      verifyReceiptEvidenceToken(
        token,
        {
          userId: USER_ID,
          pledgeId: "pledge-1",
          targetId: "target-1",
          amountCents: 25_000,
        },
        "test-secret",
        2_000,
      ),
    ).toBeNull();
    expect(
      verifyReceiptEvidenceToken(
        token,
        {
          userId: USER_ID,
          pledgeId: "pledge-1",
          targetId: "target-1",
          amountCents: 50_000,
        },
        "test-secret",
        1_000 + 21 * 60_000,
      ),
    ).toBeNull();
  });

  it("creates stable domain-separated privacy identifiers", () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    expect(hashReceiptEvidence(bytes, "secret")).toHaveLength(64);
    expect(hashReceiptEvidence(bytes, "secret")).not.toBe(
      hashReceiptEvidence(bytes, "other-secret"),
    );
    expect(receiptSafetyIdentifier(USER_ID, "secret")).toHaveLength(64);
    expect(receiptSafetyIdentifier(USER_ID, "secret")).not.toContain(USER_ID);
  });
});
