import { describe, expect, it } from "vitest";
import {
  ContributionEvidenceType,
  PledgeStatus,
} from "@/generated/prisma/enums";
import { computeProgress } from "./progress";

describe("public contribution progress", () => {
  it("counts only receipt-verified completed contributions", () => {
    const progress = computeProgress(100_000, null, [
      {
        status: PledgeStatus.COMPLETED,
        amountCents: 10_000,
        confirmedAmountCents: 12_500,
        userId: "verified-user",
        evidenceType: ContributionEvidenceType.RECEIPT_AI_CHECKED,
      },
      {
        status: PledgeStatus.UNVERIFIED,
        amountCents: 50_000,
        confirmedAmountCents: 50_000,
        userId: "legacy-self-report",
        evidenceType: ContributionEvidenceType.SELF_REPORTED,
      },
      {
        status: PledgeStatus.PENDING,
        amountCents: 25_000,
        confirmedAmountCents: null,
        userId: "pending-user",
        evidenceType: null,
      },
      {
        status: PledgeStatus.COMPLETED,
        amountCents: 75_000,
        confirmedAmountCents: 75_000,
        userId: "malformed-completed-self-report",
        evidenceType: ContributionEvidenceType.SELF_REPORTED,
      },
    ]);

    expect(progress).toMatchObject({
      confirmedCents: 12_500,
      attestedCents: 0,
      pendingCents: 25_000,
      raisedCents: 12_500,
      donorCount: 1,
    });
  });
});
