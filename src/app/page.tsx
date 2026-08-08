import Link from "next/link";
import { isDemoMode, store } from "@/lib/data";
import { formatCentsShort } from "@/lib/money";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { Card } from "@/components/ui/primitives";
import { LayeredProgressBar } from "@/components/targets/layered-progress-bar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const coalitions = await store.listCoalitions();
  const featured = coalitions[0]
    ? await store.listTargetsForCoalition(coalitions[0].id)
    : [];

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
            Non-partisan fundraising infrastructure
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-ink-900 sm:text-5xl">
            Set a goal. Share one link. Watch it fill.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-ink-600 sm:text-lg">
            Capital Ark lets any group run a collective fundraising drive for
            the candidates they choose. Contributions go straight to each
            committee&rsquo;s own official processor. We never touch the money.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/start"
              className="tap-target inline-flex items-center justify-center rounded-2xl bg-brand-700 px-7 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Start a drive
            </Link>
            {coalitions[0] && (
              <Link
                href={`/c/${coalitions[0].slug}`}
                className="tap-target inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
              >
                See a live example
              </Link>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <HowItWorks
              step="1"
              title="Pick your candidates"
              body="Paste their official donation link. We detect whether it's WinRed, ActBlue, or Anedot automatically."
            />
            <HowItWorks
              step="2"
              title="Share one link"
              body="Supporters contribute without creating an account. Every contribution carries your group's tracking code."
            />
            <HowItWorks
              step="3"
              title="Watch the bar move"
              body="Contributors confirm what they gave when they come back. Receipts move a contribution into the verified segment."
            />
          </div>
        </section>

        {featured.length > 0 && coalitions[0] && (
          <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
            <h2 className="text-sm font-bold tracking-tight text-ink-900">
              Live on Capital Ark
            </h2>
            <div className="mt-3 space-y-3">
              {featured.slice(0, 3).map((target) => (
                <Link key={target.id} href={`/t/${target.slug}`} className="block">
                  <Card className="p-5 transition-shadow hover:shadow-lift">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-bold text-ink-900">
                        {target.candidate.fullName}
                      </p>
                      <p className="shrink-0 text-sm text-ink-500">
                        {formatCentsShort(target.progress.raisedCents)} of{" "}
                        {formatCentsShort(target.goalCents)}
                      </p>
                    </div>
                    <div className="mt-3">
                      <LayeredProgressBar
                        progress={target.progress}
                        size="sm"
                        showLegend={false}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <DisclaimerFooter />
    </div>
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
