import { describe, expect, it } from "vitest";
import {
  ATTESTATIONS,
  attestationVersionFor,
  contributionLimitFor,
  CURRENT_ATTESTATION_VERSION,
  getAttestation,
} from "./attestations";

describe("attestationVersionFor", () => {
  it("uses the North Carolina text for NC state races", () => {
    expect(attestationVersionFor({ jurisdiction: "STATE", state: "NC" })).toBe(
      "2026-01-nc-v1",
    );
    expect(attestationVersionFor({ jurisdiction: "STATE", state: "nc" })).toBe(
      "2026-01-nc-v1",
    );
  });

  it("uses the federal text for federal races, including in NC", () => {
    expect(attestationVersionFor({ jurisdiction: "FEDERAL", state: "NC" })).toBe(
      CURRENT_ATTESTATION_VERSION,
    );
  });

  it("falls back to the federal text for a state we have no wording for", () => {
    expect(attestationVersionFor({ jurisdiction: "STATE", state: "SC" })).toBe(
      CURRENT_ATTESTATION_VERSION,
    );
    expect(attestationVersionFor({ jurisdiction: "STATE" })).toBe(
      CURRENT_ATTESTATION_VERSION,
    );
  });
});

describe("North Carolina attestation content", () => {
  const nc = ATTESTATIONS["2026-01-nc-v1"];

  // NC bars every business entity, not just corporations, so the wording has
  // to name the forms a hemp business actually takes or it fails to warn.
  it("names LLCs and partnerships, not only corporations", () => {
    const text = nc.clauses.join(" ").toLowerCase();
    expect(text).toContain("llc");
    expect(text).toContain("partnership");
    expect(text).toContain("business entity");
  });

  it("covers the NC lobbyist prohibition and reimbursement", () => {
    const text = nc.clauses.join(" ").toLowerCase();
    expect(text).toContain("lobbyist");
    expect(text).toContain("reimbursed");
  });

  it("is resolvable by version, so a stored pledge can be replayed", () => {
    expect(getAttestation("2026-01-nc-v1").version).toBe("2026-01-nc-v1");
  });

  it("falls back to the current version for an unknown version string", () => {
    expect(getAttestation("does-not-exist").version).toBe(
      CURRENT_ATTESTATION_VERSION,
    );
  });
});

describe("contributionLimitFor", () => {
  it("returns the NC per-election limit for NC state races", () => {
    expect(
      contributionLimitFor({ jurisdiction: "STATE", state: "NC" })
        ?.perElectionCents,
    ).toBe(680_000);
  });

  it("returns the federal per-election limit for federal races", () => {
    expect(
      contributionLimitFor({ jurisdiction: "FEDERAL" })?.perElectionCents,
    ).toBe(350_000);
  });

  it("returns null rather than guessing for a state we have no figure for", () => {
    expect(contributionLimitFor({ jurisdiction: "STATE", state: "SC" })).toBeNull();
  });
});
