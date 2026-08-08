import * as React from "react";
import { cn } from "@/lib/cn";
import { Party } from "@/generated/prisma/enums";
import { PLATFORM_LABELS } from "@/lib/tracking/link-builder";
import type { Platform } from "@/generated/prisma/enums";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-white shadow-card ring-1 ring-ink-100",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "verified" | "warn";
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-50 text-brand-800",
    verified: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const PARTY_META: Record<Party, { label: string; className: string }> = {
  [Party.REPUBLICAN]: { label: "Republican", className: "bg-red-50 text-red-800" },
  [Party.DEMOCRAT]: { label: "Democrat", className: "bg-blue-50 text-blue-800" },
  [Party.INDEPENDENT]: { label: "Independent", className: "bg-ink-100 text-ink-700" },
  [Party.LIBERTARIAN]: { label: "Libertarian", className: "bg-amber-50 text-amber-800" },
  [Party.GREEN]: { label: "Green", className: "bg-emerald-50 text-emerald-800" },
  [Party.OTHER]: { label: "Other", className: "bg-ink-100 text-ink-700" },
};

/** Party is the one place red and blue appear, and only as a factual label. */
export function PartyBadge({ party }: { party: Party }) {
  const meta = PARTY_META[party] ?? PARTY_META[Party.OTHER];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

/** Naming the processor up front is what makes the handoff feel expected. */
export function ProcessorBadge({
  platform,
  className,
}: {
  platform: Platform | null;
  className?: string;
}) {
  // Nothing to name yet. The card shows its own "needs a link" state instead,
  // so an empty badge here would just be a second, quieter version of it.
  if (!platform) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700",
        className,
      )}
    >
      <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden="true">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-800">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-12 w-full rounded-xl bg-white px-3.5 text-base text-ink-900 shadow-sm",
        "ring-1 ring-inset ring-ink-200 placeholder:text-ink-400",
        "focus:ring-2 focus:ring-brand-600 focus:outline-none",
        invalid && "ring-red-400 focus:ring-red-500",
        className,
      )}
      {...props}
    />
  );
});

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse-soft rounded-lg bg-ink-200", className)} />
  );
}

/** Relative time, phrased the way people actually say it. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
