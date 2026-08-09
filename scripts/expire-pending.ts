/**
 * Marks unresolved contribution intents older than 72 hours as EXPIRED.
 *
 * Run hourly as a DigitalOcean App Platform scheduled job. Public reads also
 * exclude stale rows, so totals remain correct if a scheduled run is delayed.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PledgeStatus } from "../src/generated/prisma/enums.js";
import { createPostgresConfig } from "../src/lib/postgres-config.js";
import { pendingPledgeCutoff } from "../src/lib/pledge-expiry.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to expire pending pledges.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(createPostgresConfig(connectionString)),
});

try {
  const cutoff = pendingPledgeCutoff();
  const result = await prisma.pledge.updateMany({
    where: {
      status: PledgeStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    data: { status: PledgeStatus.EXPIRED },
  });

  console.log(
    `Expired ${result.count} unresolved contribution intent(s) created before ${cutoff.toISOString()}.`,
  );
} finally {
  await prisma.$disconnect();
}
