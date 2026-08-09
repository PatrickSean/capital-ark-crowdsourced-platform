/**
 * Prisma Migrate should prefer a direct connection, but an explicitly blank
 * optional variable must not mask the usable runtime database URL.
 */
export function resolveMigrationUrl(
  directUrl: string | undefined,
  databaseUrl: string | undefined,
): string {
  return directUrl?.trim() || databaseUrl?.trim() || "";
}

