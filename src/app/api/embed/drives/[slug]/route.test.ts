import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicEmbedDriveSnapshot: vi.fn(),
  store: { isDemo: false },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data", () => ({ store: mocks.store }));
vi.mock("@/lib/embed-drive", () => ({
  getPublicEmbedDriveSnapshot: mocks.getPublicEmbedDriveSnapshot,
}));

import { GET } from "./route";

describe("GET /api/embed/drives/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the public snapshot directly with short shared caching", async () => {
    const snapshot = {
      coalition: {
        slug: "nc-hemp-industry",
        name: "North Carolina Hemp Industry",
        verificationStatus: "PLATFORM_VERIFIED",
      },
      progress: {
        goalCents: 100_000,
        confirmedCents: 25_000,
        percent: 25,
        activeTargetCount: 1,
      },
      targets: [],
      activity: [],
    };
    mocks.getPublicEmbedDriveSnapshot.mockResolvedValue(snapshot);

    const response = await GET(
      new Request(
        "http://localhost/api/embed/drives/nc-hemp-industry",
        {
          headers: {
            cookie: "private-session=must-not-be-read",
            referer: "https://partner.example/private-page",
          },
        },
      ),
      { params: Promise.resolve({ slug: "nc-hemp-industry" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
    );
    expect(mocks.getPublicEmbedDriveSnapshot).toHaveBeenCalledWith(
      mocks.store,
      "nc-hemp-industry",
    );
  });

  it("returns a stable 404 without exposing implementation details", async () => {
    mocks.getPublicEmbedDriveSnapshot.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/embed/drives/missing-drive"),
      { params: Promise.resolve({ slug: "missing-drive" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "drive_not_found",
        message: "That public fundraising drive no longer exists.",
      },
    });
  });
});
