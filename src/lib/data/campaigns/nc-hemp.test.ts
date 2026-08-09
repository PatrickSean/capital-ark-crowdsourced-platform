import { describe, expect, it } from "vitest";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import {
  hempCandidates,
  hempCoalition,
  hempLaunchActivityIds,
  hempOrganizer,
  hempTargets,
} from "./nc-hemp";

const expected = [
  ["Destin Hall", "House District 87", Party.REPUBLICAN, 150_000],
  ["Brenden H. Jones", "House District 46", Party.REPUBLICAN, 100_000],
  ["David Willis", "House District 68", Party.REPUBLICAN, 10_000],
  ["Jeffrey C. McNeely", "House District 84", Party.REPUBLICAN, 50_000],
  ["Tricia Ann Cotham", "House District 105", Party.REPUBLICAN, 10_000],
  ["Allen Chesser", "House District 25", Party.REPUBLICAN, 10_000],
  ["Cody Huneycutt", "House District 67", Party.REPUBLICAN, 10_000],
  ["Robert T. Reives II", "House District 54", Party.DEMOCRAT, 50_000],
  ["Josh Stein", null, Party.DEMOCRAT, 100_000],
  ["Tim Moore", "NC-14", Party.REPUBLICAN, 150_000],
] as const;

describe("verified NC Hemp fundraising slate", () => {
  it("contains exactly the ten supplied targets and totals $640,000", () => {
    expect(hempCandidates).toHaveLength(expected.length);
    expect(hempTargets).toHaveLength(expected.length);
    expect(hempTargets.reduce((sum, target) => sum + target.goalCents, 0)).toBe(
      640_000 * 100,
    );

    expected.forEach(([name, district, party, goalDollars], index) => {
      expect(hempCandidates[index]).toMatchObject({
        fullName: name,
        district,
        party,
      });
      expect(hempTargets[index]?.goalCents).toBe(goalDollars * 100);
    });
  });

  it("welcomes consumers with accessible individual contribution defaults", () => {
    expect(hempCoalition.description).toMatch(/hemp consumers/i);
    for (const target of hempTargets) {
      expect(target.suggestedAmounts).toEqual([
        2_500,
        5_000,
        10_000,
        25_000,
      ]);
    }
  });

  it("reserves one stable launch-history event id for each target", () => {
    expect(hempLaunchActivityIds).toHaveLength(hempTargets.length);
    expect(new Set(hempLaunchActivityIds).size).toBe(hempTargets.length);
  });

  it("stores current committee and government identifiers", () => {
    const stateCandidates = hempCandidates.filter(
      (candidate) => candidate.jurisdiction === Jurisdiction.STATE,
    );
    const timMoore = hempCandidates.find(
      (candidate) => candidate.fullName === "Tim Moore",
    );

    expect(stateCandidates).toHaveLength(9);
    expect(
      stateCandidates.every((candidate) => candidate.ncsbeCommitteeId),
    ).toBe(true);
    expect(
      stateCandidates.find(
        (candidate) => candidate.fullName === "Tricia Ann Cotham",
      )?.ncsbeCommitteeId,
    ).toBe("STA-07985B-C-002");
    expect(timMoore).toMatchObject({
      legalName: "Timothy Keith Moore",
      district: "NC-14",
      fecCandidateId: "H4NC14015",
      fecCommitteeId: "C00856005",
      jurisdiction: Jurisdiction.FEDERAL,
    });
  });

  it("uses unique live processor links and no placeholder organizer email", () => {
    const urls = hempCandidates.map((candidate) => candidate.donationUrl);
    const allowedHosts = new Set([
      "secure.actblue.com",
      "secure.anedot.com",
      "secure.winred.com",
    ]);

    expect(hempOrganizer.email).toBeNull();
    expect(new Set(urls).size).toBe(hempCandidates.length);
    for (const candidate of hempCandidates) {
      expect(candidate.donationUrl).not.toBeNull();
      expect(allowedHosts.has(new URL(candidate.donationUrl!).hostname)).toBe(
        true,
      );
      expect(candidate.donationUrlVerifiedAt?.toISOString()).toBe(
        "2026-08-08T00:00:00.000Z",
      );
      expect(candidate.officialProfileUrl).toMatch(/^https:\/\//);
      expect(candidate.officialDataVerifiedAt?.toISOString()).toBe(
        "2026-08-08T00:00:00.000Z",
      );
    }
  });
});
