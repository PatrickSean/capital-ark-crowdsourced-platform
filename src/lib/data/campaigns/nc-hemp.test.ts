import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import {
  hempCandidates,
  hempCoalition,
  hempLaunchActivityDates,
  hempLaunchActivityIds,
  hempOrganizer,
  hempTargets,
} from "./nc-hemp";
import {
  getNcHempCandidatePhotoSource,
  NC_HEMP_CANDIDATE_PHOTOS,
} from "./nc-hemp-photo-sources";

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
  ["Diane Wheatley", "House District 43", Party.REPUBLICAN, 6_800],
  ["Ben T. Moss, Jr.", "House District 52", Party.REPUBLICAN, 6_800],
  ["Jonathan L. Almond", "House District 73", Party.REPUBLICAN, 6_800],
  ["Brian Echevarria", "House District 82", Party.REPUBLICAN, 6_800],
  ["Erin Paré", "House District 37", Party.REPUBLICAN, 6_800],
  ["John M. Blust", "House District 62", Party.REPUBLICAN, 6_800],
  ["Joe Pike", "House District 6", Party.REPUBLICAN, 6_800],
  ["John L. Lowery", "House District 47", Party.REPUBLICAN, 6_800],
] as const;

describe("verified NC Hemp fundraising slate", () => {
  it("contains the eighteen approved targets and totals $694,400", () => {
    expect(hempCandidates).toHaveLength(expected.length);
    expect(hempTargets).toHaveLength(expected.length);
    expect(hempTargets.reduce((sum, target) => sum + target.goalCents, 0)).toBe(
      694_400 * 100,
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
    expect(hempLaunchActivityDates).toHaveLength(hempTargets.length);
    expect(hempLaunchActivityDates.slice(0, 10)).toEqual(
      Array(10).fill(new Date("2026-08-08T00:00:00.000Z")),
    );
    expect(hempLaunchActivityDates.slice(10)).toEqual(
      Array(8).fill(new Date("2026-08-10T00:00:00.000Z")),
    );
  });

  it("ships a locally optimized portrait with source provenance for every candidate", () => {
    expect(Object.keys(NC_HEMP_CANDIDATE_PHOTOS)).toHaveLength(
      hempCandidates.length,
    );

    for (const candidate of hempCandidates) {
      const source = getNcHempCandidatePhotoSource(candidate.fullName);

      expect(source).not.toBeNull();
      if (!source) {
        throw new Error(`Missing portrait source for ${candidate.fullName}`);
      }

      expect(candidate.photoUrl).toBe(source.assetPath);
      expect(source.sourcePageUrl).toMatch(/^https:\/\//);
      expect(source.licenseUrl).toMatch(/^https:\/\//);
      expect(source.credit.length).toBeGreaterThan(0);
      expect(
        existsSync(
          path.join(process.cwd(), "public", source.assetPath.slice(1)),
        ),
      ).toBe(true);
    }

    expect(
      new Set(hempCandidates.map((candidate) => candidate.photoUrl)).size,
    ).toBe(hempCandidates.length);
  });

  it("stores current committee and government identifiers", () => {
    const stateCandidates = hempCandidates.filter(
      (candidate) => candidate.jurisdiction === Jurisdiction.STATE,
    );
    const timMoore = hempCandidates.find(
      (candidate) => candidate.fullName === "Tim Moore",
    );

    expect(stateCandidates).toHaveLength(17);
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

  it("uses unique live processor links where available and no placeholder organizer email", () => {
    const linkedCandidates = hempCandidates.filter(
      (candidate) => candidate.donationUrl,
    );
    const urls = linkedCandidates.map((candidate) => candidate.donationUrl!);
    const expandedNames = new Set<string>(
      expected.slice(10).map(([name]) => name),
    );
    const allowedHosts = new Set([
      "secure.actblue.com",
      "secure.anedot.com",
      "secure.winred.com",
    ]);

    expect(hempOrganizer.email).toBeNull();
    expect(linkedCandidates).toHaveLength(16);
    expect(new Set(urls).size).toBe(linkedCandidates.length);
    for (const candidate of hempCandidates) {
      if (candidate.donationUrl) {
        expect(allowedHosts.has(new URL(candidate.donationUrl).hostname)).toBe(
          true,
        );
        expect(candidate.donationUrlVerifiedAt?.toISOString()).toBe(
          expandedNames.has(candidate.fullName)
            ? "2026-08-10T00:00:00.000Z"
            : "2026-08-08T00:00:00.000Z",
        );
      } else {
        expect(candidate.donationUrlVerifiedAt).toBeNull();
        expect(candidate.platform).toBeNull();
      }
      expect(candidate.officialProfileUrl).toMatch(/^https:\/\//);
      expect(candidate.officialDataVerifiedAt?.toISOString()).toBe(
        expandedNames.has(candidate.fullName)
          ? "2026-08-10T00:00:00.000Z"
          : "2026-08-08T00:00:00.000Z",
      );
    }

    expect(
      hempCandidates
        .filter((candidate) => !candidate.donationUrl)
        .map((candidate) => candidate.fullName),
    ).toEqual(["Joe Pike", "John L. Lowery"]);
  });
});
