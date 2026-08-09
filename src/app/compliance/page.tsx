import type { Metadata } from "next";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { Card } from "@/components/ui/primitives";
import {
  ATTESTATIONS,
  CURRENT_ATTESTATION_VERSION,
  PLATFORM_DISCLAIMER,
} from "@/lib/compliance/attestations";

export const metadata: Metadata = {
  title: "Compliance",
  description:
    "How Capital Ark stays a non-custodial, non-partisan software vendor, and what contributors attest to.",
  alternates: { canonical: "/compliance" },
};

export default async function CompliancePage() {
  await connection();

  const federalAttestation = ATTESTATIONS[CURRENT_ATTESTATION_VERSION];
  const ncAttestation = ATTESTATIONS["2026-01-nc-v1"];

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12"
      >
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          Compliance
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
          What Capital Ark is, what it deliberately is not, and what
          contributors are asked to confirm.
        </p>

        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink-900">
            What this platform does
          </h2>
          <ul className="mt-3 space-y-3">
            {PLATFORM_DISCLAIMER.full.map((clause) => (
              <li key={clause} className="text-sm leading-relaxed text-ink-700">
                {clause}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink-900">Zero custody</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            There is no column anywhere in this platform&rsquo;s database for a
            card number, a payment token, or an account balance. Contributions
            are made on the recipient committee&rsquo;s own processor, and the
            only thing Capital Ark adds is a tracking parameter on the link.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            Because of that, we also have no way to observe whether a
            contribution succeeded. Every figure on this site comes from what
            contributors tell us afterwards.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            {isSupabaseConfigured
              ? "When optional receipt upload is enabled, the progress bar separates receipt-backed amounts from self-reported ones."
              : "In the current launch mode, confirmed contributions are shown as self-reported; receipt upload is not enabled."}
          </p>
        </Card>

        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink-900">
            Federal contributions
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Version {federalAttestation.version}, effective{" "}
            {federalAttestation.effective}. Each pledge records which version
            was shown at the time.
          </p>
          <ul className="mt-3 space-y-2.5">
            {federalAttestation.clauses.map((clause) => (
              <li
                key={clause}
                className="border-l-2 border-ink-200 pl-3 text-sm leading-relaxed text-ink-700"
              >
                {clause}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink-900">
            North Carolina state contributions
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Version {ncAttestation.version}, effective {ncAttestation.effective}.
            North Carolina&rsquo;s personal-funds rules are shown for state
            candidates instead of the federal statement.
          </p>
          <ul className="mt-3 space-y-2.5">
            {ncAttestation.clauses.map((clause) => (
              <li
                key={clause}
                className="border-l-2 border-amber-200 pl-3 text-sm leading-relaxed text-ink-700"
              >
                {clause}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink-900">
            Automatic charges are blocked
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Some processors support parameters that charge a saved payment
            method the instant a link is opened, with no confirmation screen.
            Capital Ark strips those parameters from every link it generates,
            including from URLs supplied by organizers. Nobody using this
            platform can be charged without seeing a donation form first.
          </p>
        </Card>

      </main>

      <DisclaimerFooter />
    </div>
  );
}
