import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/data";
import { isDriveCreationEnabled } from "@/lib/auth/config";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionWizard } from "@/components/organizer/coalition-wizard";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Start a drive",
  description:
    "Learn how Capital Ark reviews and launches fundraising drives with verified candidate and committee information.",
  alternates: { canonical: "/start" },
};

export default async function StartPage() {
  await connection();

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12"
      >
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {isDriveCreationEnabled
              ? "Start a fundraising drive"
              : "New drives are reviewed before launch"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
            {isDriveCreationEnabled
              ? "One screen. You’ll have a shareable link at the end."
              : "Capital Ark is beginning with a curated North Carolina drive while organizer verification and review are completed."}
          </p>
        </header>

        {isDriveCreationEnabled ? (
          <CoalitionWizard />
        ) : (
          <Card className="p-6 sm:p-8">
            <p className="text-base font-bold text-ink-900">
              The North Carolina Hemp Industry drive is live
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Every candidate, committee, and donation link in this first slate
              is reviewed before publication. Self-service drive creation will
              open after verified organizer access is ready.
            </p>
            <Link
              href="/c/nc-hemp-industry"
              className="tap-target mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-brand-700 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-800 sm:w-auto"
            >
              Explore the NC hemp drive
            </Link>
          </Card>
        )}
      </main>

      <DisclaimerFooter />
    </div>
  );
}
