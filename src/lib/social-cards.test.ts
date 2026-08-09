import { stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hempTargets } from "@/lib/data/campaigns/nc-hemp";
import {
  coalitionSocialCardPath,
  homeSocialCardPath,
  openGraphImageDescriptor,
  targetSocialCardPath,
  truncateForSocial,
} from "@/lib/social-cards";

const publicAssetPath = (publicPath: string) =>
  join(process.cwd(), "public", publicPath.replace(/^\//, ""));

describe("social card routing", () => {
  it("uses versioned, campaign-specific cards for the verified NC slate", () => {
    expect(homeSocialCardPath()).toBe("/social/v1/capital-ark.png");
    expect(coalitionSocialCardPath("nc-hemp-industry")).toBe(
      "/social/v1/coalitions/nc-hemp-industry.png",
    );

    for (const target of hempTargets) {
      expect(targetSocialCardPath(target.slug)).toBe(
        `/social/v1/targets/${target.slug}.png`,
      );
    }
  });

  it("uses branded evergreen cards for future community-created drives", () => {
    expect(coalitionSocialCardPath("another-community")).toBe(
      "/social/v1/coalitions/default.png",
    );
    expect(targetSocialCardPath("another-candidate")).toBe(
      "/social/v1/targets/default.png",
    );
  });

  it("emits complete Open Graph image metadata", () => {
    expect(
      openGraphImageDescriptor(
        "https://capitalark.com/social/v1/capital-ark.png",
        "Capital Ark",
      ),
    ).toEqual({
      url: "https://capitalark.com/social/v1/capital-ark.png",
      width: 1200,
      height: 630,
      alt: "Capital Ark",
      type: "image/png",
    });
  });

  it("truncates social descriptions at a word boundary", () => {
    const source = "A community can coordinate support across many candidates while every contribution still goes to the official processor.";
    const result = truncateForSocial(source, 70);

    expect(result.length).toBeLessThanOrEqual(70);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("processor");
  });
});

describe("generated social card assets", () => {
  const cards = [
    homeSocialCardPath(),
    coalitionSocialCardPath("nc-hemp-industry"),
    coalitionSocialCardPath("community-fallback"),
    targetSocialCardPath("community-fallback"),
    ...hempTargets.map((target) => targetSocialCardPath(target.slug)),
  ];

  it.each(cards)("ships a compact 1200 × 630 PNG at %s", async (card) => {
    const filePath = publicAssetPath(card);
    const [metadata, file] = await Promise.all([
      sharp(filePath).metadata(),
      stat(filePath),
    ]);

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(file.size).toBeLessThan(600_000);
  });
});
