import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateSessionUser: vi.fn(),
  getTargetById: vi.fn(),
  createPledge: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getOrCreateSessionUser: mocks.getOrCreateSessionUser,
}));
vi.mock("@/lib/data", () => ({
  store: {
    getTargetById: mocks.getTargetById,
    createPledge: mocks.createPledge,
  },
}));
vi.mock("@/lib/api/rate-limit", () => ({
  LIMITS: {
    directPledge: { limit: 12, windowMs: 60_000 },
    directPledgePerIp: { limit: 40, windowMs: 60_000 },
  },
  rateLimit: () => ({ allowed: true, remaining: 10, retryAfterSeconds: 0 }),
}));

import { POST } from "./route";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const REQUEST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("POST /api/targets/[id]/pledges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateSessionUser.mockResolvedValue({
      id: USER_ID,
      isAnonymous: true,
    });
    mocks.getTargetById.mockResolvedValue(target());
    mocks.createPledge.mockResolvedValue({
      id: "pledge-1",
      targetId: "target-1",
      userId: USER_ID,
      amountCents: 50_000,
      confirmedAmountCents: null,
      status: "PENDING",
      trackingTagUsed: "HEMP-GET1-555555",
      receiptUrl: null,
      evidenceType: null,
      receiptCheckStatus: "NOT_REQUESTED",
      createdAt: new Date().toISOString(),
    });
  });

  it("creates an idempotent pending pledge without an outbound click", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "target-1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pledge: { id: "pledge-1", status: "PENDING" },
    });
    expect(mocks.createPledge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        targetId: "target-1",
        amountCents: 50_000,
        clientRequestId: REQUEST_ID,
      }),
    );
  });

  it("requires a UUID idempotency key", async () => {
    const response = await POST(request({ idempotencyKey: "bad" }), {
      params: Promise.resolve({ id: "target-1" }),
    });
    expect(response.status).toBe(422);
    expect(mocks.createPledge).not.toHaveBeenCalled();
  });

  it("rejects targets without a supported contribution page", async () => {
    mocks.getTargetById.mockResolvedValue(
      target({ donationUrl: null, platform: null }),
    );
    const response = await POST(request(), {
      params: Promise.resolve({ id: "target-1" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "recipient_unavailable" },
    });
    expect(mocks.createPledge).not.toHaveBeenCalled();
  });

  it("rejects a stale platform field that does not match the stored processor URL", async () => {
    mocks.getTargetById.mockResolvedValue(
      target({
        donationUrl: "https://secure.actblue.com/donate/example",
        platform: "ANEDOT",
      }),
    );
    const response = await POST(request(), {
      params: Promise.resolve({ id: "target-1" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "recipient_unavailable" },
    });
    expect(mocks.createPledge).not.toHaveBeenCalled();
  });
});

function request(options: { idempotencyKey?: string } = {}) {
  return new Request("http://localhost/api/targets/target-1/pledges", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": options.idempotencyKey ?? REQUEST_ID,
      "x-forwarded-for": "192.0.2.10",
    },
    body: JSON.stringify({ amountCents: 50_000 }),
  });
}

function target(
  candidatePatch: { donationUrl?: string | null; platform?: string | null } = {},
) {
  return {
    id: "target-1",
    status: "ACTIVE",
    coalition: {
      name: "North Carolina Hemp Industry",
      requireSignIn: false,
      trackingPrefix: "HEMP",
      flatTrackingTag: true,
    },
    candidate: {
      donationUrl:
        candidatePatch.donationUrl === undefined
          ? "https://secure.anedot.com/example/donate"
          : candidatePatch.donationUrl,
      platform:
        candidatePatch.platform === undefined
          ? "ANEDOT"
          : candidatePatch.platform,
    },
  };
}
