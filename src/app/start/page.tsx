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
    "Create a community fundraising drive for one candidate or an entire slate, then share one link.",
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
              : "Drive creation is temporarily paused"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
            {isDriveCreationEnabled
              ? "Add one candidate or a full slate. You’ll get one shareable link for your community."
              : "Existing drives remain available while new submissions are paused. Please check back shortly."}
          </p>
        </header>

        {isDriveCreationEnabled ? (
          <CoalitionWizard />
        ) : (
          <Card className="p-6 sm:p-8">
            <p className="text-base font-bold text-ink-900">
              Existing drives are still live
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              The pause only affects new submissions. You can still open,
              contribute to, and share every published community drive.
            </p>
            <Link
              href="/"
              className="tap-target mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-brand-700 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-800 sm:w-auto"
            >
              Return home
            </Link>
          </Card>
        )}
      </main>

      <DisclaimerFooter />
    </div>
  );
}
