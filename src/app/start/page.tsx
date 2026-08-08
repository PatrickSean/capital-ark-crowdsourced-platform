import type { Metadata } from "next";
import { isDemoMode } from "@/lib/data";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { CoalitionWizard } from "@/components/organizer/coalition-wizard";

export const metadata: Metadata = {
  title: "Start a drive",
  description:
    "Set a fundraising goal for a candidate, get a shareable link, and track contributions your group makes on the candidate's own official processor.",
};

export default function StartPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Start a fundraising drive
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
            One screen. You&rsquo;ll have a shareable link at the end.
          </p>
        </header>

        <CoalitionWizard />
      </main>

      <DisclaimerFooter />
    </div>
  );
}
