import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode, store } from "@/lib/data";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { Card } from "@/components/ui/primitives";
import { LayeredProgressBar } from "@/components/targets/layered-progress-bar";
import {
  isDriveCreationEnabled,
  isSupabaseConfigured,
} from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const coalitions = await store.listCoalitions();
  const featuredCoalition =
    coalitions.find((coalition) => coalition.slug === "nc-hemp-industry") ??
    coalitions[0];
  const featured = featuredCoalition
    ? await store.listTargetsForCoalition(featuredCoalition.id)
    : [];

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
              href={
                isDriveCreationEnabled ? "/start" : "/c/nc-hemp-industry"
              }
              className="tap-target inline-flex items-center justify-center rounded-2xl bg-brand-700 px-7 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              {isDriveCreationEnabled
                ? "Start a drive"
                : "Explore the NC hemp drive"}
            </Link>
            {isDriveCreationEnabled && featuredCoalition ? (
              <Link
                href={`/c/${featuredCoalition.slug}`}
                className="tap-target inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
              >
                See a live example
              </Link>
            ) : (
              <Link
                href="/compliance"
                className="tap-target inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
              >
                How tracking works
              </Link>
            )}
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
              title={isDriveCreationEnabled ? "Pick your candidates" : "Review the slate"}
              body={
                isDriveCreationEnabled
                  ? "Add each committee's donation page. Capital Ark recognizes WinRed, ActBlue, and Anedot."
                  : "See each candidate's current office, campaign site, processor, and fundraising goal."
              }
            />
            <HowItWorks
              step="2"
              title="Share one link"
              body="Supporters contribute without creating an account. Every contribution carries your group's tracking code."
            />
            <HowItWorks
              step="3"
              title="Watch the bar move"
              body={
                isSupabaseConfigured
                  ? "Contributors confirm what they gave when they return. Optional receipts distinguish receipt-backed amounts from self-reports."
                  : "Contributors confirm what they gave when they return. The total is clearly labeled as self-reported."
              }
            />
          </div>
        </section>

        {featured.length > 0 && featuredCoalition && (
          <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
            <h2 className="text-sm font-bold tracking-tight text-ink-900">
              Current North Carolina slate
            </h2>
            <div className="mt-3 space-y-3">
              {featured.slice(0, 3).map((target) => (
                <Link key={target.id} href={`/t/${target.slug}`} className="block">
                  <Card className="p-5 transition-shadow hover:shadow-lift">
                    <p className="truncate font-bold text-ink-900">
                      {target.candidate.fullName}
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
              href="/c/nc-hemp-industry"
              className="tap-target mt-4 inline-flex items-center text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-900"
            >
              View all {featured.length} North Carolina drives
            </Link>
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
