import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getPledgeConfirmationContext: vi.fn(),
  getTargetById: vi.fn(),
  recordReceiptReview: vi.fn(),
  extractReceiptWithOpenAI: vi.fn(),
  config: {
    apiKey: "test-key" as string | null,
    model: "gpt-5-mini",
    imageDetail: "high" as const,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/data", () => ({
  store: {
    getPledgeConfirmationContext: mocks.getPledgeConfirmationContext,
    getTargetById: mocks.getTargetById,
    recordReceiptReview: mocks.recordReceiptReview,
  },
}));
vi.mock("@/lib/api/rate-limit", () => ({
  LIMITS: {
    receiptReview: { limit: 6, windowMs: 600_000 },
    receiptReviewPerIp: { limit: 18, windowMs: 600_000 },
  },
  rateLimit: () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 }),
}));
vi.mock("@/lib/receipts/config", () => ({
  receiptReviewRuntimeConfig: () => mocks.config,
  receiptEvidenceSecret: () => "receipt-tests-secret",
}));
vi.mock("@/lib/receipts/receipt-review", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/receipts/receipt-review")
  >();
  return { ...actual, extractReceiptWithOpenAI: mocks.extractReceiptWithOpenAI };
});

import { POST } from "./route";

const USER_ID = "11111111-2222-4333-8444-555555555555";

describe("POST /api/receipts/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IP_HASH_SALT = "receipt-tests-secret";
    mocks.config.apiKey = "test-key";
    mocks.getSessionUser.mockResolvedValue({ id: USER_ID });
    mocks.getPledgeConfirmationContext.mockResolvedValue({
      pledge: {
        id: "pledge-1",
        userId: USER_ID,
        targetId: "target-1",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
    });
    mocks.getTargetById.mockResolvedValue({
      id: "target-1",
      candidate: {
        fullName: "Brenden H. Jones",
        committeeName: "Committee to Elect Brenden Jones",
        platform: "ANEDOT",
        donationUrl: "https://secure.anedot.com/example/donate",
        donationUrlVerifiedAt: new Date().toISOString(),
      },
    });
    mocks.recordReceiptReview.mockResolvedValue(true);
    mocks.extractReceiptWithOpenAI.mockResolvedValue({
      documentType: "contribution_receipt",
      paymentStatus: "completed",
      processor: "ANEDOT",
      candidateName: "Brenden Jones",
      committeeName: "Committee to Elect Brenden Jones",
      amountCents: 50_000,
      contributionDate: new Date().toISOString().slice(0, 10),
      legibility: "clear",
    });
  });

  it("returns only curated AI-check status and an opaque evidence token", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: "ai_checked",
      receiptBacked: true,
      aiChecked: true,
      canSelfReport: true,
    });
    expect(payload.evidenceToken).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty("extracted");
    expect(payload).not.toHaveProperty("matches");
    expect(mocks.extractReceiptWithOpenAI).toHaveBeenCalledWith(
      expect.not.objectContaining({ expected: expect.anything() }),
    );
    expect(mocks.recordReceiptReview).toHaveBeenCalledWith(
      expect.objectContaining({ status: "AI_CHECKED_MATCH" }),
    );
  });

  it("degrades explicitly when the API key is absent", async () => {
    mocks.config.apiKey = null;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "unavailable",
      receiptBacked: false,
      aiChecked: false,
      evidenceToken: null,
      canSelfReport: true,
    });
    expect(mocks.extractReceiptWithOpenAI).not.toHaveBeenCalled();
  });

  it("requires affirmative consent before reading the screenshot", async () => {
    const response = await POST(request({ consent: false }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "ai_consent_required" },
    });
    expect(mocks.extractReceiptWithOpenAI).not.toHaveBeenCalled();
  });

  it("caps the streamed multipart body even when Content-Length is forged", async () => {
    const oversized = new File(
      [new Uint8Array(8 * 1024 * 1024 + 129 * 1024)],
      "oversized.jpg",
      { type: "image/jpeg" },
    );
    const response = await POST(
      request({ receipt: oversized, contentLength: "1" }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "receipt_too_large" },
    });
    expect(mocks.extractReceiptWithOpenAI).not.toHaveBeenCalled();
  });
});

function request(
  options: {
    consent?: boolean;
    receipt?: File;
    contentLength?: string;
  } = {},
) {
  const form = new FormData();
  form.set("pledgeId", "pledge-1");
  form.set("confirmedAmountCents", "50000");
  form.set("consent", options.consent === false ? "false" : "true");
  form.set(
    "receipt",
    options.receipt ??
      new File(
        [jpegBytes().buffer as ArrayBuffer],
        "private-name-never-logged.jpg",
        { type: "image/jpeg" },
      ),
  );
  const headers: Record<string, string> = {
    "x-forwarded-for": "192.0.2.11",
  };
  if (options.contentLength) headers["content-length"] = options.contentLength;
  return new Request("http://localhost/api/receipts/verify", {
    method: "POST",
    headers,
    body: form,
  });
}

function jpegBytes(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0,
    ...new Array(20).fill(0),
    0xff, 0xd9,
  ]);
}
