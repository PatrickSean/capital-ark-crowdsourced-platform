import { describe, expect, it, vi } from "vitest";
import {
  ActivityType,
  CoalitionVerificationStatus,
  ContributionEvidenceType,
  Jurisdiction,
  Party,
  Platform,
} from "@/generated/prisma/enums";
import { getPublicEmbedDriveSnapshot } from "@/lib/embed-drive";

vi.mock("server-only", () => ({}));

describe("getPublicEmbedDriveSnapshot", () => {
  it("returns an explicit public allowlist and receipt-backed aggregates", async () => {
    const coalition = {
      id: "private-coalition-row-id",
      slug: "nc-hemp-industry",
      name: "North Carolina Hemp Industry",
      description: "A description not included in the minimal embed DTO.",
      logoUrl: "https://private-assets.example/logo.png",
      trackingPrefix: "SECRET-TRACKING-PREFIX",
      flatTrackingTag: true,
      requireSignIn: false,
      verificationStatus: CoalitionVerificationStatus.PLATFORM_VERIFIED,
      reviewedAt: "2026-08-09T12:00:00.000Z",
      memberCount: 42,
    };
    const targets = [
      target({
        id: "private-target-one",
        slug: "candidate-one",
        status: "ACTIVE",
        goalCents: 100_000,
        raisedCents: 25_000,
        donorCount: 2,
      }),
      target({
        id: "private-target-two",
        slug: "candidate-two",
        status: "CLOSED",
        goalCents: 50_000,
        raisedCents: 50_000,
        donorCount: 3,
      }),
    ];
    const activity = [
      {
        id: "activity-1",
        type: ActivityType.PLEDGE_CONFIRMED,
        evidenceType: ContributionEvidenceType.RECEIPT_AI_CHECKED,
        amountCents: 25_000,
        message: "Organizer-entered text that may contain private details",
        createdAt: "2026-08-09T12:30:00.000Z",
        targetTitle: "Support Candidate One",
        targetSlug: "candidate-one",
        candidateName: "Candidate One",
        actorLabel: "Private Person",
        receiptUrl: "https://private-assets.example/receipt.png",
        userId: "private-user-id",
      },
    ];
    const store = {
      getCoalitionBySlug: vi.fn().mockResolvedValue(coalition),
      listTargetsForCoalition: vi.fn().mockResolvedValue(targets),
      listActivity: vi.fn().mockResolvedValue(activity),
    };

    const snapshot = await getPublicEmbedDriveSnapshot(
      store,
      "nc-hemp-industry",
    );

    expect(snapshot).toEqual({
      coalition: {
        slug: "nc-hemp-industry",
        name: "North Carolina Hemp Industry",
        verificationStatus: CoalitionVerificationStatus.PLATFORM_VERIFIED,
      },
      progress: {
        goalCents: 150_000,
        confirmedCents: 75_000,
        percent: 50,
        activeTargetCount: 1,
      },
      targets: [
        publicTarget({
          slug: "candidate-one",
          raisedCents: 25_000,
          donorCount: 2,
          percent: 25,
        }),
        publicTarget({
          slug: "candidate-two",
          raisedCents: 50_000,
          donorCount: 3,
          percent: 100,
        }),
      ],
      activity: [
        {
          type: ActivityType.PLEDGE_CONFIRMED,
          amountCents: 25_000,
          createdAt: "2026-08-09",
          targetTitle: "Support Candidate One",
          candidateName: "Candidate One",
        },
      ],
    });
    expect(store.listTargetsForCoalition).toHaveBeenCalledWith(coalition.id);
    expect(store.listActivity).toHaveBeenCalledWith(coalition.id, 2);

    const serialized = JSON.stringify(snapshot);
    for (const secret of [
      "private-coalition-row-id",
      "private-target-one",
      "SECRET-TRACKING-PREFIX",
      "private-assets.example",
      "secure.anedot.com",
      "Private Person",
      "private-user-id",
      "activity-1",
      "receipt.png",
      "Organizer-entered text",
      "Private target title not rendered",
      "2026-11-03T00:00:00.000Z",
      "2026-08-09T12:30:00.000Z",
      ContributionEvidenceType.RECEIPT_AI_CHECKED,
      "CLOSED",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("returns null without reading related rows when the drive is missing", async () => {
    const store = {
      getCoalitionBySlug: vi.fn().mockResolvedValue(null),
      listTargetsForCoalition: vi.fn(),
      listActivity: vi.fn(),
    };

    await expect(
      getPublicEmbedDriveSnapshot(store, "missing-drive"),
    ).resolves.toBeNull();
    expect(store.listTargetsForCoalition).not.toHaveBeenCalled();
    expect(store.listActivity).not.toHaveBeenCalled();
  });

  it("caps public rows at what the widget renders and removes event precision", async () => {
    const targets = Array.from({ length: 5 }, (_, index) =>
      target({
        id: `private-target-${index}`,
        slug: `candidate-${index}`,
        status: "ACTIVE",
        goalCents: 10_000,
        raisedCents: 1_000,
        donorCount: 1,
      }),
    );
    const activity = Array.from({ length: 3 }, (_, index) => ({
      id: `private-activity-${index}`,
      type: ActivityType.TARGET_CREATED,
      amountCents: null,
      createdAt: `2026-08-0${index + 1}T12:34:56.000Z`,
      targetTitle: `Target ${index}`,
      candidateName: `Candidate ${index}`,
    }));
    const store = {
      getCoalitionBySlug: vi.fn().mockResolvedValue({
        id: "private-coalition-id",
        slug: "five-candidates",
        name: "Five Candidates",
        verificationStatus: CoalitionVerificationStatus.COMMUNITY_UNVERIFIED,
      }),
      listTargetsForCoalition: vi.fn().mockResolvedValue(targets),
      listActivity: vi.fn().mockResolvedValue(activity),
    };

    const snapshot = await getPublicEmbedDriveSnapshot(
      store,
      "five-candidates",
    );

    expect(snapshot?.targets).toHaveLength(4);
    expect(snapshot?.progress.activeTargetCount).toBe(5);
    expect(snapshot?.activity).toHaveLength(2);
    expect(snapshot?.activity.map((item) => item.createdAt)).toEqual([
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("private-activity-");
  });
});

function target({
  id,
  slug,
  status,
  goalCents,
  raisedCents,
  donorCount,
}: {
  id: string;
  slug: string;
  status: string;
  goalCents: number;
  raisedCents: number;
  donorCount: number;
}) {
  return {
    id,
    slug,
    title: "Private target title not rendered",
    description: "Internal long-form target description",
    goalCents,
    deadline: "2026-11-03T00:00:00.000Z",
    suggestedAmounts: [2_500, 5_000],
    status,
    coalition: {
      id: "private-coalition-row-id",
      slug: "nc-hemp-industry",
      name: "North Carolina Hemp Industry",
      description: null,
      logoUrl: null,
      trackingPrefix: "SECRET-TRACKING-PREFIX",
      flatTrackingTag: true,
      requireSignIn: false,
      verificationStatus: CoalitionVerificationStatus.PLATFORM_VERIFIED,
      reviewedAt: null,
      memberCount: 42,
    },
    candidate: {
      id: `private-${slug}-candidate-id`,
      slug,
      fullName: "Candidate One",
      legalName: "Private Legal Name",
      party: Party.INDEPENDENT,
      office: "NC House",
      state: "NC",
      district: "District 1",
      bio: "Long candidate biography",
      photoUrl: "/candidates/candidate-one.webp",
      donationUrl: "https://secure.anedot.com/private/donate",
      platform: Platform.ANEDOT,
      websiteUrl: "https://campaign.example",
      officialProfileUrl: "https://government.example/profile",
      officialDataVerifiedAt: "2026-08-01T00:00:00.000Z",
      donationUrlVerifiedAt: "2026-08-01T00:00:00.000Z",
      jurisdiction: Jurisdiction.STATE,
      committeeName: "Private Committee Detail",
      ncsbeCommitteeId: "PRIVATE-NCSBE-ID",
      fecCandidateId: null,
      fecCommitteeId: null,
    },
    progress: {
      goalCents,
      confirmedCents: raisedCents,
      attestedCents: 9_999,
      pendingCents: 88_888,
      raisedCents,
      percent: goalCents > 0 ? (raisedCents / goalCents) * 100 : 0,
      donorCount,
      daysRemaining: 86,
    },
  };
}

function publicTarget({
  slug,
  raisedCents,
  donorCount,
  percent,
}: {
  slug: string;
  raisedCents: number;
  donorCount: number;
  percent: number;
}) {
  return {
    slug,
    candidate: {
      fullName: "Candidate One",
      party: Party.INDEPENDENT,
      office: "NC House",
      state: "NC",
      district: "District 1",
      photoUrl: "/candidates/candidate-one.webp",
    },
    progress: {
      confirmedCents: raisedCents,
      percent,
      donorCount,
    },
  };
}
