/**
 * Marks unresolved contribution intents older than 72 hours as EXPIRED and
 * clears salted network-address hashes after their 30-day abuse-investigation
 * window.
 *
 * Run hourly as a DigitalOcean App Platform scheduled job. Public reads also
 * exclude stale rows, so totals remain correct if a scheduled run is delayed.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { runDatabaseRetention } from "../src/lib/data/database-retention.js";
import { createPostgresConfig } from "../src/lib/postgres-config.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to run database retention.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(createPostgresConfig(connectionString)),
});

try {
  const result = await runDatabaseRetention(prisma);

  console.log(
    `Expired ${result.expiredCount} unresolved contribution intent(s) created before ${result.pendingCutoff.toISOString()}.`,
  );
  console.log(
    `Cleared ${result.hashesClearedCount} network hash(es) created before ${result.hashCutoff.toISOString()}.`,
  );
} finally {
  await prisma.$disconnect();
}
