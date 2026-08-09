import { describe, expect, it } from "vitest";
import {
  ReceiptCheckStatus,
} from "@/generated/prisma/enums";
import { demoStore } from "./demo-store";
import {
  IdempotencyConflictError,
  ReceiptEvidenceReuseError,
} from "./errors";

describe("pledge idempotency and receipt evidence", () => {
  it("returns one pledge per user's client request id", async () => {
    const userId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    await demoStore.ensureUser(userId);
    const target = await demoStore.getTargetBySlug("hemp-destin-hall");
    expect(target).not.toBeNull();

    const input = {
      userId,
      targetId: target!.id,
      amountCents: 50_000,
      trackingTag: "HEMP",
      isAnonymous: true,
      clientRequestId: requestId,
    };
    const first = await demoStore.createPledge(input);
    const retry = await demoStore.createPledge(input);
    expect(retry.id).toBe(first.id);
    await expect(
      demoStore.createPledge({ ...input, amountCents: 25_000 }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("prevents the same receipt digest from backing two contributions", async () => {
    const userId = crypto.randomUUID();
    await demoStore.ensureUser(userId);
    const target = await demoStore.getTargetBySlug("hemp-destin-hall");
    expect(target).not.toBeNull();

    const makePledge = () =>
      demoStore.createPledge({
        userId,
        targetId: target!.id,
        amountCents: 50_000,
        trackingTag: "HEMP",
        isAnonymous: true,
        clientRequestId: crypto.randomUUID(),
      });
    const first = await makePledge();
    const second = await makePledge();
    const review = {
      userId,
      targetId: target!.id,
      candidateId: target!.candidate.id,
      amountCents: 50_000,
      status: ReceiptCheckStatus.AI_CHECKED_MATCH,
      model: "gpt-5-mini",
      checkedAt: new Date(),
      extractedAmountCents: 50_000,
      contributionDate: new Date(),
      candidateMatched: true,
      committeeMatched: true,
      amountMatched: true,
      processorMatched: true,
      datePlausible: true,
      reasons: [],
      evidenceHash: "f".repeat(64),
    };

    const confirmed = await demoStore.confirmPledge({
      pledgeId: first.id,
      userId,
      confirmedAmountCents: 50_000,
      receiptEvidence: { ...review, pledgeId: first.id },
      attestationVersion: "test-v1",
    });
    expect(confirmed).toMatchObject({
      status: "COMPLETED",
      evidenceType: "RECEIPT_AI_CHECKED",
      receiptCheckStatus: "AI_CHECKED_MATCH",
    });

    await expect(
      demoStore.confirmPledge({
        pledgeId: second.id,
        userId,
        confirmedAmountCents: 50_000,
        receiptEvidence: { ...review, pledgeId: second.id },
        attestationVersion: "test-v1",
      }),
    ).rejects.toBeInstanceOf(ReceiptEvidenceReuseError);
  });

  it("refuses to confirm a pending pledge without complete matching receipt evidence", async () => {
    const userId = crypto.randomUUID();
    await demoStore.ensureUser(userId);
    const target = await demoStore.getTargetBySlug("hemp-destin-hall");
    expect(target).not.toBeNull();
    const pledge = await demoStore.createPledge({
      userId,
      targetId: target!.id,
      amountCents: 25_000,
      trackingTag: "HEMP",
      isAnonymous: true,
      clientRequestId: crypto.randomUUID(),
    });

    await expect(
      demoStore.confirmPledge({
        pledgeId: pledge.id,
        userId,
        confirmedAmountCents: 25_000,
        receiptEvidence: null,
        attestationVersion: "test-v1",
      }),
    ).rejects.toMatchObject({ name: "ReceiptVerificationRequiredError" });
    await expect(demoStore.getPledge(pledge.id)).resolves.toMatchObject({
      status: "PENDING",
      evidenceType: null,
    });
  });
});
