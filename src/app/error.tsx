"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-card ring-1 ring-ink-100 sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-900">
          !
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-900">
          Something didn&rsquo;t load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Try this page again. If the problem continues, return to the campaign
          and choose the drive you were viewing.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="tap-target flex flex-1 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Try again
          </button>
          <Link
            href="/c/nc-hemp-industry"
            className="tap-target flex flex-1 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
          >
            View campaign
          </Link>
        </div>
      </div>
    </main>
  );
}
