/**
 * Demo dataset.
 *
 * Shared by `prisma/seed.ts` and the in-memory demo store so both paths render
 * identically. The candidates are fictional and span three parties on purpose:
 * this is non-partisan infrastructure, and the sample data shouldn't imply
 * otherwise or attach a real person's name to a fake fundraising number.
 *
 * IDs are fixed rather than random so links are stable across restarts and
 * across the demo/database switch.
 */
import {
  ActivityType,
  Jurisdiction,
  Party,
  Platform,
  PledgeStatus,
} from "@/generated/prisma/enums";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

export const IDS = {
  organizer: id("1"),
  memberA: id("2"),
  memberB: id("3"),
  memberC: id("4"),
  coalition: id("10"),
  candidateWinRed: id("20"),
  candidateActBlue: id("21"),
  candidateAnedot: id("22"),
  targetWinRed: id("30"),
  targetActBlue: id("31"),
  targetAnedot: id("32"),
} as const;

export interface FixtureUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  employer?: string | null;
  occupation?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export const users: FixtureUser[] = [
  {
    id: IDS.organizer,
    email: "organizer@example.com",
    displayName: "Dana Whitfield",
    isAnonymous: false,
    employer: "Whitfield Hardware",
    occupation: "Owner",
    city: "Raleigh",
    state: "NC",
    zip: "27601",
  },
  {
    id: IDS.memberA,
    email: "priya@example.com",
    displayName: "Priya Raman",
    isAnonymous: false,
    employer: "Raman Logistics",
    occupation: "Operations Director",
    city: "Durham",
    state: "NC",
    zip: "27701",
  },
  {
    id: IDS.memberB,
    email: "tom@example.com",
    displayName: "Tom Ashby",
    isAnonymous: false,
    employer: "Ashby & Sons Plumbing",
    occupation: "Contractor",
    city: "Cary",
    state: "NC",
    zip: "27511",
  },
  // An anonymous contributor: pledged from a shared link, never made an
  // account. Their attestations render as "Someone" in the activity feed.
  { id: IDS.memberC, email: null, displayName: null, isAnonymous: true },
];

export interface FixtureCandidate {
  id: string;
  slug: string;
  fullName: string;
  legalName: string | null;
  party: Party;
  office: string;
  state: string;
  district: string | null;
  bio: string | null;
  photoUrl: string | null;
  donationUrl: string | null;
  platform: Platform | null;
  websiteUrl: string | null;
  officialProfileUrl: string | null;
  officialDataVerifiedAt: Date | null;
  donationUrlVerifiedAt: Date | null;
  jurisdiction: Jurisdiction;
  committeeName: string | null;
  ncsbeCommitteeId: string | null;
  fecCandidateId: string | null;
  fecCommitteeId: string | null;
}

export const candidates: FixtureCandidate[] = [
  {
    id: IDS.candidateWinRed,
    slug: "marcus-webb",
    fullName: "Marcus Webb",
    legalName: null,
    party: Party.REPUBLICAN,
    office: "U.S. Senate",
    state: "NC",
    district: null,
    bio: "Third-generation farmer and former county commissioner running on small-business tax relief and rural broadband.",
    photoUrl: null,
    donationUrl: "https://secure.winred.com/example-committee/donate",
    platform: Platform.WINRED,
    websiteUrl: null,
    officialProfileUrl: null,
    officialDataVerifiedAt: null,
    donationUrlVerifiedAt: null,
    jurisdiction: Jurisdiction.FEDERAL,
    committeeName: "Webb for North Carolina",
    ncsbeCommitteeId: null,
    fecCandidateId: null,
    fecCommitteeId: "C00999001",
  },
  {
    id: IDS.candidateActBlue,
    slug: "elena-ruiz",
    fullName: "Elena Ruiz",
    legalName: null,
    party: Party.DEMOCRAT,
    office: "U.S. House",
    state: "NC",
    district: "NC-04",
    bio: "Pediatric nurse and school board member focused on healthcare access and childcare affordability.",
    photoUrl: null,
    donationUrl: "https://secure.actblue.com/donate/example-form",
    platform: Platform.ACTBLUE,
    websiteUrl: null,
    officialProfileUrl: null,
    officialDataVerifiedAt: null,
    donationUrlVerifiedAt: null,
    jurisdiction: Jurisdiction.FEDERAL,
    committeeName: "Ruiz for Congress",
    ncsbeCommitteeId: null,
    fecCandidateId: null,
    fecCommitteeId: "C00999002",
  },
  {
    id: IDS.candidateAnedot,
    slug: "dale-kirkpatrick",
    fullName: "Dale Kirkpatrick",
    legalName: null,
    party: Party.INDEPENDENT,
    office: "Governor",
    state: "NC",
    district: null,
    bio: "Former state auditor running unaffiliated on procurement reform and budget transparency.",
    photoUrl: null,
    donationUrl: "https://secure.anedot.com/example-org/donate",
    platform: Platform.ANEDOT,
    websiteUrl: null,
    officialProfileUrl: null,
    officialDataVerifiedAt: null,
    donationUrlVerifiedAt: null,
    jurisdiction: Jurisdiction.STATE,
    committeeName: "Kirkpatrick for Governor",
    ncsbeCommitteeId: null,
    fecCandidateId: null,
    fecCommitteeId: "C00999003",
  },
];

export interface FixtureCoalition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  trackingPrefix: string;
  flatTrackingTag: boolean;
  requireSignIn: boolean;
  isPublic: boolean;
  createdById: string;
}

export const coalition: FixtureCoalition = {
  id: IDS.coalition,
  slug: "nc-small-business",
  name: "NC Small Business Coalition",
  description:
    "Independent business owners across North Carolina pooling support for candidates who show up for Main Street.",
  logoUrl: null,
  trackingPrefix: "NCSBC",
  flatTrackingTag: false,
  requireSignIn: false,
  isPublic: true,
  createdById: IDS.organizer,
};

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

export interface FixtureTarget {
  id: string;
  slug: string;
  candidateId: string;
  title: string;
  description: string | null;
  goalCents: number;
  deadline: Date | null;
  suggestedAmounts: number[];
}

export const targets: FixtureTarget[] = [
  {
    id: IDS.targetWinRed,
    slug: "webb-senate-push",
    candidateId: IDS.candidateWinRed,
    title: "Raise $25,000 for Marcus Webb",
    description:
      "Our coalition's push ahead of the Q3 filing deadline. Every contribution goes directly to the committee on WinRed.",
    goalCents: 2_500_000,
    deadline: daysFromNow(24),
    suggestedAmounts: [2500, 5000, 10000, 25000],
  },
  {
    id: IDS.targetActBlue,
    slug: "ruiz-house-drive",
    candidateId: IDS.candidateActBlue,
    title: "Raise $15,000 for Elena Ruiz",
    description:
      "Backing a candidate who has met with our members three times this year. Contributions are processed by ActBlue.",
    goalCents: 1_500_000,
    deadline: daysFromNow(38),
    suggestedAmounts: [2500, 5000, 10000, 20000],
  },
  {
    id: IDS.targetAnedot,
    slug: "kirkpatrick-governor-fund",
    candidateId: IDS.candidateAnedot,
    title: "Raise $40,000 for Dale Kirkpatrick",
    description:
      "Statewide procurement reform matters to every contractor in this coalition. Handled through Anedot.",
    goalCents: 4_000_000,
    deadline: daysFromNow(61),
    suggestedAmounts: [5000, 10000, 25000, 50000],
  },
];

export interface FixturePledge {
  id: string;
  userId: string;
  targetId: string;
  amountCents: number;
  confirmedAmountCents: number | null;
  status: PledgeStatus;
  hasReceipt: boolean;
  isAnonymousAtPledge: boolean;
  minutesAgo: number;
}

/**
 * A spread that exercises every progress-bar segment and both verification
 * tiers, so the layered bar is visibly doing something on first load.
 */
export const pledges: FixturePledge[] = [
  {
    id: id("100"),
    userId: IDS.organizer,
    targetId: IDS.targetWinRed,
    amountCents: 100_000,
    confirmedAmountCents: 100_000,
    status: PledgeStatus.COMPLETED,
    hasReceipt: true,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 52,
  },
  {
    id: id("101"),
    userId: IDS.memberA,
    targetId: IDS.targetWinRed,
    amountCents: 250_000,
    confirmedAmountCents: 250_000,
    status: PledgeStatus.COMPLETED,
    hasReceipt: true,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 40,
  },
  {
    id: id("102"),
    userId: IDS.memberB,
    targetId: IDS.targetWinRed,
    amountCents: 50_000,
    confirmedAmountCents: 50_000,
    status: PledgeStatus.UNVERIFIED,
    hasReceipt: false,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 18,
  },
  {
    id: id("103"),
    userId: IDS.memberC,
    targetId: IDS.targetWinRed,
    amountCents: 25_000,
    confirmedAmountCents: 25_000,
    status: PledgeStatus.UNVERIFIED,
    hasReceipt: false,
    isAnonymousAtPledge: true,
    minutesAgo: 60 * 6,
  },
  {
    id: id("104"),
    userId: IDS.memberA,
    targetId: IDS.targetWinRed,
    amountCents: 100_000,
    confirmedAmountCents: null,
    status: PledgeStatus.PENDING,
    hasReceipt: false,
    isAnonymousAtPledge: false,
    minutesAgo: 22,
  },

  {
    id: id("110"),
    userId: IDS.organizer,
    targetId: IDS.targetActBlue,
    amountCents: 150_000,
    confirmedAmountCents: 150_000,
    status: PledgeStatus.COMPLETED,
    hasReceipt: true,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 30,
  },
  {
    id: id("111"),
    userId: IDS.memberB,
    targetId: IDS.targetActBlue,
    amountCents: 75_000,
    confirmedAmountCents: 75_000,
    status: PledgeStatus.UNVERIFIED,
    hasReceipt: false,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 9,
  },
  {
    id: id("112"),
    userId: IDS.memberC,
    targetId: IDS.targetActBlue,
    amountCents: 50_000,
    confirmedAmountCents: null,
    status: PledgeStatus.PENDING,
    hasReceipt: false,
    isAnonymousAtPledge: true,
    minutesAgo: 95,
  },

  {
    id: id("120"),
    userId: IDS.memberA,
    targetId: IDS.targetAnedot,
    amountCents: 500_000,
    confirmedAmountCents: 500_000,
    status: PledgeStatus.COMPLETED,
    hasReceipt: true,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 70,
  },
  {
    id: id("121"),
    userId: IDS.organizer,
    targetId: IDS.targetAnedot,
    amountCents: 250_000,
    confirmedAmountCents: 250_000,
    status: PledgeStatus.UNVERIFIED,
    hasReceipt: false,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 26,
  },
  {
    id: id("122"),
    userId: IDS.memberB,
    targetId: IDS.targetAnedot,
    amountCents: 100_000,
    confirmedAmountCents: null,
    status: PledgeStatus.DECLINED,
    hasReceipt: false,
    isAnonymousAtPledge: false,
    minutesAgo: 60 * 4,
  },
];

export const memberships = [
  { userId: IDS.organizer, role: "OWNER" as const },
  { userId: IDS.memberA, role: "ADMIN" as const },
  { userId: IDS.memberB, role: "MEMBER" as const },
];

export const activityTypes = ActivityType;
