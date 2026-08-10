import { describe, expect, it, vi } from "vitest";
import { TargetStatus } from "@/generated/prisma/enums";

vi.mock("server-only", () => ({}));

import { buildEmbeddableDriveCatalog, demoStore } from "./demo-store";
import { createPrismaStore } from "./prisma-store";

describe("embeddable drive catalog", () => {
  it("uses one narrow Prisma aggregate query and maps only public fields", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        name: "North Carolina Hemp Industry",
        slug: "nc-hemp-industry",
        _count: { targets: 10 },
      },
    ]);
    const store = createPrismaStore({
      coalition: { findMany },
    } as never);

    await expect(store.listEmbeddableDrives()).resolves.toEqual([
      {
        name: "North Carolina Hemp Industry",
        slug: "nc-hemp-industry",
        targetCount: 10,
      },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isPublic: true,
        targets: { some: { status: TargetStatus.ACTIVE } },
      },
      select: {
        name: true,
        slug: true,
        _count: {
          select: {
            targets: { where: { status: TargetStatus.ACTIVE } },
          },
        },
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    });
  });

  it("returns a deterministic minimal demo catalog", async () => {
    const catalog = await demoStore.listEmbeddableDrives();

    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog).toEqual(
      [...catalog].sort((left, right) => left.name.localeCompare(right.name)),
    );
    for (const item of catalog) {
      expect(Object.keys(item).sort()).toEqual([
        "name",
        "slug",
        "targetCount",
      ]);
      expect(item.targetCount).toBeGreaterThan(0);
    }
  });

  it("never exposes a private demo coalition", () => {
    const publicCoalition = {
      id: "public-id",
      name: "Public drive",
      slug: "public-drive",
      isPublic: true,
    };
    const privateCoalition = {
      id: "private-id",
      name: "Private drive",
      slug: "private-drive",
      isPublic: false,
    };
    const targets = [
      { id: "public-target", coalitionId: publicCoalition.id },
      { id: "private-target", coalitionId: privateCoalition.id },
    ];

    expect(
      buildEmbeddableDriveCatalog(
        [publicCoalition, privateCoalition] as never,
        targets as never,
      ),
    ).toEqual([
      { name: "Public drive", slug: "public-drive", targetCount: 1 },
    ]);
  });
});
