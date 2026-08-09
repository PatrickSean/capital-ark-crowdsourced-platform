import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260809213000_minimize_outbound_audit_data/migration.sql",
  ),
  "utf8",
);

describe("privacy-minimization migration", () => {
  it("drops sensitive telemetry while preserving aggregate attribution fields", () => {
    for (const column of [
      "pledge_id",
      "user_id",
      "generated_url",
      "referrer",
      "ip_hash",
    ]) {
      expect(migration).toContain(`DROP COLUMN "${column}"`);
    }
    expect(migration).toContain('DROP COLUMN "user_agent"');

    for (const column of [
      "target_id",
      "platform",
      "tracking_tag",
      "amount_cents",
      "created_at",
    ]) {
      expect(migration).not.toContain(`DROP COLUMN "${column}"`);
    }
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
  });

  it("removes legacy policy dependencies before dropping identity columns", () => {
    const userPolicy = migration.indexOf(
      'DROP POLICY IF EXISTS "users log their own click events"',
    );
    const adminPolicy = migration.indexOf(
      'DROP POLICY IF EXISTS "admins read click events"',
    );
    const identityColumn = migration.indexOf('DROP COLUMN "user_id"');

    expect(userPolicy).toBeGreaterThanOrEqual(0);
    expect(adminPolicy).toBeGreaterThanOrEqual(0);
    expect(identityColumn).toBeGreaterThan(userPolicy);
    expect(identityColumn).toBeGreaterThan(adminPolicy);
    expect(migration).not.toMatch(/DROP\s+POLICY[\s\S]+CASCADE/i);
  });

  it("immediately clears network hashes older than the retention window", () => {
    expect(migration).toMatch(
      /UPDATE "pledges"[\s\S]+SET "ip_hash" = NULL[\s\S]+INTERVAL '30 days'/,
    );
  });
});
