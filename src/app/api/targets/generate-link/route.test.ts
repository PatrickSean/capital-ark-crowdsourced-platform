import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateSessionUser: vi.fn(),
  getTargetById: vi.fn(),
  createPledge: vi.fn(),
  logClickEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getOrCreateSessionUser: mocks.getOrCreateSessionUser,
}));
vi.mock("@/lib/data", () => ({
  store: {
    getTargetById: mocks.getTargetById,
    createPledge: mocks.createPledge,
    logClickEvent: mocks.logClickEvent,
  },
}));
vi.mock("@/lib/api/rate-limit", () => ({
  LIMITS: {
    generateLink: { limit: 12, windowMs: 60_000 },
    generateLinkPerIp: { limit: 40, windowMs: 60_000 },
  },
  rateLimit: () => ({ allowed: true, remaining: 10, retryAfterSeconds: 0 }),
}));

import { POST } from "./route";

const USER_ID = "11111111-2222-4333-8444-555555555555";

describe("POST /api/targets/generate-link privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateSessionUser.mockResolvedValue({
      id: USER_ID,
      email: "alice@example.test",
      displayName: "Alice Supporter",
      isAnonymous: false,
    });
    mocks.getTargetById.mockResolvedValue({
      id: "target-1",
      status: "ACTIVE",
      suggestedAmounts: [2_500, 5_000],
      coalition: {
        name: "Example coalition",
        requireSignIn: false,
        trackingPrefix: "EXAMPLE",
        flatTrackingTag: false,
      },
      candidate: {
        fullName: "Candidate Example",
        committeeName: "Candidate Example Committee",
        donationUrl: "https://secure.actblue.com/donate/example",
        platform: "ACTBLUE",
      },
    });
    mocks.createPledge.mockResolvedValue({ id: "pledge-1" });
    mocks.logClickEvent.mockResolvedValue(undefined);
  });

  it("returns an opted-in prefill URL without persisting URL or request metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/targets/generate-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.10",
          "user-agent": "Privacy-sensitive browser fingerprint",
          referer: "https://example.test/supporters/alice",
        },
        body: JSON.stringify({
          targetId: "target-1",
          amountCents: 5_000,
          includePrefill: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outboundUrl).toContain("alice%40example.test");
    expect(body.outboundUrl).toContain("firstname=Alice");

    const pledgeInput = mocks.createPledge.mock.calls[0]?.[0];
    expect(pledgeInput).not.toHaveProperty("userAgent");

    expect(mocks.logClickEvent).toHaveBeenCalledWith({
      targetId: "target-1",
      platform: "ACTBLUE",
      trackingTag: body.trackingTag,
      amountCents: 5_000,
    });
    const clickInput = mocks.logClickEvent.mock.calls[0]?.[0];
    expect(clickInput).not.toHaveProperty("generatedUrl");
    expect(clickInput).not.toHaveProperty("referrer");
    expect(clickInput).not.toHaveProperty("userId");
    expect(clickInput).not.toHaveProperty("pledgeId");
    expect(clickInput).not.toHaveProperty("ipHash");
    expect(JSON.stringify(clickInput)).not.toContain("alice@example.test");
  });
});
