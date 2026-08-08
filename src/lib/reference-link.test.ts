import { describe, expect, it } from "vitest";
import { describeReferenceLink } from "./reference-link";

describe("describeReferenceLink", () => {
  it("identifies the NCSBE committee search as a records lookup", () => {
    const link = describeReferenceLink("https://cf.ncsbe.gov/CFOrgLkup/");
    expect(link.kind).toBe("state-lookup");
    expect(link.label).toMatch(/State Board of Elections/i);
    // The whole point of the distinct label: nobody should read this as a
    // place to give money.
    expect(link.hint).toMatch(/not a donation page/i);
  });

  it("treats a committee's own site as a campaign site", () => {
    for (const url of [
      "https://www.destinhall.org/",
      "https://www.votedavidwillis.com/contact-david/",
      "https://www.joshstein.org/",
    ]) {
      expect(describeReferenceLink(url).kind).toBe("campaign-site");
    }
  });

  it("ignores path and casing when matching the lookup host", () => {
    expect(describeReferenceLink("https://CF.NCSBE.GOV/CFOrgLkup/?x=1").kind).toBe(
      "state-lookup",
    );
  });

  it("does not match a lookalike host", () => {
    expect(describeReferenceLink("https://cf.ncsbe.gov.evil.test/").kind).toBe(
      "campaign-site",
    );
  });

  it("falls back rather than throwing on an unparseable URL", () => {
    expect(describeReferenceLink("not a url").kind).toBe("campaign-site");
  });
});
