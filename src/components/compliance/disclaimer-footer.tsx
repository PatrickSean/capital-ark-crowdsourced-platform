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

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="text-ink-600 hover:text-ink-900">
              Home
            </Link>
            <Link href="/start" className="text-ink-600 hover:text-ink-900">
              Start a drive
            </Link>
            <Link href="/compliance" className="text-ink-600 hover:text-ink-900">
              Compliance
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-ink-100 pt-6">
          <ul className="space-y-2.5">
            {PLATFORM_DISCLAIMER.full.map((clause) => (
              <li key={clause} className="text-xs leading-relaxed text-ink-500">
                {clause}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
