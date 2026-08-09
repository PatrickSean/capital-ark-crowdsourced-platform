import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode, store } from "@/lib/data";
import {
  ActivityType,
  ContributionEvidenceType,
} from "@/generated/prisma/enums";
import type { ActivityItem } from "@/lib/domain/types";
import { formatCentsShort } from "@/lib/money";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionVerificationBadge } from "@/components/coalitions/coalition-verification-badge";
import { Card, relativeTime } from "@/components/ui/primitives";
import { LayeredProgressBar } from "@/components/targets/layered-progress-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const coalitions = await store.listCoalitions();
  const featuredCoalition =
    coalitions.find(
      (coalition) => coalition.verificationStatus === "PLATFORM_VERIFIED",
    ) ?? coalitions[0];
  const activityCoalitions = isDemoMode
    ? coalitions
    : coalitions.filter(
        (coalition) => coalition.verificationStatus === "PLATFORM_VERIFIED",
      );
  const [featured, activityGroups] = await Promise.all([
    featuredCoalition
      ? store.listTargetsForCoalition(featuredCoalition.id)
      : Promise.resolve([]),
    Promise.all(
      activityCoalitions
        .slice(0, 8)
        .map((coalition) => store.listActivity(coalition.id, 6)),
    ),
  ]);
  const recentActivity = activityGroups
    .flat()
    .filter((item) => item.type !== ActivityType.MEMBER_JOINED)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main id="main-content" className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
            Non-partisan fundraising infrastructure
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-ink-900 sm:text-5xl">
            Set a goal. Share one link. Watch it fill.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-ink-600 sm:text-lg">
            Capital Ark gives communities one place to coordinate support for
            the candidates they choose. Contributions go straight to each
            committee&rsquo;s own processor. We never touch the money.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/start"
              className="tap-target inline-flex items-center justify-center rounded-2xl bg-brand-700 px-7 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Start a drive
            </Link>
            <Link
              href="/drives"
              className="tap-target inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
            >
              Explore drives
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="how-it-works-heading"
          className="mx-auto max-w-5xl px-4 pb-12 sm:px-6"
        >
          <h2 id="how-it-works-heading" className="sr-only">
            How Capital Ark works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <HowItWorks
              step="1"
              title="Build your candidate slate"
              body="Start with each candidate's official donation page and a clear goal. Community-created drives publish with an unverified label until human review."
            />
            <HowItWorks
              step="2"
              title="Share one link"
              body="Supporters contribute without creating an account. Every contribution carries your group's tracking code."
            />
            <HowItWorks
              step="3"
              title="Watch the bar move"
              body="Supporters upload a receipt after contributing. Only receipts that match the recipient, processor, amount, and date move the public total."
            />
          </div>
        </section>

        <section
          aria-label="Capital Ark in action"
          className="mx-auto max-w-5xl px-4 pb-16 sm:px-6"
        >
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
            {featured.length > 0 && featuredCoalition && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">
                    Featured live example
                  </p>
                  <CoalitionVerificationBadge
                    status={featuredCoalition.verificationStatus}
                  />
                </div>
                <div className="mt-2 sm:flex sm:items-end sm:justify-between sm:gap-6">
                  <div>
                    <h2
                      id="featured-case-study-heading"
                      className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl"
                    >
                      {featuredCoalition.name}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                      See how a community can organize a public candidate slate
                      while every contribution stays with the recipient
                      committee.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {featured.slice(0, 3).map((target) => (
                    <Link
                      key={target.id}
                      href={`/t/${target.slug}`}
                      aria-label={`View the fundraising drive for ${target.candidate.fullName}`}
                      className="group block rounded-card"
                    >
                      <Card className="p-5 transition-shadow group-hover:shadow-lift">
                        <p className="truncate font-bold text-ink-900">
                          {target.candidate.fullName}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-600">
                          {target.candidate.office}
                        </p>
                        <div className="mt-3">
                          <LayeredProgressBar
                            progress={target.progress}
                            size="sm"
                            showLegend={false}
                            ariaLabel={`Fundraising progress for ${target.candidate.fullName}`}
                          />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/c/${featuredCoalition.slug}`}
                  className="tap-target mt-4 inline-flex items-center text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-900"
                >
                  View all {featured.length} drives in this coalition
                </Link>
              </div>
            )}

            <PrivacySafeActivity items={recentActivity} demoMode={isDemoMode} />
          </div>
        </section>
      </main>

      <DisclaimerFooter />
    </div>
  );
}

function PrivacySafeActivity({
  items,
  demoMode,
}: {
  items: ActivityItem[];
  demoMode: boolean;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">
        Community momentum
      </p>
      <h2 className="mt-2 text-lg font-bold tracking-tight text-ink-900">
        Recent activity
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
        {demoMode
          ? "Illustrative activity from the in-memory demo dataset."
          : "Public updates appear here without contributor names."}
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100 ring-inset">
          <p className="text-sm font-semibold text-ink-800">
            The first update starts here.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Confirmed contributions and newly published drives will appear
            without identifying contributors.
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-ink-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-ink-800">
                  <SafeActivityMessage item={item} hideCandidate={demoMode} />
                </p>
                <time
                  dateTime={item.createdAt}
                  className="mt-1 block text-xs text-ink-500"
                >
                  {relativeTime(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SafeActivityMessage({
  item,
  hideCandidate,
}: {
  item: ActivityItem;
  hideCandidate: boolean;
}) {
  const candidate = !hideCandidate && item.candidateName;

  if (item.type === ActivityType.PLEDGE_CONFIRMED) {
    return (
      <>
        A supporter {safeContributionEvidence(item)}
        {candidate && (
          <>
            {" "}
            for <span className="font-semibold text-ink-900">{candidate}</span>
          </>
        )}
        .
      </>
    );
  }

  if (item.type === ActivityType.GOAL_REACHED) {
    return (
      <>
        A fundraising goal was reached
        {candidate && (
          <>
            {" "}
            for <span className="font-semibold text-ink-900">{candidate}</span>
          </>
        )}
        .
      </>
    );
  }

  return (
    <>
      A new candidate drive was published
      {candidate && (
        <>
          {" "}
          for <span className="font-semibold text-ink-900">{candidate}</span>
        </>
      )}
      .
    </>
  );
}

function safeContributionEvidence(item: ActivityItem) {
  const amount = item.amountCents !== null && (
    <span className="font-semibold text-ink-900 tabular-nums">
      {formatCentsShort(item.amountCents)}
    </span>
  );

  if (item.evidenceType === ContributionEvidenceType.RECEIPT_AI_CHECKED) {
    return (
      <>
        added an AI-checked receipt for{" "}
        {amount ? <>a {amount} contribution</> : "a contribution"}
      </>
    );
  }

  if (item.evidenceType === ContributionEvidenceType.RECEIPT_ATTACHED) {
    return (
      <>
        added{" "}
        {amount
          ? <>a receipt-backed {amount} contribution</>
          : "a receipt-backed contribution"}
      </>
    );
  }

  return (
    <>
      reported {amount ? <>a {amount} contribution</> : "a contribution"}
    </>
  );
}

function HowItWorks({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-5">
      <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
        {step}
      </span>
      <h3 className="mt-3 font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
    </Card>
  );
}
