export default function Loading() {
  return (
    <div className="min-h-dvh bg-ink-50" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Capital Ark</span>
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-ink-200" />
          <div className="h-11 w-28 animate-pulse rounded-xl bg-ink-200" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-ink-200" />
        <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-ink-200" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse rounded-card bg-white shadow-card ring-1 ring-ink-100"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
