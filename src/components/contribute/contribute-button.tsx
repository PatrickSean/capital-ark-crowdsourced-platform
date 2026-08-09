"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { describeReferenceLink } from "@/lib/reference-link";
import type { ProgressSnapshot, TargetView } from "@/lib/domain/types";
import {
  ContributeFlowModal,
  type ContributionEntryPoint,
} from "./contribute-flow-modal";

/**
 * The single primary action on a target.
 *
 * Owns the modal so the card and the target page can both drop it in without
 * duplicating flow state. `autoOpen` is what lets a shared link carrying
 * `?amount=50` land the visitor one tap from the processor, and what lets the
 * resume banner reopen a half-finished pledge straight into confirmation.
 */
export function ContributeButton({
  target,
  size = "lg",
  autoOpen = false,
  initialAmountCents,
  resumePledgeId,
  label,
  compactPendingState = false,
  receiptReviewAvailable = false,
  onProgressChange,
}: {
  target: TargetView;
  size?: "sm" | "md" | "lg";
  autoOpen?: boolean;
  initialAmountCents?: number | null;
  resumePledgeId?: string | null;
  label?: string;
  /** Use the one-line "needs a link" state, for lists of many drives. */
  compactPendingState?: boolean;
  /** Server-derived capability; no provider secret is exposed to the client. */
  receiptReviewAvailable?: boolean;
  onProgressChange?: (progress: ProgressSnapshot) => void;
}) {
  // Seeded from the prop rather than opened in an effect: autoOpen is decided
  // server-side from the URL and never changes, so a shared "?amount=50" link
  // renders with the modal already open instead of flashing the page first.
  const [open, setOpen] = useState(autoOpen);
  const [entryPoint, setEntryPoint] =
    useState<ContributionEntryPoint>("donate");

  const openFlow = (nextEntryPoint: ContributionEntryPoint) => {
    setEntryPoint(nextEntryPoint);
    setOpen(true);
  };

  const { donationUrl, platform, websiteUrl, fullName } = target.candidate;
  if (!donationUrl || !platform) {
    return (
      <DonationLinkPending
        name={fullName}
        websiteUrl={websiteUrl}
        compact={compactPendingState}
      />
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button
          size={size}
          fullWidth
          aria-haspopup="dialog"
          onClick={() => openFlow("donate")}
        >
          {label ?? `Contribute to ${fullName}`}
        </Button>
        <Button
          size={size === "lg" ? "md" : size}
          fullWidth
          variant="secondary"
          aria-haspopup="dialog"
          aria-label={`I already contributed to ${fullName}`}
          onClick={() => openFlow("already-contributed")}
        >
          I already contributed
        </Button>
      </div>

      <ContributeFlowModal
        target={target}
        open={open}
        onClose={() => setOpen(false)}
        entryPoint={entryPoint}
        receiptReviewAvailable={receiptReviewAvailable}
        initialAmountCents={initialAmountCents}
        resumePledgeId={resumePledgeId}
        onProgressChange={onProgressChange}
      />
    </>
  );
}

/**
 * Stands in for the contribute button when a target has no processor link.
 *
 * The temptation is to link the campaign's homepage here and call it done, but
 * a homepage can't carry a tracking tag, so a contribution made from it would
 * never reach this drive's total and the donor would think it had. Better to
 * say plainly that the drive isn't ready and let the organizer fix it.
 */
function DonationLinkPending({
  name,
  websiteUrl,
  compact,
}: {
  name: string;
  websiteUrl: string | null;
  compact?: boolean;
}) {
  const reference = websiteUrl ? describeReferenceLink(websiteUrl) : null;

  // In a list, the full paragraph repeats once per drive and turns the page
  // into a wall of identical warnings. One line carries the same fact; the
  // target page still explains it properly.
  if (compact) {
    return (
      <div className="rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-inset ring-amber-200">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <WarningIcon />
          Needs a donation link before it can accept contributions
        </p>
        {reference && websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1.5 ml-6 inline-block text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            {reference.label}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <WarningIcon />
        Not ready for contributions yet
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
        {name}&rsquo;s official donation page hasn&rsquo;t been added to this
        drive, so there&rsquo;s nowhere for us to send you and no way to credit
        the contribution back here.
      </p>
      {reference && websiteUrl && (
        <div className="mt-3 border-t border-amber-200 pt-3">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            {reference.label}
          </a>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {reference.hint}
          </p>
        </div>
      )}
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
