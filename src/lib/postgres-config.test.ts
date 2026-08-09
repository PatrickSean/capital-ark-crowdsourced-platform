import { describe, expect, it } from "vitest";
import { createPostgresConfig } from "./postgres-config";

describe("createPostgresConfig", () => {
  it("keeps local database connections unchanged when no CA is configured", () => {
    expect(createPostgresConfig("postgresql://localhost/capital_ark", "")).toEqual(
      {
        connectionString: "postgresql://localhost/capital_ark",
      },
    );
  });

  it("verifies managed-database TLS with the configured CA", () => {
    expect(
      createPostgresConfig(
        "postgresql://private-db/capital_ark?sslmode=require&application_name=capital-ark",
        "-----BEGIN CERTIFICATE-----\\ncertificate-data\\n-----END CERTIFICATE-----",
      ),
    ).toEqual({
      connectionString:
        "postgresql://private-db/capital_ark?application_name=capital-ark",
      ssl: {
        ca: "-----BEGIN CERTIFICATE-----\ncertificate-data\n-----END CERTIFICATE-----",
        rejectUnauthorized: true,
      },
    });
  });

  it("removes every URL SSL option that could override the verified CA", () => {
    const config = createPostgresConfig(
      "postgresql://private-db/capital_ark?ssl=true&sslmode=require&sslcert=client.crt&sslkey=client.key&sslrootcert=root.crt&uselibpqcompat=true",
      "managed-database-ca",
    );

    expect(config).toEqual({
      connectionString: "postgresql://private-db/capital_ark",
      ssl: {
        ca: "managed-database-ca",
        rejectUnauthorized: true,
      },
    });
  });

  it("does not include the database URL in its validation error", () => {
    expect(() =>
      createPostgresConfig(
        "not-a-postgres-url-with-a-secret-password",
        "managed-database-ca",
      ),
    ).toThrow(
      "DATABASE_URL must be a PostgreSQL URL when DATABASE_CA_CERT is set.",
    );
  });
});
