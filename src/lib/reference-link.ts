/**
 * Describes a non-donation link so the UI can label it for what it is.
 *
 * Coalitions assemble target lists from spreadsheets, and the "contribution
 * link" column in one is rarely a donation page. It is usually the committee's
 * homepage, and in North Carolina it is often the State Board of Elections
 * committee search. Those are different destinations and a single generic
 * "visit their site" label would mislead on both.
 */
export type ReferenceLinkKind = "state-lookup" | "campaign-site";

export interface ReferenceLink {
  kind: ReferenceLinkKind;
  /** Link text. */
  label: string;
  /** One line explaining what the user will find there. */
  hint: string;
}

export function describeReferenceLink(url: string): ReferenceLink {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Fall through to the campaign-site default; an unparseable URL is still
    // better surfaced than hidden.
  }

  // cf.ncsbe.gov is the NCSBE's campaign finance document search. It accepts no
  // contributions at all -- it is where you look up a committee's filings and
  // its registered treasurer, which is the practical way to track down who to
  // ask for a real donation link.
  if (host === "cf.ncsbe.gov") {
    return {
      kind: "state-lookup",
      label: "Look up their committee (NC State Board of Elections)",
      hint: "A records search, not a donation page. Use it to find the committee and its treasurer.",
    };
  }

  return {
    kind: "campaign-site",
    label: "Visit their campaign site",
    hint: "The committee's own site. Their donate page may be linked from it.",
  };
}
