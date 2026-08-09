"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCentsShort } from "@/lib/money";
import type { ProgressSnapshot } from "@/lib/domain/types";

/**
 * The layered progress bar.
 *
 * Three segments, ordered by how much we actually know:
 *
 *   verified  — a receipt was attached, or an admin confirmed it
 *   attested  — someone told us they gave, with nothing to back it
 *   pending   — someone clicked through and we don't yet know the outcome
 *
 * Collapsing these into one number would be the easy thing and the dishonest
 * thing. Capital Ark has no access to candidate backends, so the bar has to
 * show its own confidence. The pending segment is hatched rather than merely
 * a different hue, so the distinction survives colour blindness and greyscale.
 */
export function LayeredProgressBar({
  progress,
  size = "md",
  showLegend = true,
  ariaLabel = "Fundraising progress",
  className,
}: {
  progress: ProgressSnapshot;
  size?: "sm" | "md";
  showLegend?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const { goalCents, confirmedCents, attestedCents, pendingCents, raisedCents } =
    progress;

  const pct = (cents: number) =>
    goalCents > 0 ? Math.min(100, (cents / goalCents) * 100) : 0;

  const confirmedPct = pct(confirmedCents);
  const attestedPct = pct(attestedCents);
  // Pending only fills whatever room is left, so the bar can never exceed 100%.
  const pendingPct = Math.max(
    0,
    Math.min(pct(pendingCents), 100 - confirmedPct - attestedPct),
  );

  const animated = useCountUp(raisedCents);
  const height = size === "sm" ? "h-2.5" : "h-4";

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-bold tracking-tight text-ink-900 tabular-nums sm:text-3xl">
          {formatCentsShort(animated)}
          <span className="ml-1.5 text-sm font-medium text-ink-500">
            of {formatCentsShort(goalCents)}
          </span>
        </p>
        <p className="shrink-0 text-sm font-semibold text-brand-700 tabular-nums">
          {progress.percent}%
        </p>
      </div>

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-ink-200",
          height,
        )}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={goalCents / 100}
        aria-valuenow={raisedCents / 100}
        aria-valuetext={`${formatCentsShort(raisedCents)} raised of ${formatCentsShort(goalCents)} goal, ${progress.percent} percent`}
      >
        <div className="flex h-full w-full">
          <Segment
            widthPct={confirmedPct}
            className="bg-verified"
            title={`${formatCentsShort(confirmedCents)} with receipts`}
          />
          <Segment
            widthPct={attestedPct}
            className="bg-attested"
            title={`${formatCentsShort(attestedCents)} self-reported`}
          />
          <Segment
            widthPct={pendingPct}
            className="bg-hatch opacity-70"
            title={`${formatCentsShort(pendingCents)} in progress`}
          />
        </div>
      </div>

      {showLegend && (
        <Legend
          confirmedCents={confirmedCents}
          attestedCents={attestedCents}
          pendingCents={pendingCents}
        />
      )}
    </div>
  );
}

function Segment({
  widthPct,
  className,
  title,
}: {
  widthPct: number;
  className: string;
  title: string;
}) {
  if (widthPct <= 0) return null;
  return (
    <div
      className={cn("h-full transition-[width] duration-700 ease-out", className)}
      style={{ width: `${widthPct}%` }}
      title={title}
    />
  );
}

function Legend({
  confirmedCents,
  attestedCents,
  pendingCents,
}: {
  confirmedCents: number;
  attestedCents: number;
  pendingCents: number;
}) {
  const items = [
    {
      show: confirmedCents > 0,
      swatch: "bg-verified",
      label: "With receipts",
      cents: confirmedCents,
    },
    {
      show: attestedCents > 0,
      swatch: "bg-attested",
      label: "Self-reported",
      cents: attestedCents,
    },
    {
      show: pendingCents > 0,
      swatch: "bg-hatch opacity-70",
      label: "In progress",
      cents: pendingCents,
    },
  ].filter((i) => i.show);

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-600">
          <span className={cn("size-2.5 shrink-0 rounded-full", item.swatch)} aria-hidden="true" />
          <span>
            {item.label}{" "}
            <span className="font-semibold text-ink-800 tabular-nums">
              {formatCentsShort(item.cents)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Animates the headline figure toward its new value.
 *
 * Matters more than it looks: when a pledge is confirmed the number visibly
 * climbing is the user's receipt that their action counted. Respects
 * prefers-reduced-motion by snapping instead.
 */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || fromRef.current === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}
