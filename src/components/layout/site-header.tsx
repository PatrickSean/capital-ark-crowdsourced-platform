import Link from "next/link";

export function SiteHeader({ demoMode }: { demoMode?: boolean }) {
  return (
    <>
      {demoMode && (
        <div className="bg-ink-900 px-4 py-2 text-center text-xs font-medium text-ink-100">
          Demo mode — data is in memory and resets on restart. Set{" "}
          <code className="font-mono text-brand-300">DATABASE_URL</code> to
          connect a real database.
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-black text-white">
              CA
            </span>
            <span className="text-base font-bold tracking-tight text-ink-900">
              Capital Ark
            </span>
          </Link>

          <Link
            href="/start"
            className="tap-target inline-flex items-center rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Start a drive
          </Link>
        </div>
      </header>
    </>
  );
}
