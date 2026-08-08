/**
 * North Carolina Hemp Industry drive.
 *
 * Imported from the coalition's own target list, then resolved to real
 * processor pages. Two things about this data are load-bearing:
 *
 * 1. `donationUrl` is never taken from the source list. That list carried
 *    campaign homepages and, for four candidates, cf.ncsbe.gov/CFOrgLkup --
 *    the State Board of Elections' campaign finance *document search*, which
 *    accepts no money at all. Each URL below was instead found on the
 *    committee's own site and then loaded to confirm it renders a live
 *    donation form for the named committee. Re-verify before reusing: campaigns
 *    move between processors, and a stale URL silently loses the tag.
 *
 * 2. Every candidate but Tim Moore is a North Carolina state race, and NC bans
 *    contributions from business entities outright (G.S. 163-278.15). For a
 *    coalition organized around an industry, that is the single most important
 *    fact on the page, so jurisdiction is set per candidate and drives which
 *    attestation the contributor sees.
 *
 *    Moore's committee shares its name with the NC state committee he used as
 *    Speaker, which makes it easy to file him under the wrong rules. His page
 *    is federal: it offers $3,500 and $7,000, the FEC per-election and
 *    primary-plus-general limits, and FEC lists Friends of Tim Moore
 *    (C00856005) as the principal campaign committee for candidate H4NC14015.
 */
import { Jurisdiction, Party, Platform } from "@/generated/prisma/enums";
import type {
  FixtureCandidate,
  FixtureCoalition,
  FixtureTarget,
} from "../fixtures";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

export const HEMP_IDS = {
  organizer: id("200"),
  coalition: id("210"),
} as const;

export const hempOrganizer = {
  id: HEMP_IDS.organizer,
  // The campaign owner has not supplied an account email yet. Keeping this
  // null avoids publishing a placeholder address or implying it can log in.
  email: null,
  displayName: "NC Hemp Industry",
  isAnonymous: false,
  state: "NC",
};

export const hempCoalition: FixtureCoalition = {
  id: HEMP_IDS.coalition,
  slug: "nc-hemp-industry",
  name: "North Carolina Hemp Industry",
  description:
    "Hemp growers, processors, and retailers across North Carolina backing legislators who understand the industry. Contributions are personal, made directly to each committee, and tagged HEMP so campaigns can see where they came from.",
  logoUrl: null,
  trackingPrefix: "HEMP",
  // The whole point of this coalition's tag: every committee sees the literal
  // string HEMP on the contribution, with nothing appended.
  flatTrackingTag: true,
  requireSignIn: false,
  isPublic: true,
  createdById: HEMP_IDS.organizer,
};

interface HempRow {
  n: string;
  /** Public-facing name used by the current officeholder/campaign. */
  fullName: string;
  /** Filing/legal identity retained separately from the display name. */
  legalName: string;
  office: string;
  district: string | null;
  party: Party;
  jurisdiction: Jurisdiction;
  goalDollars: number;
  /** Verified live processor page for the named committee. */
  donationUrl: string;
  platform: Platform;
  /**
   * Exactly as the processor page renders it. Shown on the handoff screen so a
   * contributor can check the name on the donation page against the name we
   * sent them to before entering a card.
   */
  committeeName: string;
  ncsbeCommitteeId?: string;
  fecCandidateId?: string;
  fecCommitteeId?: string;
  /** The committee's own site, shown alongside the tracked donate button. */
  websiteUrl: string | null;
  /** Current official government profile used to verify office and district. */
  officialProfileUrl: string;
}

// All offices, districts, parties, committee IDs, and processor links were
// re-verified against NCGA/NCSBE/FEC/House records and current campaign sites.
const VERIFIED_AT = new Date("2026-08-08T00:00:00.000Z");

const ROWS: HempRow[] = [
  {
    n: "220",
    fullName: "Destin Hall",
    legalName: "Destin Chase Hall",
    office: "Speaker of the NC House",
    district: "House District 87",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 150_000,
    donationUrl: "https://secure.winred.com/citizens-for-destin-hall/webdonate",
    platform: Platform.WINRED,
    committeeName: "Citizens for Destin Hall",
    ncsbeCommitteeId: "STA-AD855K-C-001",
    websiteUrl: "https://www.destinhall.org/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/719",
  },
  {
    n: "221",
    fullName: "Brenden H. Jones",
    legalName: "Brenden Harding Jones",
    office: "NC House Majority Leader",
    district: "House District 46",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 100_000,
    donationUrl:
      "https://secure.anedot.com/brenden-jones-for-nc-house/repjonesfornc",
    platform: Platform.ANEDOT,
    committeeName: "Committee to Elect Brenden Jones",
    ncsbeCommitteeId: "STA-9648CG-C-001",
    websiteUrl: "https://repjonesfornc.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/723",
  },
  {
    n: "222",
    fullName: "David Willis",
    legalName: "David Allen Willis",
    office: "NC House of Representatives",
    district: "House District 68",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 10_000,
    donationUrl: "https://secure.anedot.com/david-willis-for-nc/donate",
    platform: Platform.ANEDOT,
    committeeName: "David Willis for NC",
    ncsbeCommitteeId: "STA-W7S330-C-001",
    websiteUrl: "https://www.votedavidwillis.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/779",
  },
  {
    n: "223",
    fullName: "Jeffrey C. McNeely",
    legalName: "Jeffrey C. McNeely",
    office: "NC House of Representatives",
    district: "House District 84",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 50_000,
    donationUrl:
      "https://secure.anedot.com/committee-to-elect-mcneely-for-north-carolina-house/donate",
    platform: Platform.ANEDOT,
    committeeName: "Committee to Elect McNeely for NC House",
    ncsbeCommitteeId: "STA-B4TA2C-C-001",
    websiteUrl: "https://jeffmcneely.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/761",
  },
  {
    n: "224",
    fullName: "Tricia Ann Cotham",
    legalName: "Patricia Ann Cotham",
    office: "NC House of Representatives",
    district: "House District 105",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 10_000,
    donationUrl: "https://secure.winred.com/tricia-cotham-committee/donate",
    platform: Platform.WINRED,
    committeeName: "Tricia Cotham Committee",
    // -002 is the active committee; the older -001 committee is closed.
    ncsbeCommitteeId: "STA-07985B-C-002",
    websiteUrl: "https://www.triciacotham.net/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/817",
  },
  {
    n: "225",
    fullName: "Allen Chesser",
    legalName: "Gregory Allen Chesser II",
    office: "NC House of Representatives",
    district: "House District 25",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 10_000,
    // Allen Chesser for NC House. He files as Gregory Allen Chesser II but
    // campaigns as Allen, which is why the source list had no site for him.
    donationUrl: "https://secure.anedot.com/allenchesser/donate",
    platform: Platform.ANEDOT,
    committeeName: "Allen Chesser for NC House",
    ncsbeCommitteeId: "STA-5YRCX3-C-001",
    websiteUrl: "https://allenchesser.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/799",
  },
  {
    n: "226",
    fullName: "Cody Huneycutt",
    legalName: "Cody Lee Huneycutt",
    office: "NC House of Representatives",
    district: "House District 67",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 10_000,
    donationUrl:
      "https://secure.anedot.com/committee-to-elect-cody-huneycutt-b50fcd95-1728-412f-8648-af01f822b463/donate",
    platform: Platform.ANEDOT,
    committeeName: "Committee to Elect Cody Huneycutt",
    ncsbeCommitteeId: "STA-UF5703-C-001",
    websiteUrl: "https://cody4nc.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/833",
  },
  {
    n: "227",
    fullName: "Robert T. Reives II",
    legalName: "Robert Tyrone Reives II",
    office: "NC House Democratic Leader",
    district: "House District 54",
    party: Party.DEMOCRAT,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 50_000,
    donationUrl:
      "https://secure.actblue.com/donate/committee-to-elect-robert-t-reives-ii-1",
    platform: Platform.ACTBLUE,
    committeeName: "Committee to Elect Robert T Reives II",
    ncsbeCommitteeId: "STA-49JCP7-C-001",
    websiteUrl: "https://www.reivesforhouse.com/",
    officialProfileUrl: "https://www.ncleg.gov/Members/Biography/H/684",
  },
  {
    n: "228",
    fullName: "Josh Stein",
    legalName: "Joshua H. Stein",
    office: "Governor of North Carolina",
    district: null,
    party: Party.DEMOCRAT,
    jurisdiction: Jurisdiction.STATE,
    goalDollars: 100_000,
    // Current form linked by the campaign's own site on the verification date.
    donationUrl: "https://secure.actblue.com/donate/website_bax_launch_gov",
    platform: Platform.ACTBLUE,
    committeeName: "Josh Stein for North Carolina",
    ncsbeCommitteeId: "STA-WP1LKA-C-001",
    websiteUrl: "https://www.joshstein.org/",
    officialProfileUrl: "https://governor.nc.gov/josh-stein",
  },
  {
    n: "229",
    fullName: "Tim Moore",
    legalName: "Timothy Keith Moore",
    // Federal, not state: he sits in Congress now, so FEC limits and the
    // federal attestation apply to him and to nobody else on this list.
    office: "U.S. House of Representatives",
    district: "NC-14",
    party: Party.REPUBLICAN,
    jurisdiction: Jurisdiction.FEDERAL,
    goalDollars: 150_000,
    // Friends of Tim Moore. His site also links a WinRed URL, but that one is
    // the campaign store -- merchandise, not a contribution.
    donationUrl:
      "https://secure.anedot.com/friends-of-tim-moore-b5e8378b-041b-43ac-b166-f5c77ea73087/donate",
    platform: Platform.ANEDOT,
    committeeName: "Friends of Tim Moore",
    fecCandidateId: "H4NC14015",
    fecCommitteeId: "C00856005",
    websiteUrl: "https://www.timmoore.com/",
    officialProfileUrl: "https://clerk.house.gov/members/M001236",
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Contributor-facing chips. Sized for individuals, not institutions. */
const SUGGESTED_AMOUNTS = [25_000, 50_000, 100_000, 250_000];

export const hempCandidates: FixtureCandidate[] = ROWS.map((row) => ({
  id: id(row.n),
  slug: `nc-hemp-${slugify(row.fullName)}`,
  fullName: row.fullName,
  legalName: row.legalName,
  party: row.party,
  office: row.office,
  state: "NC",
  district: row.district,
  bio: null,
  photoUrl: null,
  donationUrl: row.donationUrl,
  donationUrlVerifiedAt: VERIFIED_AT,
  platform: row.platform,
  websiteUrl: row.websiteUrl,
  officialProfileUrl: row.officialProfileUrl,
  officialDataVerifiedAt: VERIFIED_AT,
  jurisdiction: row.jurisdiction,
  committeeName: row.committeeName,
  ncsbeCommitteeId: row.ncsbeCommitteeId ?? null,
  fecCandidateId: row.fecCandidateId ?? null,
  fecCommitteeId: row.fecCommitteeId ?? null,
}));

const goalLabel = (dollars: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);

export const hempTargets: FixtureTarget[] = ROWS.map((row) => ({
  id: id(String(Number(row.n) + 100)),
  slug: `hemp-${slugify(row.fullName)}`,
  candidateId: id(row.n),
  title: `Raise ${goalLabel(row.goalDollars)} for ${row.fullName}`,
  description: null,
  goalCents: row.goalDollars * 100,
  deadline: null,
  suggestedAmounts: SUGGESTED_AMOUNTS,
}));
