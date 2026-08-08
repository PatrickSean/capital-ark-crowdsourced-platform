import "server-only";

import { prisma } from "@/lib/prisma";
import { demoStore } from "./demo-store";
import { createPrismaStore } from "./prisma-store";
import type { Store } from "./store-types";

/**
 * The one place that decides where data comes from.
 *
 * With DATABASE_URL set we talk to Postgres through Prisma. Without it we fall
 * back to an in-memory demo dataset, so `npm run dev` on a fresh clone gives a
 * fully walkable product instead of a connection error.
 */
export const store: Store = prisma ? createPrismaStore(prisma) : demoStore;

export const isDemoMode = store.isDemo;

export type { Store } from "./store-types";
