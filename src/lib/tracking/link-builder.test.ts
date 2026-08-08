import { describe, expect, it } from "vitest";
import { Platform } from "@/generated/prisma/enums";
import {
  buildContributionLink,
  buildTrackingTag,
  derivePrefix,
  detectPlatform,
  MAX_TAG_LENGTH,
  sanitizeTrackingTag,
} from "./link-builder";

const params = (url: string) => new URL(url).searchParams;

describe("detectPlatform", () => {
  it("maps each processor's hosts to its platform", () => {
    expect(detectPlatform("https://secure.winred.com/team/donate")).toBe(Platform.WINRED);
    expect(detectPlatform("https://secure.actblue.com/donate/form")).toBe(Platform.ACTBLUE);
    expect(detectPlatform("https://secure.anedot.com/org/donate")).toBe(Platform.ANEDOT);
  });

  it("accepts a pasted URL with no scheme", () => {
    expect(detectPlatform("secure.winred.com/team/donate")).toBe(Platform.WINRED);
  });

  it("returns null for unknown or malformed hosts", () => {
    expect(detectPlatform("https://example.com/donate")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
    expect(detectPlatform("")).toBeNull();
  });

  it("does not match a lookalike domain that merely contains the brand", () => {
    // "winred.com.evil.test" must not be treated as WinRed.
    expect(detectPlatform("https://winred.com.evil.test/donate")).toBeNull();
    expect(detectPlatform("https://notwinred.com/donate")).toBeNull();
  });
});

describe("sanitizeTrackingTag", () => {
  it("uppercases and replaces unsupported characters", () => {
    expect(sanitizeTrackingTag("nc small business!")).toBe("NC-SMALL-BUSINESS");
  });

  it("collapses runs of separators and trims the edges", () => {
    expect(sanitizeTrackingTag("--a///b--")).toBe("A-B");
  });

  it("caps length and never ends on a separator", () => {
    const tag = sanitizeTrackingTag("A".repeat(80));
    expect(tag).toHaveLength(MAX_TAG_LENGTH);

    const truncated = sanitizeTrackingTag(`${"B".repeat(39)} tail`);
    expect(truncated.length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
    expect(truncated.endsWith("-")).toBe(false);
  });
});

describe("derivePrefix", () => {
  it("turns a multi-word coalition name into an acronym", () => {
    expect(derivePrefix("NC Small Business Coalition")).toBe("NCSBC");
  });

  it("keeps a single-word name intact", () => {
    expect(derivePrefix("Mainstreet")).toBe("MAINSTREET");
  });

  it("falls back rather than returning an empty prefix", () => {
    expect(derivePrefix("!!!")).toBe("COALITION");
    expect(derivePrefix("")).toBe("COALITION");
  });
});

describe("buildTrackingTag", () => {
  it("combines prefix, target and user into a stable tag", () => {
    const tag = buildTrackingTag({
      prefix: "NCSBC",
      targetId: "00000000-0000-4000-8000-000000000030",
      userId: "00000000-0000-4000-8000-000000000002",
    });
    expect(tag).toBe("NCSBC-000030-000002");
  });

  it("omits the user segment for an unidentified pledger", () => {
    const tag = buildTrackingTag({
      prefix: "NCSBC",
      targetId: "00000000-0000-4000-8000-000000000030",
    });
    expect(tag).toBe("NCSBC-000030");
  });

  it("emits only the prefix in flat mode", () => {
    const tag = buildTrackingTag({
      prefix: "Hemp",
      targetId: "00000000-0000-4000-8000-000000000030",
      userId: "00000000-0000-4000-8000-000000000002",
      flat: true,
    });
    expect(tag).toBe("HEMP");
  });

  it("keeps a flat tag stable across targets and users", () => {
    const a = buildTrackingTag({
      prefix: "HEMP",
      targetId: "00000000-0000-4000-8000-000000000320",
      userId: "00000000-0000-4000-8000-000000000002",
      flat: true,
    });
    const b = buildTrackingTag({
      prefix: "HEMP",
      targetId: "00000000-0000-4000-8000-000000000329",
      userId: "00000000-0000-4000-8000-000000000009",
      flat: true,
    });
    expect(a).toBe(b);
  });

  it("still sanitizes a flat tag", () => {
    expect(
      buildTrackingTag({ prefix: "nc hemp!", targetId: "x", flat: true }),
    ).toBe("NC-HEMP");
  });

  it("stays within the processor length budget for long prefixes", () => {
    const tag = buildTrackingTag({
      prefix: "A".repeat(60),
      targetId: "00000000-0000-4000-8000-000000000030",
      userId: "00000000-0000-4000-8000-000000000002",
    });
    expect(tag.length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
  });
});

describe("buildContributionLink — per-processor parameters", () => {
  it("uses sc and amount for WinRed", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate",
      platform: Platform.WINRED,
      trackingTag: "NCSBC-000030",
      amountCents: 5000,
      prefill: { employer: "Acme Co", occupation: "Owner", zip: "27601" },
    });

    const p = params(url);
    expect(p.get("sc")).toBe("NCSBC-000030");
    expect(p.get("amount")).toBe("50");
    expect(p.get("employer_name")).toBe("Acme Co");
    expect(p.get("occupation")).toBe("Owner");
    expect(p.get("zip")).toBe("27601");
  });

  it("uses refcode for ActBlue", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.actblue.com/donate/form",
      platform: Platform.ACTBLUE,
      trackingTag: "NCSBC-000031",
      amountCents: 2500,
      prefill: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });

    const p = params(url);
    expect(p.get("refcode")).toBe("NCSBC-000031");
    expect(p.get("amount")).toBe("25");
    expect(p.get("firstname")).toBe("Ada");
    expect(p.get("lastname")).toBe("Lovelace");
  });

  it("uses source_code and preset amounts for Anedot", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.anedot.com/org/donate",
      platform: Platform.ANEDOT,
      trackingTag: "NCSBC-000032",
      amountCents: 10000,
      suggestedAmounts: [2500, 5000, 10000],
    });

    const p = params(url);
    expect(p.get("source_code")).toBe("NCSBC-000032");
    expect(p.get("amount")).toBe("100");
    expect(p.get("amounts")).toBe("25,50,100");
  });

  it("preserves the candidate's existing path and safe query params", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate?utm_source=newsletter",
      platform: Platform.WINRED,
      trackingTag: "TAG",
    });

    expect(new URL(url).pathname).toBe("/team/donate");
    expect(params(url).get("utm_source")).toBe("newsletter");
  });

  it("formats fractional amounts without trailing zeros", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate",
      platform: Platform.WINRED,
      trackingTag: "TAG",
      amountCents: 250,
    });
    expect(params(url).get("amount")).toBe("2.5");
  });

  it("omits the amount entirely when none is chosen", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate",
      platform: Platform.WINRED,
      trackingTag: "TAG",
      amountCents: null,
    });
    expect(params(url).has("amount")).toBe(false);
  });
});

describe("buildContributionLink — auto-charge safety", () => {
  it("strips WinRed one-click from an organizer-supplied URL", () => {
    const result = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate?oc=true&amount=500",
      platform: Platform.WINRED,
      trackingTag: "TAG",
      amountCents: 5000,
    });

    expect(params(result.url).has("oc")).toBe(false);
    expect(result.strippedParams).toContain("oc");
  });

  it("strips ActBlue express lane from an organizer-supplied URL", () => {
    const result = buildContributionLink({
      donationUrl: "https://secure.actblue.com/donate/form?express_lane=true",
      platform: Platform.ACTBLUE,
      trackingTag: "TAG",
    });

    expect(params(result.url).has("express_lane")).toBe(false);
    expect(result.strippedParams).toContain("express_lane");
  });

  it("strips recurring enrollment", () => {
    const result = buildContributionLink({
      donationUrl: "https://secure.anedot.com/org/donate?recurring=1",
      platform: Platform.ANEDOT,
      trackingTag: "TAG",
    });

    expect(params(result.url).has("recurring")).toBe(false);
  });

  it("strips forbidden params regardless of casing", () => {
    const result = buildContributionLink({
      donationUrl: "https://secure.winred.com/team/donate?OC=true&Express_Lane=true",
      platform: Platform.WINRED,
      trackingTag: "TAG",
    });

    const p = params(result.url);
    expect(p.has("OC")).toBe(false);
    expect(p.has("Express_Lane")).toBe(false);
    expect(result.strippedParams).toHaveLength(2);
  });
});

describe("buildContributionLink — input validation", () => {
  it("rejects non-https donation URLs", () => {
    expect(() =>
      buildContributionLink({
        donationUrl: "http://secure.winred.com/team/donate",
        platform: Platform.WINRED,
        trackingTag: "TAG",
      }),
    ).toThrow(/https/i);
  });

  it("rejects a URL that cannot be parsed", () => {
    expect(() =>
      buildContributionLink({
        donationUrl: "::::",
        platform: Platform.WINRED,
        trackingTag: "TAG",
      }),
    ).toThrow();
  });

  it("percent-encodes prefill values rather than breaking the query string", () => {
    const { url } = buildContributionLink({
      donationUrl: "https://secure.anedot.com/org/donate",
      platform: Platform.ANEDOT,
      trackingTag: "TAG",
      prefill: { employer: "Smith & Sons, LLC" },
    });

    expect(url).toContain("employer=Smith+%26+Sons%2C+LLC");
    expect(params(url).get("employer")).toBe("Smith & Sons, LLC");
  });
});
