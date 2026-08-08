import { cn } from "@/lib/cn";

/**
 * Deadline urgency. Turns amber inside a week and red on the last day, since
 * "12 days left" and "today" should not look the same at a glance.
 */
export function DeadlinePill({
  daysRemaining,
  className,
}: {
  daysRemaining: number | null;
  className?: string;
}) {
  if (daysRemaining === null) return null;

  const tone =
    daysRemaining <= 1
      ? "bg-red-50 text-red-800"
      : daysRemaining <= 7
        ? "bg-amber-50 text-amber-800"
        : "bg-ink-100 text-ink-700";

  const label =
    daysRemaining === 0
      ? "Ends today"
      : daysRemaining === 1
        ? "1 day left"
        : `${daysRemaining} days left`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone,
        className,
      )}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 10.586V7z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
