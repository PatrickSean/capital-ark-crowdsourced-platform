/**
 * Seeds the audited NC fundraising slate into a real database.
 *
 * The upserts deliberately update authoritative fields so re-running this
 * command propagates district, committee, processor-link, and goal fixes.
 * Fictional UI fixtures are opt-in with SEED_DEMO_DATA=true.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  ActivityType,
  CoalitionVerificationStatus,
  PledgeStatus,
  TargetStatus,
} from "../src/generated/prisma/enums.js";
import * as fixtures from "../src/lib/data/fixtures.js";
import * as ncHemp from "../src/lib/data/campaigns/nc-hemp.js";
import { createPostgresConfig } from "../src/lib/postgres-config.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. The app runs in demo mode without it; " +
      "seeding is only needed once you've connected a real database.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(createPostgresConfig(connectionString)),
});

async function main() {
  console.log("Seeding the verified North Carolina fundraising slate...");

  // Fictional fixtures are useful for local UI development, but must never
  // appear alongside real politicians in a production database by default.
  // Opt in explicitly when a developer needs the processor-demo coalition.
  if (process.env.SEED_DEMO_DATA === "true") {
    console.log(
      "SEED_DEMO_DATA=true: adding fictional development fixtures...",
    );

    for (const u of fixtures.users) {
      await prisma.user.upsert({
        where: { id: u.id },
        create: {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          isAnonymous: u.isAnonymous,
          employer: u.employer ?? null,
          occupation: u.occupation ?? null,
          city: u.city ?? null,
          state: u.state ?? null,
          zip: u.zip ?? null,
        },
        update: {},
      });
    }
    console.log(`  users: ${fixtures.users.length}`);

    for (const c of fixtures.candidates) {
      await prisma.candidate.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          slug: c.slug,
          fullName: c.fullName,
          legalName: c.legalName,
          party: c.party,
          office: c.office,
          state: c.state,
          district: c.district,
          bio: c.bio,
          donationUrl: c.donationUrl,
          donationUrlVerifiedAt: c.donationUrlVerifiedAt,
          platform: c.platform,
          websiteUrl: c.websiteUrl,
          officialProfileUrl: c.officialProfileUrl,
          officialDataVerifiedAt: c.officialDataVerifiedAt,
          jurisdiction: c.jurisdiction,
          committeeName: c.committeeName,
          ncsbeCommitteeId: c.ncsbeCommitteeId,
          fecCandidateId: c.fecCandidateId,
          fecCommitteeId: c.fecCommitteeId,
        },
        update: {},
      });
    }
    console.log(
      `  candidates: ${fixtures.candidates.length} (one per processor)`,
    );

    await prisma.coalition.upsert({
      where: { id: fixtures.coalition.id },
      create: {
        id: fixtures.coalition.id,
        slug: fixtures.coalition.slug,
        name: fixtures.coalition.name,
        description: fixtures.coalition.description,
        trackingPrefix: fixtures.coalition.trackingPrefix,
        flatTrackingTag: fixtures.coalition.flatTrackingTag,
        verificationStatus: fixtures.coalition.verificationStatus,
        reviewedAt: fixtures.coalition.reviewedAt,
        organizerAttestedAt: fixtures.coalition.organizerAttestedAt,
        isPublic: fixtures.coalition.isPublic,
        createdById: fixtures.coalition.createdById,
      },
      update: {},
    });

    for (const m of fixtures.memberships) {
      await prisma.coalitionMember.upsert({
        where: {
          coalitionId_userId: {
            coalitionId: fixtures.coalition.id,
            userId: m.userId,
          },
        },
        create: {
          coalitionId: fixtures.coalition.id,
          userId: m.userId,
          role: m.role,
        },
        update: {},
      });
    }
    console.log(`  coalition: ${fixtures.coalition.name}`);

    for (const t of fixtures.targets) {
      await prisma.fundraisingTarget.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          slug: t.slug,
          coalitionId: fixtures.coalition.id,
          candidateId: t.candidateId,
          title: t.title,
          description: t.description,
          goalCents: t.goalCents,
          deadline: t.deadline,
          suggestedAmounts: t.suggestedAmounts,
          createdById: fixtures.coalition.createdById,
        },
        update: {},
      });
    }
    console.log(`  targets: ${fixtures.targets.length}`);

    for (const p of fixtures.pledges) {
      const createdAt = new Date(Date.now() - p.minutesAgo * 60_000);
      const resolved = p.status !== PledgeStatus.PENDING;

      await prisma.pledge.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          userId: p.userId,
          targetId: p.targetId,
          amountCents: p.amountCents,
          confirmedAmountCents: p.confirmedAmountCents,
          status: p.status,
          trackingTagUsed: `${fixtures.coalition.trackingPrefix}-SEED`,
          receiptUrl: p.hasReceipt ? "seed/receipt.png" : null,
          isAnonymousAtPledge: p.isAnonymousAtPledge,
          attestedAt: resolved ? createdAt : null,
          attestationVersion: resolved ? "2026-01-v1" : null,
          createdAt,
        },
        update: {},
      });

      if (
        p.status === PledgeStatus.COMPLETED ||
        p.status === PledgeStatus.UNVERIFIED
      ) {
        const user = fixtures.users.find((u) => u.id === p.userId);
        await prisma.activityEvent.upsert({
          where: { id: p.id.replace(/^0/, "9") },
          create: {
            id: p.id.replace(/^0/, "9"),
            coalitionId: fixtures.coalition.id,
            targetId: p.targetId,
            actorId: p.userId,
            type: ActivityType.PLEDGE_CONFIRMED,
            actorLabel: p.isAnonymousAtPledge
              ? "Someone"
              : (user?.displayName ?? "A supporter"),
            amountCents: p.confirmedAmountCents,
            createdAt,
          },
          update: {},
        });
      }
    }
    console.log(`  pledges: ${fixtures.pledges.length}`);
  }

  await seedNcHemp();

  console.log(`\nDone. Visit /c/${ncHemp.hempCoalition.slug}.`);
}

/**
 * The NC Hemp Industry drive.
 *
 * Seeded with no pledges: unlike the demo coalition above, these are real
 * candidates and real goals, so every number on the page has to start at zero
 * and only move when someone actually reports a contribution.
 */
async function seedNcHemp() {
  const owner = ncHemp.hempOrganizer;

  await prisma.user.upsert({
    where: { id: owner.id },
    create: {
      id: owner.id,
      email: owner.email,
      displayName: owner.displayName,
      isAnonymous: owner.isAnonymous,
      state: owner.state,
    },
    update: {
      email: owner.email,
      displayName: owner.displayName,
      isAnonymous: owner.isAnonymous,
      state: owner.state,
    },
  });

  for (const c of ncHemp.hempCandidates) {
    const candidateData = {
      slug: c.slug,
      fullName: c.fullName,
      legalName: c.legalName,
      party: c.party,
      office: c.office,
      state: c.state,
      district: c.district,
      bio: c.bio,
      photoUrl: c.photoUrl,
      donationUrl: c.donationUrl,
      donationUrlVerifiedAt: c.donationUrlVerifiedAt,
      platform: c.platform,
      websiteUrl: c.websiteUrl,
      officialProfileUrl: c.officialProfileUrl,
      officialDataVerifiedAt: c.officialDataVerifiedAt,
      jurisdiction: c.jurisdiction,
      committeeName: c.committeeName,
      ncsbeCommitteeId: c.ncsbeCommitteeId,
      fecCandidateId: c.fecCandidateId,
      fecCommitteeId: c.fecCommitteeId,
      isActive: true,
    };

    await prisma.candidate.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        ...candidateData,
      },
      update: candidateData,
    });
  }

  const coalitionData = {
    slug: ncHemp.hempCoalition.slug,
    name: ncHemp.hempCoalition.name,
    description: ncHemp.hempCoalition.description,
    logoUrl: ncHemp.hempCoalition.logoUrl,
    trackingPrefix: ncHemp.hempCoalition.trackingPrefix,
    flatTrackingTag: ncHemp.hempCoalition.flatTrackingTag,
    requireSignIn: ncHemp.hempCoalition.requireSignIn,
    verificationStatus: CoalitionVerificationStatus.PLATFORM_VERIFIED,
    reviewedAt: ncHemp.hempCoalition.reviewedAt,
    organizerAttestedAt: ncHemp.hempCoalition.organizerAttestedAt,
    isPublic: ncHemp.hempCoalition.isPublic,
    createdById: owner.id,
  };

  await prisma.coalition.upsert({
    where: { id: ncHemp.hempCoalition.id },
    create: {
      id: ncHemp.hempCoalition.id,
      ...coalitionData,
    },
    update: coalitionData,
  });

  await prisma.coalitionMember.upsert({
    where: {
      coalitionId_userId: {
        coalitionId: ncHemp.hempCoalition.id,
        userId: owner.id,
      },
    },
    create: {
      coalitionId: ncHemp.hempCoalition.id,
      userId: owner.id,
      role: "OWNER",
    },
    update: { role: "OWNER" },
  });

  for (const t of ncHemp.hempTargets) {
    const targetData = {
      slug: t.slug,
      coalitionId: ncHemp.hempCoalition.id,
      candidateId: t.candidateId,
      title: t.title,
      description: t.description,
      goalCents: t.goalCents,
      deadline: t.deadline,
      suggestedAmounts: t.suggestedAmounts,
      status: TargetStatus.ACTIVE,
      createdById: owner.id,
    };

    await prisma.fundraisingTarget.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        ...targetData,
      },
      update: targetData,
    });
  }

  const linked = ncHemp.hempCandidates.filter((c) => c.donationUrl).length;
  console.log(
    `  ${ncHemp.hempCoalition.name}: ${ncHemp.hempTargets.length} targets, ` +
      `${linked} with a donation link`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
