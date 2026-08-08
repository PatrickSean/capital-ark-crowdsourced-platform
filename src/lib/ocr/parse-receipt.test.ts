import { describe, expect, it } from "vitest";
import { parseReceiptText } from "./parse-receipt";

describe("parseReceiptText", () => {
  it("finds the total on a typical WinRed receipt", () => {
    const result = parseReceiptText(`
      Thank you for your contribution!
      Webb for North Carolina
      Total charged: $50.00
      Date: 08/08/2026
    `);

    expect(result.amountCents).toBe(5000);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("prefers the labelled total over an unrelated figure", () => {
    const result = parseReceiptText(`
      Our goal is $25,000
      Your contribution: $75.00
    `);

    expect(result.amountCents).toBe(7500);
  });

  it("skips processing fees in favour of the contribution", () => {
    const result = parseReceiptText(`
      Contribution amount: $100.00
      Processing fee: $3.20
    `);

    expect(result.amountCents).toBe(10000);
  });

  it("handles thousands separators", () => {
    const result = parseReceiptText("Total: $1,250.00");
    expect(result.amountCents).toBe(125000);
  });

  it("ignores a lifetime total decoy", () => {
    const result = parseReceiptText(`
      Amount charged: $25.00
      Your giving to date: $940.00
    `);

    expect(result.amountCents).toBe(2500);
  });

  it("reports no amount rather than guessing when there is no money", () => {
    const result = parseReceiptText("Thanks for your support!");
    expect(result.amountCents).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("stays low-confidence when the text has no total-like label", () => {
    const result = parseReceiptText("$12.00 $88.00 $4.00");
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("discards implausibly large OCR artifacts", () => {
    const result = parseReceiptText("Total: $99,999,999.00");
    expect(result.amountCents).toBeNull();
  });
});
