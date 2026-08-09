import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresConfig } from "@/lib/postgres-config";

/**
 * Prisma singleton.
 *
 * Returns null when DATABASE_URL is unset, which is what puts the app into
 * demo mode. Every caller goes through the store in `src/lib/data`, so this is
 * the only place that has to know whether a real database exists.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null | undefined;
};

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  return new PrismaClient({
    adapter: new PrismaPg(createPostgresConfig(url)),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient | null =
  globalForPrisma.prisma ?? createClient();

// Reuse across HMR reloads so dev doesn't exhaust the connection pool.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const isDatabaseConfigured = Boolean(prisma);
