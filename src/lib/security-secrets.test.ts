import { describe, expect, it } from "vitest";
import {
  INSECURE_DEVELOPMENT_IP_HASH_SALT,
  isUsableProductionIpHashSalt,
} from "./security-secrets";

describe("production IP hash and session secret", () => {
  it("accepts a stable high-entropy-sized secret", () => {
    expect(isUsableProductionIpHashSalt("a".repeat(32))).toBe(true);
  });

  it("rejects missing, short and documented development values", () => {
    expect(isUsableProductionIpHashSalt(undefined)).toBe(false);
    expect(isUsableProductionIpHashSalt("too-short")).toBe(false);
    expect(isUsableProductionIpHashSalt(" ".repeat(32))).toBe(false);
    expect(
      isUsableProductionIpHashSalt(INSECURE_DEVELOPMENT_IP_HASH_SALT),
    ).toBe(false);
  });
});
