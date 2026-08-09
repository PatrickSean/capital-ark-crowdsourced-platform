import { describe, expect, it } from "vitest";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import {
  createCoalitionRequestSchema,
  normalizeDonationUrl,
} from "./coalition-creation";

const target = (index = 1) => ({
  candidateName: `Candidate ${index}`,
  office: `NC House District ${index}`,
  party: Party.INDEPENDENT,
  state: "nc",
  jurisdiction: Jurisdiction.STATE,
  donationUrl: `secure.anedot.com/candidate-${index}/donate`,
  goalCents: 100_000,
  deadline: null,
  suggestedAmounts: [2_500, 5_000, 10_000],
});

const request = (targets: unknown[] = [target()]) => ({
  coalitionName: "Community Coalition",
  description: null,
  organizerAttested: true as const,
  targets,
});

describe("createCoalitionRequestSchema", () => {
  it("accepts one through twenty targets and normalizes state and URLs", () => {
    const one = createCoalitionRequestSchema.parse(request());
    expect(one.targets).toHaveLength(1);
    expect(one.targets[0]?.state).toBe("NC");
    expect(one.targets[0]?.donationUrl).toBe(
      "https://secure.anedot.com/candidate-1/donate",
    );

    const twenty = createCoalitionRequestSchema.parse(
      request(Array.from({ length: 20 }, (_, index) => target(index + 1))),
    );
    expect(twenty.targets).toHaveLength(20);
  });

  it("rejects an empty drive and more than twenty targets", () => {
    expect(createCoalitionRequestSchema.safeParse(request([])).success).toBe(
      false,
    );
    expect(
      createCoalitionRequestSchema.safeParse(
        request(Array.from({ length: 21 }, (_, index) => target(index + 1))),
      ).success,
    ).toBe(false);
  });

  it("rejects goals that cannot fit in the database integer column", () => {
    expect(
      createCoalitionRequestSchema.safeParse(
        request([{ ...target(), goalCents: 2_147_483_648 }]),
      ).success,
    ).toBe(false);
  });

  it("requires an explicit organizer attestation", () => {
    const missing = { ...request() } as Record<string, unknown>;
    delete missing.organizerAttested;

    expect(createCoalitionRequestSchema.safeParse(missing).success).toBe(false);
    expect(
      createCoalitionRequestSchema.safeParse({
        ...request(),
        organizerAttested: false,
      }).success,
    ).toBe(false);
  });

  it("requires an explicit state and jurisdiction for every target", () => {
    const withoutState = { ...target(), state: undefined };
    const withoutJurisdiction = { ...target(), jurisdiction: undefined };

    expect(
      createCoalitionRequestSchema.safeParse(request([withoutState])).success,
    ).toBe(false);
    expect(
      createCoalitionRequestSchema.safeParse(request([withoutJurisdiction]))
        .success,
    ).toBe(false);
  });

  it("rejects duplicate candidate-office entries", () => {
    expect(
      createCoalitionRequestSchema.safeParse(request([target(), target()]))
        .success,
    ).toBe(false);
  });

  it("rejects duplicate normalized donation pages across targets", () => {
    const second = {
      ...target(2),
      donationUrl: "https://secure.anedot.com/candidate-1/donate#different",
    };
    expect(
      createCoalitionRequestSchema.safeParse(request([target(), second]))
        .success,
    ).toBe(false);
  });

  it("keeps the legacy single-target adapter behind the same attestation", () => {
    const legacy = createCoalitionRequestSchema.parse({
      coalitionName: "Legacy Coalition",
      organizerAttested: true,
      ...target(),
    });
    expect(legacy.targets).toHaveLength(1);

    expect(
      createCoalitionRequestSchema.safeParse({
        coalitionName: "Legacy Coalition",
        ...target(),
      }).success,
    ).toBe(false);
  });
});

describe("normalizeDonationUrl", () => {
  it("strips charge, tracking, prefill parameters and fragments", () => {
    const url = normalizeDonationUrl(
      "secure.actblue.com/donate/example?amount=25&EXPRESS_LANE=true&recurring=1&email=donor%40example.com&firstname=Pat&refcode=other&form=main#section",
    );
    const parsed = new URL(url);

    expect(parsed.searchParams.has("amount")).toBe(false);
    expect(parsed.searchParams.has("EXPRESS_LANE")).toBe(false);
    expect(parsed.searchParams.has("recurring")).toBe(false);
    expect(parsed.searchParams.has("email")).toBe(false);
    expect(parsed.searchParams.has("firstname")).toBe(false);
    expect(parsed.searchParams.has("refcode")).toBe(false);
    expect(parsed.searchParams.get("form")).toBe("main");
    expect(parsed.hash).toBe("");
  });

  it.each([
    "http://secure.winred.com/example/donate",
    "https://winred.com.evil.test/example/donate",
    "https://user:pass@secure.anedot.com/example/donate",
    "https://secure.actblue.com:8443/donate/example",
  ])("rejects unsafe or unsupported processor URL %s", (url) => {
    expect(() => normalizeDonationUrl(url)).toThrow();
  });
});
