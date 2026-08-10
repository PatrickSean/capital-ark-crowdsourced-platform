import type { MetadataRoute } from "next";
import {
  hempCoalition,
  hempTargets,
} from "@/lib/data/campaigns/nc-hemp";
import { siteUrl } from "@/lib/site";

const VERIFIED_DATE = new Date("2026-08-08T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/drives`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/start`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${origin}/partners/widgets`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/c/${hempCoalition.slug}`,
      lastModified: VERIFIED_DATE,
      changeFrequency: "daily",
      priority: 1,
    },
    { url: `${origin}/compliance`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const targets: MetadataRoute.Sitemap = hempTargets.map((target) => ({
    url: `${origin}/t/${target.slug}`,
    lastModified: VERIFIED_DATE,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...targets];
}
