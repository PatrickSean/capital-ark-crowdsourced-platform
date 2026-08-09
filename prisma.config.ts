import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { resolveMigrationUrl } from "./src/lib/migration-url";

// Read through process.env rather than Prisma's `env()` helper: `env()` throws
// when a variable is missing, which would break every CLI command (including
// `prisma validate`) in demo mode, where no database is configured at all.
//
// Migrations need a direct (non-pooled) connection, so DIRECT_URL wins here
// when it's set; the pooled DATABASE_URL is what the running app uses.
const migrationUrl = resolveMigrationUrl(
  process.env.DIRECT_URL,
  process.env.DATABASE_URL,
);

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
