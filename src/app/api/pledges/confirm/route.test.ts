import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getPledgeConfirmationContext: vi.fn(),
  confirmPledge: vi.fn(),
  getProgress: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));
vi.mock("@/lib/data", () => ({
  store: {
    getPledgeConfirmationContext: mocks.getPledgeConfirmationContext,
    confirmPledge: mocks.confirmPledge,
    getProgress: mocks.getProgress,
  },
}));
vi.mock("@/lib/api/rate-limit", () => ({
  LIMITS: { confirmPledge: { limit: 12, windowMs: 60_000 } },
  rateLimit: () => ({ allowed: true, remaining: 11, retryAfterSeconds: 0 }),
}));
vi.mock("@/lib/receipts/config", () => ({
  receiptEvidenceSecret: () => "confirm-route-test-secret",
}));

import { POST } from "./route";
import { createReceiptEvidenceToken } from "@/lib/receipts/receipt-evidence-token";
import { ReceiptEvidenceReuseError } from "@/lib/data/errors";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const CANDIDATE_ID = "candidate-1";

describe("POST /api/pledges/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: USER_ID });
    mocks.getPledgeConfirmationContext.mockResolvedValue({
      pledge: {
        id: "pledge-1",
        userId: USER_ID,
        targetId: "target-1",
        amountCents: 50_000,
        status: "PENDING",
        evidenceType: null,
        createdAt: new Date().toISOString(),
      },
      candidate: {
        id: CANDIDATE_ID,
        jurisdiction: "STATE",
        state: "NC",
      },
    });
    mocks.confirmPledge.mockResolvedValue({
      id: "pledge-1",
      userId: USER_ID,
      targetId: "target-1",
      amountCents: 50_000,
      confirmedAmountCents: 50_000,
      status: "COMPLETED",
      evidenceType: "RECEIPT_AI_CHECKED",
    });
    mocks.getProgress.mockResolvedValue({ raisedCents: 50_000 });
  });

  it("rejects self-reporting and legacy attachment-only confirmation", async () => {
    for (const extra of [{}, { receiptUrl: `${USER_ID}/pledge-1-1234567890123.jpg` }]) {
      const response = await POST(request(extra));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        error: { code: "receipt_verification_required" },
      });
    }
    expect(mocks.confirmPledge).not.toHaveBeenCalled();
  });

  it("confirms only with an authentic token bound to the pledge, candidate, and amount", async () => {
    const response = await POST(
      request({ receiptEvidenceToken: evidenceToken() }),
    );

    expect(response.status).toBe(200);
    expect(mocks.confirmPledge).toHaveBeenCalledWith(
      expect.objectContaining({
        pledgeId: "pledge-1",
        userId: USER_ID,
        confirmedAmountCents: 50_000,
        receiptEvidence: expect.objectContaining({
          pledgeId: "pledge-1",
          targetId: "target-1",
          candidateId: CANDIDATE_ID,
          amountCents: 50_000,
          status: "AI_CHECKED_MATCH",
          evidenceHash: "a".repeat(64),
        }),
      }),
    );
    expect(mocks.confirmPledge.mock.calls[0]?.[0]).not.toHaveProperty(
      "receiptUrl",
    );
  });

  it("rejects a valid token bound to a different candidate or amount", async () => {
    const wrongCandidate = await POST(
      request({
        receiptEvidenceToken: evidenceToken({ candidateId: "candidate-2" }),
      }),
    );
    expect(wrongCandidate.status).toBe(422);
    expect(await wrongCandidate.json()).toMatchObject({
      error: { code: "invalid_receipt_evidence" },
    });

    const wrongAmount = await POST(
      request({
        receiptEvidenceToken: evidenceToken({ amountCents: 25_000 }),
      }),
    );
    expect(wrongAmount.status).toBe(422);
    expect(await wrongAmount.json()).toMatchObject({
      error: { code: "invalid_receipt_evidence" },
    });
    expect(mocks.confirmPledge).not.toHaveBeenCalled();
  });

  it("maps receipt reuse to a stable conflict without a self-report fallback", async () => {
    mocks.confirmPledge.mockRejectedValue(new ReceiptEvidenceReuseError());
    const response = await POST(
      request({ receiptEvidenceToken: evidenceToken() }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "receipt_already_used",
        message:
          "That receipt was already used for another contribution. Upload a different receipt.",
      },
    });
  });
});

function request(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/pledges/confirm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.20",
    },
    body: JSON.stringify({
      pledgeId: "pledge-1",
      declined: false,
      confirmedAmountCents: 50_000,
      attested: true,
      attestationVersion: "2026-01-nc-v1",
      ...extra,
    }),
  });
}

function evidenceToken(
  patch: { candidateId?: string; amountCents?: number } = {},
) {
  const amountCents = patch.amountCents ?? 50_000;
  return createReceiptEvidenceToken(
    {
      userId: USER_ID,
      pledgeId: "pledge-1",
      targetId: "target-1",
      candidateId: patch.candidateId ?? CANDIDATE_ID,
      amountCents,
      evidenceHash: "a".repeat(64),
      model: "gpt-5-mini",
      extractedAmountCents: amountCents,
      contributionDate: new Date().toISOString().slice(0, 10),
      candidateMatched: true,
      committeeMatched: true,
      amountMatched: true,
      processorMatched: true,
      datePlausible: true,
    },
    "confirm-route-test-secret",
  );
}
