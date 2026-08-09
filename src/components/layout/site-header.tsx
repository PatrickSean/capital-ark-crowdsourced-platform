import Link from "next/link";
import { isDriveCreationEnabled } from "@/lib/auth/config";

export function SiteHeader({ demoMode }: { demoMode?: boolean }) {
  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[60] -translate-y-24 rounded-xl bg-ink-950 px-4 py-3 text-sm font-semibold text-white shadow-lift transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>

      {demoMode && (
        <div className="bg-ink-900 px-4 py-2 text-center text-xs font-medium text-ink-100">
          Demo mode — data is in memory and resets on restart. Set{" "}
          <code className="font-mono text-brand-300">DATABASE_URL</code> to
          connect a real database.
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="tap-target flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-black text-white">
              CA
            </span>
            <span className="text-base font-bold tracking-tight text-ink-900">
              Capital Ark
            </span>
          </Link>

          <Link
            href={isDriveCreationEnabled ? "/start" : "/c/nc-hemp-industry"}
            className="tap-target inline-flex items-center rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          >
            {isDriveCreationEnabled ? "Start a drive" : "View campaign"}
          </Link>
        </div>
      </header>
    </>
  );
}
