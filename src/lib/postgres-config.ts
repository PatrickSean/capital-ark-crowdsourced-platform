/**
 * Builds the pg pool configuration used by Prisma's PostgreSQL adapter.
 *
 * DigitalOcean Managed PostgreSQL presents a private CA certificate. Supplying
 * that CA keeps TLS verification enabled instead of falling back to an
 * insecure `rejectUnauthorized: false` connection.
 */
export function createPostgresConfig(
  connectionString: string,
  caCertificate = process.env.DATABASE_CA_CERT,
) {
  if (!caCertificate) {
    return { connectionString };
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL URL when DATABASE_CA_CERT is set.",
    );
  }

  // `pg` parses connection-string SSL parameters after the surrounding pool
  // config and lets them replace an explicit `ssl` object. DigitalOcean's
  // bindable URL includes `sslmode=require`, which would otherwise discard the
  // CA below and fall back to pg's certificate-store verification.
  for (const parameter of [
    "ssl",
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
  ]) {
    databaseUrl.searchParams.delete(parameter);
  }

  return {
    connectionString: databaseUrl.toString(),
    ssl: {
      ca: caCertificate.replace(/\\n/g, "\n"),
      rejectUnauthorized: true,
    },
  };
}
