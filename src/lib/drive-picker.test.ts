import { describe, expect, it } from "vitest";
import {
  DRIVE_PICKER_RESULT_LIMIT,
  buildDriveSearchIndex,
  normalizeDriveSearchText,
  searchDriveCatalog,
} from "./drive-picker";

function drive(number: number, name = `Community Drive ${number}`) {
  return {
    name,
    slug: `community-drive-${number}`,
    targetCount: (number % 12) + 1,
  };
}

describe("drive picker search", () => {
  it("caps a large unfiltered catalog while keeping the selection first", () => {
    const drives = Array.from({ length: 501 }, (_, index) => drive(index + 1));
    const result = searchDriveCatalog(
      buildDriveSearchIndex(drives),
      "",
      "community-drive-501",
    );

    expect(result.totalMatches).toBe(501);
    expect(result.items).toHaveLength(DRIVE_PICKER_RESULT_LIMIT);
    expect(result.items[0]?.slug).toBe("community-drive-501");
  });

  it("finds a drive beyond the initial result window", () => {
    const drives = Array.from({ length: 501 }, (_, index) => drive(index + 1));
    const result = searchDriveCatalog(
      buildDriveSearchIndex(drives),
      "Drive 500",
      "community-drive-1",
    );

    expect(result.totalMatches).toBe(1);
    expect(result.items[0]?.slug).toBe("community-drive-500");
  });

  it("matches case, punctuation, whitespace, diacritics, and slugs", () => {
    const drives = [
      drive(1, "Caf\u00e9 Owners & Neighbors"),
      drive(2, "North Carolina Hemp Community"),
    ];
    const index = buildDriveSearchIndex(drives);

    expect(searchDriveCatalog(index, "  CAFE owners  ", "", 10).items[0]?.slug)
      .toBe("community-drive-1");
    expect(searchDriveCatalog(index, "north-carolina", "", 10).items[0]?.slug)
      .toBe("community-drive-2");
    expect(normalizeDriveSearchText("  NC: Hemp / Retail  ")).toBe(
      "nc hemp retail",
    );
  });

  it("ranks exact and prefix matches ahead of substring matches", () => {
    const drives = [
      drive(1, "Neighbors for Clean Water"),
      drive(2, "Clean Water"),
      drive(3, "Clean Water Business Alliance"),
    ];
    const result = searchDriveCatalog(
      buildDriveSearchIndex(drives),
      "clean water",
      "",
      10,
    );

    expect(result.items.map((item) => item.name)).toEqual([
      "Clean Water",
      "Clean Water Business Alliance",
      "Neighbors for Clean Water",
    ]);
  });

  it("returns a clean empty result", () => {
    const result = searchDriveCatalog(
      buildDriveSearchIndex([drive(1), drive(2)]),
      "no matching coalition",
      "",
    );

    expect(result).toEqual({ items: [], totalMatches: 0 });
  });
});
