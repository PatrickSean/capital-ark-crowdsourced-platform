import { describe, expect, it } from "vitest";
import { buildReceiptObjectKey, isReceiptObjectKeyFor } from "./receipt-key";

const userId = "00000000-0000-4000-8000-000000000002";
const pledgeId = "00000000-0000-4000-8000-000000000401";

describe("receipt object keys", () => {
  it("builds the canonical owner- and pledge-scoped key", () => {
    expect(
      buildReceiptObjectKey({
        userId,
        pledgeId,
        contentType: "image/jpeg",
        timestamp: 1_786_275_974_455,
      }),
    ).toBe(
      "00000000-0000-4000-8000-000000000002/" +
        "00000000-0000-4000-8000-000000000401-1786275974455.jpg",
    );
  });

  it("accepts only a key issued for the same user and pledge", () => {
    const key = buildReceiptObjectKey({
      userId,
      pledgeId,
      contentType: "image/webp",
      timestamp: 1_786_275_974_455,
    });

    expect(isReceiptObjectKeyFor(key, userId, pledgeId)).toBe(true);
    expect(isReceiptObjectKeyFor(key, crypto.randomUUID(), pledgeId)).toBe(false);
    expect(isReceiptObjectKeyFor(key, userId, crypto.randomUUID())).toBe(false);
  });

  it("rejects traversal, nested paths, unsupported extensions, and loose timestamps", () => {
    const prefix = `${userId}/${pledgeId}-`;
    expect(isReceiptObjectKeyFor(`${userId}/../${pledgeId}-1786275974455.png`, userId, pledgeId)).toBe(false);
    expect(isReceiptObjectKeyFor(`${prefix}folder/1786275974455.png`, userId, pledgeId)).toBe(false);
    expect(isReceiptObjectKeyFor(`${prefix}1786275974455.svg`, userId, pledgeId)).toBe(false);
    expect(isReceiptObjectKeyFor(`${prefix}123.png`, userId, pledgeId)).toBe(false);
  });
});
