import { describe, expect, it } from "vitest";
import { ReceiptCheckStatus } from "@/generated/prisma/enums";
import { isAcceptedReceiptEvidenceFor } from "./accepted-evidence";

const EXPECTED = {
  pledgeId: "pledge-1",
  userId: "11111111-2222-4333-8444-555555555555",
  targetId: "target-1",
  candidateId: "candidate-1",
  amountCents: 50_000,
};

const EVIDENCE = {
  ...EXPECTED,
  status: ReceiptCheckStatus.AI_CHECKED_MATCH,
  model: "gpt-5-mini",
  checkedAt: new Date(),
  extractedAmountCents: 50_000,
  contributionDate: new Date(),
  candidateMatched: true,
  committeeMatched: null,
  amountMatched: true,
  processorMatched: true,
  datePlausible: true,
  reasons: [],
  evidenceHash: "a".repeat(64),
};

describe("accepted receipt evidence", () => {
  it("accepts a complete match for the exact pledge context", () => {
    expect(isAcceptedReceiptEvidenceFor(EVIDENCE, EXPECTED)).toBe(true);
  });

  it("fails closed on context, amount, status, or recipient mismatch", () => {
    expect(
      isAcceptedReceiptEvidenceFor(
        { ...EVIDENCE, candidateId: "candidate-2" },
        EXPECTED,
      ),
    ).toBe(false);
    expect(
      isAcceptedReceiptEvidenceFor(
        { ...EVIDENCE, extractedAmountCents: 25_000 },
        EXPECTED,
      ),
    ).toBe(false);
    expect(
      isAcceptedReceiptEvidenceFor(
        { ...EVIDENCE, status: ReceiptCheckStatus.AI_NEEDS_REVIEW },
        EXPECTED,
      ),
    ).toBe(false);
    expect(
      isAcceptedReceiptEvidenceFor(
        {
          ...EVIDENCE,
          candidateMatched: false,
          committeeMatched: false,
        },
        EXPECTED,
      ),
    ).toBe(false);
  });
});
