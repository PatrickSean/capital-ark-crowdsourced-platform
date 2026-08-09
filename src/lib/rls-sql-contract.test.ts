import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(process.cwd(), "prisma", "sql", "rls.sql"),
  "utf8",
);
const NORMALIZED = SQL.replace(/\s+/g, " ");

describe("optional Supabase RLS contract", () => {
  it("exposes only the intended read policies and no client write policy", () => {
    const createdPolicies = [...SQL.matchAll(/create policy "([^"]+)"/gi)]
      .map((match) => match[1])
      .sort();
    expect(createdPolicies).toEqual(
      [
        "candidates_select_for_public_targets",
        "coalitions_select_public",
        "targets_select_public",
        "users_select_own",
      ].sort(),
    );
    expect(NORMALIZED).not.toMatch(
      /create policy [^;]+ for (?:insert|update|delete|all)\b/i,
    );
    expect(NORMALIZED).not.toMatch(
      /grant (?:insert|update|delete|truncate|references|trigger|all)\b/i,
    );

    const grantedRelations = [
      ...SQL.matchAll(
        /grant select(?:\s*\([^;]+\))?\s+on public\.([a-z_]+)/gis,
      ),
    ]
      .map((match) => match[1])
      .sort();
    expect(grantedRelations).toEqual(
      [
        "candidates",
        "coalitions",
        "fundraising_targets",
        "target_progress",
        "users",
      ].sort(),
    );

    const revokeSection = NORMALIZED.slice(
      NORMALIZED.indexOf("revoke all privileges on table"),
      NORMALIZED.indexOf("-- users"),
    );
    for (const baseTable of [
      "users",
      "coalitions",
      "coalition_members",
      "candidates",
      "fundraising_targets",
      "pledges",
      "link_click_events",
      "activity_events",
    ]) {
      expect(revokeSection).toContain(`public.${baseTable}`);
    }
    expect(revokeSection).toContain("from public;");
    expect(revokeSection).toContain("from anon, authenticated;");

    for (const privateTable of [
      "coalition_members",
      "pledges",
      "link_click_events",
      "activity_events",
    ]) {
      expect(NORMALIZED).toContain(`public.${privateTable}`);
      expect(NORMALIZED).not.toMatch(
        new RegExp(`grant select(?: \\([^;]+\\))? on public\\.${privateTable}\\b`, "i"),
      );
    }
  });

  it("drops every shipped legacy policy before rebuilding access", () => {
    for (const policy of [
      "users read own row",
      "users update own row",
      "public coalitions are world readable",
      "permanent users create coalitions",
      "admins update their coalition",
      "members read their own membership rows",
      "admins manage membership",
      "candidates are world readable",
      "permanent users add candidates",
      "targets of public coalitions are world readable",
      "admins manage targets",
      "pledgers read their own pledges",
      "users create their own pledges",
      "pledgers update their own pledges",
      "admins read click events",
      "users log their own click events",
      "activity of public coalitions is world readable",
      "users upload their own receipts",
      "users read their own receipts",
    ]) {
      expect(NORMALIZED).toContain(`drop policy if exists "${policy}"`);
    }

    for (const policy of [
      "users_select_own",
      "coalitions_select_public",
      "targets_select_public",
      "candidates_select_for_public_targets",
    ]) {
      expect(NORMALIZED).toContain(`drop policy if exists "${policy}"`);
    }
  });

  it("publishes only receipt-backed progress for active public targets", () => {
    const viewSql = SQL.slice(
      SQL.indexOf("create view public.target_progress"),
      SQL.indexOf(
        "revoke all privileges on public.target_progress",
        SQL.indexOf("create view public.target_progress"),
      ),
    ).replace(/\s+/g, " ");

    expect(viewSql).toContain("with (security_invoker = off)");
    expect(viewSql).toContain(
      "coalesce(p.confirmed_amount_cents, p.amount_cents)",
    );
    expect(viewSql).toContain("p.status = 'COMPLETED'");
    expect(viewSql).toContain(
      "p.evidence_type in ('RECEIPT_ATTACHED', 'RECEIPT_AI_CHECKED')",
    );
    expect(viewSql).toContain("0::bigint as attested_cents");
    expect(viewSql).toContain("interval '72 hours'");
    expect(viewSql).toContain("as raised_cents");
    expect(viewSql).toContain("count(distinct p.user_id)");
    expect(viewSql).toContain("join public.coalitions c");
    expect(viewSql).toContain("c.is_public = true");
    expect(viewSql).toContain("where t.status = 'ACTIVE'");
    expect(viewSql).not.toContain("UNVERIFIED");
  });

  it("retires raw receipt storage without deleting existing objects", () => {
    expect(NORMALIZED).not.toContain("insert into storage.buckets");
    expect(NORMALIZED).not.toContain("delete from storage.objects");
    expect(NORMALIZED).not.toContain("delete from storage.buckets");
    expect(NORMALIZED).not.toMatch(
      /create policy [^;]+ on storage\.objects/i,
    );
    expect(NORMALIZED).toContain(
      'drop policy if exists "users upload their own receipts" on storage.objects',
    );
    expect(NORMALIZED).toContain(
      'drop policy if exists "users read their own receipts" on storage.objects',
    );
  });
});
