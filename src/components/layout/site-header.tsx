import Link from "next/link";

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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Link href="/" className="tap-target flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-black text-white"
            >
              CA
            </span>
            <span className="text-base font-bold tracking-tight text-ink-900 max-[359px]:sr-only">
              Capital Ark
            </span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/drives"
              className="tap-target inline-flex items-center rounded-xl px-2 text-xs font-semibold text-ink-700 hover:bg-ink-100 hover:text-ink-950 sm:px-3 sm:text-sm"
            >
              Explore drives
            </Link>
            <Link
              href="/start"
              className="tap-target inline-flex items-center rounded-xl bg-ink-900 px-3 text-xs font-semibold text-white hover:bg-ink-800 sm:px-4 sm:text-sm"
            >
              Start a drive
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
