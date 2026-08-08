"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { platformLabel } from "@/lib/tracking/link-builder";
import { getAttestation, HANDOFF_NOTICE } from "@/lib/compliance/attestations";
import type { Platform } from "@/generated/prisma/enums";

/**
 * Shown directly above the outbound button.
 *
 * A disclaimer buried in the footer is legally present and practically
 * invisible. This is the one the user actually reads, because it's between
 * them and the button they intend to press.
 */
export function HandoffNotice({
  platform,
  committeeName,
  className,
}: {
  platform: Platform | null;
  committeeName: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-ink-50 p-3.5 ring-1 ring-inset ring-ink-200",
        className,
      )}
    >
      <p className="text-xs leading-relaxed text-ink-600">
        <span className="font-semibold text-ink-800">
          You&rsquo;re leaving Capital Ark.
        </span>{" "}
        Your contribution goes directly to{" "}
        <span className="font-semibold text-ink-800">
          {committeeName ?? "the committee"}
        </span>{" "}
        on {platformLabel(platform)}, their own official processor. We never
        see or handle your payment details.
      </p>
    </div>
  );
}

export { HANDOFF_NOTICE };

/**
 * The FEC self-attestation checkbox.
 *
 * The full clauses sit behind a disclosure rather than a wall of text, but the
 * summary is always visible and the box is never pre-ticked. The version the
 * user agreed to is recorded on the pledge.
 */
export function AttestationCheckbox({
  checked,
  onChange,
  version,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  version: string;
  error?: string | null;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const attestation = getAttestation(version);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex gap-3 rounded-xl p-3 ring-1 ring-inset transition-colors",
          error ? "bg-red-50 ring-red-200" : "bg-ink-50 ring-ink-200",
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${id}-detail`}
          aria-invalid={Boolean(error) || undefined}
          className="mt-0.5 size-5 shrink-0 rounded border-ink-300 text-brand-700 focus:ring-brand-600"
        />
        <div className="min-w-0">
          <label htmlFor={id} className="block text-sm font-medium text-ink-800">
            {attestation.checkboxLabel}
          </label>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={`${id}-detail`}
            className="mt-1 text-xs font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            {expanded ? "Hide the full statement" : "Read the full statement"}
          </button>

          <div
            id={`${id}-detail`}
            hidden={!expanded}
            className="mt-2 space-y-1.5 border-l-2 border-ink-200 pl-3"
          >
            {attestation.clauses.map((clause) => (
              <p key={clause} className="text-xs leading-relaxed text-ink-600">
                {clause}
              </p>
            ))}
            <p className="pt-1 text-[11px] text-ink-400">
              Version {attestation.version}, effective {attestation.effective}.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Compact restatement of the zero-custody model, for inside the modal. */
export function NonCustodyNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-ink-400", className)}>
      Capital Ark is non-partisan software and is not a PAC. We don&rsquo;t
      process, hold, or forward contributions, and we don&rsquo;t endorse
      candidates. Totals here are crowdsourced from contributors, not from any
      campaign&rsquo;s records.
    </p>
  );
}
