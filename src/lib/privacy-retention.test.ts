import { describe, expect, it } from "vitest";
import {
  NETWORK_HASH_RETENTION_DAYS,
  networkHashCutoff,
} from "@/lib/privacy-retention";

describe("network hash retention", () => {
  it("uses a documented 30-day investigation window", () => {
    expect(NETWORK_HASH_RETENTION_DAYS).toBe(30);
    expect(networkHashCutoff(new Date("2026-08-09T12:00:00.000Z"))).toEqual(
      new Date("2026-07-10T12:00:00.000Z"),
    );
  });
});
