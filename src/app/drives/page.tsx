import type { Metadata } from "next";
import Link from "next/link";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionVerificationBadge } from "@/components/coalitions/coalition-verification-badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Card } from "@/components/ui/primitives";
import { isDemoMode, store } from "@/lib/data";
import type { CoalitionView, TargetView } from "@/lib/domain/types";
import { formatCentsShort } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore fundraising drives",
  description:
    "Browse public community-led fundraising drives on Capital Ark.",
  alternates: { canonical: "/drives" },
};

export default async function DrivesPage() {
  const coalitions = await store.listCoalitions();
  const entries = await Promise.all(
    coalitions.map(async (coalition) => ({
      coalition,
      targets: await store.listTargetsForCoalition(coalition.id),
    })),
  );
  const directory = entries.filter(({ targets }) => targets.length > 0);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      >
        <header className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
            Public directory
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-ink-900 sm:text-4xl">
            Explore fundraising drives
          </h1>
          <p className="mt-3 text-base leading-relaxed text-pretty text-ink-600 sm:text-lg">
            Browse community-led candidate fundraising drives. Capital Ark
            coordinates the goal and the progress; contributions open each
            committee&rsquo;s own official processor.
          </p>
        </header>

        {directory.length === 0 ? (
          <Card className="mt-8 max-w-2xl p-7 sm:p-8">
            <h2 className="text-lg font-bold text-ink-900">
              No public drives yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Be the first community to publish a candidate fundraising drive.
            </p>
            <Link
              href="/start"
              className="tap-target mt-5 inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Start a drive
            </Link>
          </Card>
        ) : (
          <ul className="mt-9 grid gap-5 lg:grid-cols-2" role="list">
            {directory.map(({ coalition, targets }) => (
              <li key={coalition.id}>
                <CoalitionDirectoryCard coalition={coalition} targets={targets} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <DisclaimerFooter />
    </div>
  );
}

function CoalitionDirectoryCard({
  coalition,
  targets,
}: {
  coalition: CoalitionView;
  targets: TargetView[];
}) {
  const reportedCents = targets.reduce(
    (total, target) => total + target.progress.raisedCents,
    0,
  );

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-ink-600">
        <CoalitionVerificationBadge status={coalition.verificationStatus} />
        <span>
          {targets.length} active {targets.length === 1 ? "drive" : "drives"}
        </span>
        <span aria-hidden="true">&middot;</span>
        <span className="tabular-nums">
          {formatCentsShort(reportedCents)} reported
        </span>
      </div>

      <h2 className="mt-2 text-xl font-bold tracking-tight text-ink-900">
        <Link
          href={`/c/${coalition.slug}`}
          className="tap-target inline-flex items-center hover:text-brand-800"
        >
          {coalition.name}
        </Link>
      </h2>
      {coalition.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
          {coalition.description}
        </p>
      )}

      {targets.length > 0 ? (
        <ul className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
          {targets.slice(0, 3).map((target) => (
            <li key={target.id}>
              <Link
                href={`/t/${target.slug}`}
                aria-label={`View the fundraising drive for ${target.candidate.fullName}`}
                className="tap-target flex items-center justify-between gap-4 py-3 hover:text-brand-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">
                    {target.candidate.fullName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-600">
                    {target.candidate.office}
                    {target.candidate.district
                      ? ` · ${target.candidate.district}`
                      : target.candidate.state
                        ? ` · ${target.candidate.state}`
                        : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-600 tabular-nums">
                  <span className="block font-semibold text-ink-900">
                    {target.progress.percent}%
                  </span>
                  of goal
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl bg-ink-50 p-4 text-sm text-ink-600 ring-1 ring-ink-100 ring-inset">
          This coalition has no active public drives.
        </p>
      )}

      <Link
        href={`/c/${coalition.slug}`}
        className="tap-target mt-4 inline-flex items-center self-start text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-900"
      >
        View coalition
      </Link>
    </Card>
  );
}
