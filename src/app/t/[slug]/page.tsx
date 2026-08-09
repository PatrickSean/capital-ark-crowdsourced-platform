import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode, store } from "@/lib/data";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/site";
import { formatCentsShort, parseAmountToCents } from "@/lib/money";
import { PLATFORM_LABELS } from "@/lib/tracking/link-builder";
import { isExpiredPendingPledge } from "@/lib/pledge-expiry";
import { isAiReceiptReviewConfigured } from "@/lib/receipts/config";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionVerificationBadge } from "@/components/coalitions/coalition-verification-badge";
import { SourceOfFundsNotice } from "@/components/compliance/source-of-funds-notice";
import { LayeredProgressBar } from "@/components/targets/layered-progress-bar";
import { DeadlinePill } from "@/components/targets/deadline-pill";
import { Avatar } from "@/components/targets/target-candidate-card";
import { ContributeButton } from "@/components/contribute/contribute-button";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ShareActionLink } from "@/components/share/share-action-link";
import {
  Card,
  PartyBadge,
  ProcessorBadge,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const target = await store.getTargetBySlug(slug);
  if (!target) return { title: "Drive not found" };

  const description = `${target.coalition.name} has raised ${formatCentsShort(
    target.progress.raisedCents,
  )} of ${formatCentsShort(target.goalCents)} for ${target.candidate.fullName}.`;

  return {
    title: target.title,
    description,
    alternates: { canonical: `/t/${target.slug}` },
    openGraph: {
      title: target.title,
      description,
      url: absoluteUrl(`/t/${target.slug}`),
      images: [{ url: absoluteUrl(`/t/${target.slug}/opengraph-image`) }],
    },
    twitter: {
      card: "summary_large_image",
      title: target.title,
      description,
      images: [absoluteUrl(`/t/${target.slug}/opengraph-image`)],
    },
  };
}

/**
 * Public target page — where every shared link lands.
 *
 * No auth, no gate. `?amount=` preselects and auto-opens the flow, so a link
 * that says "give $50" is genuinely one tap from the processor. `?resume=`
 * reopens a half-finished pledge straight into the confirmation step.
 */
export default async function TargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ amount?: string; resume?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const target = await store.getTargetBySlug(slug);
  if (!target) notFound();

  // Start this independent read immediately. Target pages stay server-rendered,
  // so recent support is useful in the first paint without client-side fetches.
  const activityPromise = store.listActivityForTarget(target.id, 6);

  const requestedAmount = query.amount ? parseAmountToCents(query.amount) : null;

  // Only honour ?resume= for a pledge the current visitor actually owns, so a
  // shared URL can't drop someone into a stranger's pledge.
  let resumePledgeId: string | null = null;
  let resumeAmountCents: number | null = null;
  if (query.resume) {
    const user = await getSessionUser();
    if (user) {
      const pledge = await store.getPledge(query.resume);
      if (
        pledge &&
        pledge.userId === user.id &&
        pledge.targetId === target.id &&
        pledge.status === "PENDING" &&
        !isExpiredPendingPledge(pledge.createdAt)
      ) {
        resumePledgeId = pledge.id;
        resumeAmountCents = pledge.amountCents;
      }
    }
  }

  const { candidate, coalition, progress } = target;
  const activity = await activityPromise;

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/c/${coalition.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
            {coalition.name}
          </Link>
          <CoalitionVerificationBadge
            status={coalition.verificationStatus}
          />
        </div>

        {coalition.verificationStatus === "COMMUNITY_UNVERIFIED" && (
          <div
            role="note"
            className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200 ring-inset"
          >
            <span className="font-bold">Community-created drive.</span>{" "}
            Candidate details and this donation link have not been
            independently verified by Capital Ark. Confirm the recipient on
            the processor page before contributing.
          </div>
        )}

        <Card className="mt-4 overflow-hidden">
          <div className="p-5 sm:p-7">
            <div className="flex items-start gap-4 sm:gap-5">
              <Avatar name={candidate.fullName} photoUrl={candidate.photoUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
                  {candidate.fullName}
                </h1>
                <p className="mt-0.5 text-sm text-ink-600">
                  {candidate.office}
                  {candidate.district ? ` · ${candidate.district}` : ""}
                  {candidate.state && !candidate.district ? ` · ${candidate.state}` : ""}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <PartyBadge party={candidate.party} />
                  <ProcessorBadge platform={candidate.platform} />
                  {candidate.donationUrl && candidate.websiteUrl && (
                    <a
                      href={candidate.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`Open ${candidate.fullName}'s campaign site`}
                      className="tap-target inline-flex items-center text-xs font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800"
                    >
                      Campaign site
                    </a>
                  )}
                </div>
                {(candidate.officialDataVerifiedAt ||
                  candidate.donationUrlVerifiedAt) && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">
                    {candidate.officialDataVerifiedAt &&
                    candidate.donationUrlVerifiedAt
                      ? "Candidate details and donation link checked"
                      : candidate.officialDataVerifiedAt
                        ? "Candidate details checked"
                        : "Donation link checked"}{" "}
                    {formatVerificationDate(
                      candidate.donationUrlVerifiedAt ??
                        candidate.officialDataVerifiedAt,
                    )}
                    {candidate.officialProfileUrl && (
                      <>
                        {" · "}
                        <a
                          href={candidate.officialProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                          aria-label={`Open the official government profile for ${candidate.fullName}`}
                        >
                          Official profile
                        </a>
                      </>
                    )}
                    {(candidate.ncsbeCommitteeId ||
                      candidate.fecCommitteeId) && (
                      <>
                        {" · "}
                        {candidate.ncsbeCommitteeId
                          ? `NCSBE ${candidate.ncsbeCommitteeId}`
                          : `FEC ${candidate.fecCommitteeId}`}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {candidate.bio && (
              <p className="mt-5 text-sm leading-relaxed text-ink-700">
                {candidate.bio}
              </p>
            )}

            <hr className="my-6 border-ink-100" />

            <h2 className="text-base font-bold tracking-tight text-ink-900">
              {target.title}
            </h2>
            {target.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                {target.description}
              </p>
            )}

            <div className="mt-5">
              <LayeredProgressBar
                progress={progress}
                ariaLabel={`Fundraising progress for ${candidate.fullName}`}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600">
              <span>
                <span className="font-semibold text-ink-900">
                  {progress.donorCount}
                </span>{" "}
                {progress.donorCount === 1 ? "contributor" : "contributors"}
              </span>
              <DeadlinePill daysRemaining={progress.daysRemaining} />
            </div>
          </div>

          {/* Sticky on mobile so the single primary action is always reachable
              no matter how far the user has scrolled. */}
          <div className="sticky bottom-0 space-y-3 border-t border-ink-100 bg-white/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <ContributeButton
              target={target}
              autoOpen={requestedAmount !== null || resumePledgeId !== null}
              initialAmountCents={resumeAmountCents ?? requestedAmount}
              resumePledgeId={resumePledgeId}
              receiptReviewAvailable={
                isAiReceiptReviewConfigured() &&
                Boolean(candidate.donationUrlVerifiedAt)
              }
            />
            {candidate.platform && (
              <p className="text-center text-xs text-ink-500">
                Paid directly to{" "}
                {candidate.committeeName ?? candidate.fullName} on{" "}
                {PLATFORM_LABELS[candidate.platform]}. Capital Ark never handles
                your money.
              </p>
            )}
          </div>
        </Card>

        <SourceOfFundsNotice className="mt-5" candidates={[candidate]} />

        <div className="mt-5">
          <ActivityFeed items={activity} scope="target" />
        </div>

        <div className="mt-5 flex justify-center">
          <ShareActionLink
            url={absoluteUrl(`/t/${target.slug}`)}
            title={target.title}
            label="Share this drive"
          />
        </div>
      </main>

      <DisclaimerFooter />
    </div>
  );
}

function formatVerificationDate(value: string | null): string {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
