"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCentsShort } from "@/lib/money";
import type { ResumablePledge } from "@/lib/domain/types";

/**
 * The safety net for a user who never came back.
 *
 * Return detection covers the normal case, but people close laptops, get
 * interrupted, and reopen the site on a different device. Without this, their
 * contribution silently sits in the pending segment forever. Dismissible,
 * because nagging someone who genuinely didn't contribute is worse than
 * losing the data point.
 */
export function ResumePledgeBanner({
  pledges,
}: {
  pledges: ResumablePledge[];
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = pledges.filter((p) => !dismissed.includes(p.pledgeId));

  if (visible.length === 0) return null;
  const pledge = visible[0];

  return (
    <div className="mb-5 animate-rise rounded-card bg-amber-50 p-4 shadow-card ring-1 ring-amber-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 10.586V7z"
              clipRule="evenodd"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Finish confirming your {formatCentsShort(pledge.amountCents)} to{" "}
              {pledge.candidateName}
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              We opened the donation page but never heard back. Did it go
              through?
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/t/${pledge.targetSlug}?resume=${pledge.pledgeId}`}
            className="tap-target inline-flex items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950"
          >
            Confirm now
          </Link>
          <button
            type="button"
            onClick={() => setDismissed((d) => [...d, pledge.pledgeId])}
            className="tap-target rounded-xl px-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
