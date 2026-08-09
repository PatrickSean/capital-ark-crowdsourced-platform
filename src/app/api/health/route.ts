import { NextResponse } from "next/server";
import {
  AUTH_MODE,
  authConfigurationError,
  isDriveCreationEnabled,
} from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check.
 *
 * A missing database must never look healthy and quietly fall back to the
 * process-local demo store. DigitalOcean only routes traffic after this check
 * confirms both configuration and a live PostgreSQL connection.
 */
export async function GET() {
  const configurationErrors = [authConfigurationError()].filter(
    (error): error is string => Boolean(error),
  );

  if (process.env.NODE_ENV === "production") {
    if (AUTH_MODE === "auto") {
      configurationErrors.push(
        "NEXT_PUBLIC_AUTH_MODE must be explicit in production.",
      );
    }
    if (!process.env.IP_HASH_SALT) {
      configurationErrors.push("IP_HASH_SALT is required in production.");
    }
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      configurationErrors.push(
        "NEXT_PUBLIC_SITE_URL is required in production.",
      );
    }
    if (process.env.SEED_DEMO_DATA === "true") {
      configurationErrors.push(
        "SEED_DEMO_DATA must be false in production.",
      );
    }
    if (AUTH_MODE === "local" && isDriveCreationEnabled) {
      configurationErrors.push(
        "Drive creation requires permanent organizer authentication.",
      );
    }
  }

  if (!prisma) {
    configurationErrors.push("DATABASE_URL is not configured.");
  }

  if (configurationErrors.length > 0 || !prisma) {
    return NextResponse.json(
      { status: "error", checks: configurationErrors },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      authMode: AUTH_MODE,
    });
  } catch {
    return NextResponse.json(
      { status: "error", checks: ["Database connection failed."] },
      { status: 503 },
    );
  }
}
