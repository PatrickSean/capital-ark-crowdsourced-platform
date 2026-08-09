import Link from "next/link";
import { PLATFORM_DISCLAIMER } from "@/lib/compliance/attestations";

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
              href="/drives"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Explore drives
            </Link>
            <Link
              href="/start"
              className="tap-target inline-flex items-center text-ink-600 hover:text-ink-900"
            >
              Start a drive
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

        <section
          aria-labelledby="open-source-heading"
          className="mt-8 flex flex-col gap-4 rounded-2xl border border-ink-200 bg-ink-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="max-w-2xl">
            <h2
              id="open-source-heading"
              className="text-sm font-semibold text-ink-900"
            >
              Open source
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Capital Ark&rsquo;s source code is public so anyone can review how
              the platform works.
            </p>
          </div>

          <a
            href="https://github.com/PatrickSean/capital-ark-crowdsourced-platform"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Review Capital Ark's open-source code (opens in a new tab)"
            className="tap-target inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-800 sm:w-auto"
          >
            Review the code
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="size-4"
              aria-hidden="true"
            >
              <path
                d="M7 5h8v8M15 5 6 14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </section>

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
