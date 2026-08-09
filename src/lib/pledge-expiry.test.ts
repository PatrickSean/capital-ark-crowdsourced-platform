import { describe, expect, it } from "vitest";
import {
  isExpiredPendingPledge,
  pendingPledgeCutoff,
} from "./pledge-expiry";

const NOW = new Date("2026-08-09T12:00:00.000Z");

describe("pending pledge expiry", () => {
  it("computes the cutoff 72 hours earlier", () => {
    expect(pendingPledgeCutoff(NOW).toISOString()).toBe(
      "2026-08-06T12:00:00.000Z",
    );
  });

  it("expires only pledges older than the cutoff", () => {
    expect(
      isExpiredPendingPledge("2026-08-06T11:59:59.999Z", NOW),
    ).toBe(true);
    expect(
      isExpiredPendingPledge("2026-08-06T12:00:00.000Z", NOW),
    ).toBe(false);
    expect(
      isExpiredPendingPledge("2026-08-08T12:00:00.000Z", NOW),
    ).toBe(false);
  });
});
