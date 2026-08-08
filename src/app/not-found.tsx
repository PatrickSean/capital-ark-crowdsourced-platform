import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-900">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-600">
        The drive may have closed, or the link might have a typo in it.
      </p>
      <Link
        href="/"
        className="tap-target mt-6 inline-flex items-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Back to home
      </Link>
    </div>
  );
}
