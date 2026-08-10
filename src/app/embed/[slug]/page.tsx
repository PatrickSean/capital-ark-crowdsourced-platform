import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriveEmbed } from "@/components/embed/drive-embed";
import { store } from "@/lib/data";
import { getPublicEmbedDriveSnapshot } from "@/lib/embed-drive";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: "Embedded community drive",
    alternates: { canonical: `/c/${slug}` },
    robots: { index: false, follow: false },
  };
}

/**
 * A deliberately narrow, public rendering surface for partner websites.
 *
 * The first paint comes directly from the server-side public snapshot. The
 * client receives only that serializable aggregate and refreshes it from the
 * public embed endpoint; no session, receipt, or contributor record crosses
 * this boundary.
 */
export default async function EmbedDrivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const snapshot = await getPublicEmbedDriveSnapshot(store, slug);

  if (!snapshot) notFound();

  return <DriveEmbed key={slug} initialSnapshot={snapshot} slug={slug} />;
}
