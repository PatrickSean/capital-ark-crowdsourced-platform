export default function EmbedDriveLoading() {
  return (
    <main
      aria-label="Loading community drive"
      className="mx-auto w-full max-w-[760px] p-2 min-[400px]:p-3"
    >
      <div className="overflow-hidden rounded-[1.375rem] bg-white shadow-card ring-1 ring-ink-100">
        <div className="animate-pulse-soft p-4 min-[420px]:p-5">
          <div className="h-8 w-32 rounded-lg bg-ink-100" />
          <div className="mt-5 h-6 w-3/4 rounded-lg bg-ink-200" />
          <div className="mt-2 h-4 w-32 rounded-lg bg-ink-100" />
          <div className="mt-5 h-16 rounded-2xl bg-ink-100" />
          <div className="mt-5 space-y-2">
            <div className="h-16 rounded-2xl bg-ink-100" />
            <div className="h-16 rounded-2xl bg-ink-100" />
          </div>
          <div className="mt-5 h-12 rounded-xl bg-brand-100" />
        </div>
      </div>
    </main>
  );
}
