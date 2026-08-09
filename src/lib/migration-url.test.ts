import { describe, expect, it } from "vitest";
import { resolveMigrationUrl } from "./migration-url";

describe("resolveMigrationUrl", () => {
  it("prefers a nonblank direct connection", () => {
    expect(
      resolveMigrationUrl(
        "postgresql://direct/database",
        "postgresql://pooled/database",
      ),
    ).toBe("postgresql://direct/database");
  });

  it("falls back when DIRECT_URL is missing or blank", () => {
    expect(resolveMigrationUrl(undefined, "postgresql://runtime/database"))
      .toBe("postgresql://runtime/database");
    expect(resolveMigrationUrl("  ", "postgresql://runtime/database")).toBe(
      "postgresql://runtime/database",
    );
  });
});

