import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDemoMode, store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/site";
import { formatCentsShort } from "@/lib/money";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionVerificationBadge } from "@/components/coalitions/coalition-verification-badge";
import { TargetCandidateCard } from "@/components/targets/target-candidate-card";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ShareActionLink } from "@/components/share/share-action-link";
import { ResumePledgeBanner } from "@/components/contribute/resume-pledge-banner";
import { SourceOfFundsNotice } from "@/components/compliance/source-of-funds-notice";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const coalition = await store.getCoalitionBySlug(slug);
  if (!coalition) return { title: "Coalition not found" };

  return {
    title: coalition.name,
    description:
      coalition.description ??
      `Track ${coalition.name}'s fundraising drives on Capital Ark.`,
    alternates: { canonical: `/c/${coalition.slug}` },
    openGraph: {
      title: coalition.name,
      description: coalition.description ?? undefined,
      url: absoluteUrl(`/c/${coalition.slug}`),
      images: [{ url: absoluteUrl(`/c/${coalition.slug}/opengraph-image`) }],
    },
    twitter: {
      card: "summary_large_image",
      title: coalition.name,
      description: coalition.description ?? undefined,
      images: [absoluteUrl(`/c/${coalition.slug}/opengraph-image`)],
    },
  };
}

/**
 * Coalition dashboard.
 *
 * Public by default so a shared link renders for someone with no session.
 * Server-rendered because the progress numbers are the whole point of the
 * page and should be in the first paint, not fetched afterwards.
 */
export default async function CoalitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const coalition = await store.getCoalitionBySlug(slug);
  if (!coalition) notFound();

  const [targets, activity, user] = await Promise.all([
    store.listTargetsForCoalition(coalition.id),
    store.listActivity(coalition.id, 6),
    getSessionUser(),
  ]);

  const resumable = user ? await store.listResumablePledges(user.id) : [];

  // Deliberately no cross-drive contributor count here: donorCount is distinct
  // per target, so summing it would double-count anyone who backed two
  // candidates. Verified dollars are exactly derivable, and more useful.
  const totals = targets.reduce(
    (acc, t) => ({
      raised: acc.raised + t.progress.raisedCents,
      goal: acc.goal + t.progress.goalCents,
      verified: acc.verified + t.progress.confirmedCents,
      attested: acc.attested + t.progress.attestedCents,
    }),
    { raised: 0, goal: 0, verified: 0, attested: 0 },
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
      >
        {resumable.length > 0 && <ResumePledgeBanner pledges={resumable} />}

        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                {coalition.name}
              </h1>
              <CoalitionVerificationBadge
                status={coalition.verificationStatus}
              />
            </div>
            {coalition.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
                {coalition.description}
              </p>
            )}
          </div>

          <div className="shrink-0">
            <ShareActionLink
              url={absoluteUrl(`/c/${coalition.slug}`)}
              title={coalition.name}
              label="Share this coalition"
            />
          </div>
        </header>

        {coalition.verificationStatus === "COMMUNITY_UNVERIFIED" && (
          <div
            role="note"
            className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200 ring-inset"
          >
            <span className="font-bold">Community-created drive.</span>{" "}
            Capital Ark has not independently verified the organizer,
            candidate details, or donation links. Confirm the recipient on the
            processor page before contributing.
          </div>
        )}

        <section
          aria-label="Coalition totals"
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          <Stat label="Raised" value={formatCentsShort(totals.raised)} emphasis />
          <Stat label="Combined goal" value={formatCentsShort(totals.goal)} />
          <Stat
            label="Receipt-backed"
            value={formatCentsShort(totals.verified)}
          />
          <Stat label="Self-reported" value={formatCentsShort(totals.attested)} />
          <Stat label="Active drives" value={String(targets.length)} />
        </section>

        <SourceOfFundsNotice
          className="mt-6"
          candidates={targets.map((t) => t.candidate)}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section
            aria-label="Fundraising drives"
            className="space-y-5 lg:col-span-2"
          >
            <h2 className="text-sm font-bold tracking-tight text-ink-900">
              Fundraising drives
            </h2>

            {targets.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-ink-600">
                  No public drives are available yet.
                </p>
              </Card>
            ) : (
              <div className="space-y-5">
                {targets.map((target) => (
                  <TargetCandidateCard key={target.id} target={target} />
                ))}
              </div>
            )}
          </section>

          <aside className="order-first lg:order-none lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <ActivityFeed items={activity} />
            </div>
          </aside>
        </div>
      </main>

      <DisclaimerFooter />
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p
        className={`mt-1 font-bold tabular-nums ${
          emphasis ? "text-xl text-brand-800 sm:text-2xl" : "text-xl text-ink-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
