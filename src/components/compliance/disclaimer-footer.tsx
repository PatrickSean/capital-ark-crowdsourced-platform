import Link from "next/link";
import { PLATFORM_DISCLAIMER } from "@/lib/compliance/attestations";
import { isDriveCreationEnabled } from "@/lib/auth/config";

export function DisclaimerFooter() {
  return (
    <footer className="mt-16 border-t border-ink-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="text-sm font-bold text-ink-900">Capital Ark</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {PLATFORM_DISCLAIMER.short}
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
          >
            <Link
              href="/"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Home
            </Link>
            <Link
              href={
                isDriveCreationEnabled ? "/start" : "/c/nc-hemp-industry"
              }
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              {isDriveCreationEnabled ? "Start a drive" : "NC hemp drive"}
            </Link>
            <Link
              href="/compliance"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Compliance
            </Link>
            <Link
              href="/privacy"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-ink-100 pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-ink-500">
            Progress is crowdsourced from contributors and is not an official
            campaign total. Eligibility and contribution limits are determined
            by law and reviewed by the recipient committee.
          </p>
        </div>
      </div>
    </footer>
  );
}
