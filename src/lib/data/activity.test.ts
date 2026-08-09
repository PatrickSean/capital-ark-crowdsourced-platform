import { describe, expect, it } from "vitest";
import {
  ActivityType,
  ContributionEvidenceType,
} from "@/generated/prisma/enums";
import { demoStore } from "./demo-store";
import { IDS } from "./fixtures";
import {
  HEMP_LAUNCHED_AT,
  hempLaunchActivityIds,
  hempTargets,
} from "./campaigns/nc-hemp";

describe("public activity views", () => {
  it("returns target-scoped activity with actionable target links", async () => {
    const items = await demoStore.listActivityForTarget(
      IDS.targetWinRed,
      20,
    );

    expect(items).toHaveLength(2);
    expect(
      items.every((item) => item.targetSlug === "webb-senate-push"),
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item.evidenceType === ContributionEvidenceType.RECEIPT_ATTACHED,
      ),
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item.evidenceType === ContributionEvidenceType.SELF_REPORTED,
      ),
    ).toBe(false);
    expect(items.every((item) => !("actorLabel" in item))).toBe(true);
  });

  it("shows factual NC Hemp launch history without invented contributions", async () => {
    const firstTarget = hempTargets[0];
    const firstActivityId = hempLaunchActivityIds[0];
    expect(firstTarget).toBeDefined();
    expect(firstActivityId).toBeDefined();

    const items = await demoStore.listActivityForTarget(firstTarget!.id, 10);

    expect(items).toEqual([
      expect.objectContaining({
        id: firstActivityId,
        type: ActivityType.TARGET_CREATED,
        evidenceType: null,
        amountCents: null,
        createdAt: HEMP_LAUNCHED_AT.toISOString(),
        targetSlug: firstTarget!.slug,
      }),
    ]);
  });
});
