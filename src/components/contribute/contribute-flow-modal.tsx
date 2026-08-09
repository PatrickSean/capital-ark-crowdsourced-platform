"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { ModalSheet } from "@/components/ui/modal-sheet";
import {
  AttestationCheckbox,
  HandoffNotice,
  NonCustodyNote,
} from "@/components/compliance/notices";
import { attestationVersionFor } from "@/lib/compliance/attestations";
import { platformLabel } from "@/lib/tracking/link-builder";
import { formatCents, formatCentsShort, parseAmountToCents } from "@/lib/money";
import { useIdentity } from "@/lib/auth/use-identity";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { cn } from "@/lib/cn";
import type { ProgressSnapshot, TargetView } from "@/lib/domain/types";
import { absoluteUrl } from "@/lib/site";
import {
  openPlaceholderWindow,
  useReturnDetection,
} from "./use-return-detection";
import { ReceiptDropzone, type ReceiptResult } from "./receipt-dropzone";
import { ReceiptCaptureHelp } from "./receipt-capture-help";
import { ClaimAccountCard } from "@/components/account/claim-account-card";

/**
 * The contribute-and-track flow.
 *
 * The normal path is amount → processor → confirmation. Someone who already
 * gave uses the shorter amount → confirmation path and never creates a fake
 * processor click. Every step stays resumable and clearly labeled.
 */
type Step = "amount" | "waiting" | "confirm" | "done";
type ReceiptOutcome =
  | "not-requested"
  | "ai-checked"
  | "needs-review"
  | "unavailable";

export type ContributionEntryPoint = "donate" | "already-contributed";

const MAX_CONTRIBUTION_CENTS = 100_000_00;

export function ContributeFlowModal({
  target,
  open,
  onClose,
  entryPoint = "donate",
  receiptReviewAvailable = false,
  initialAmountCents,
  resumePledgeId,
  onProgressChange,
}: {
  target: TargetView;
  open: boolean;
  onClose: () => void;
  entryPoint?: ContributionEntryPoint;
  receiptReviewAvailable?: boolean;
  initialAmountCents?: number | null;
  /** Set when reopening from the "finish confirming" banner. */
  resumePledgeId?: string | null;
  onProgressChange?: (progress: ProgressSnapshot) => void;
}) {
  const router = useRouter();
  const { ensureIdentity } = useIdentity();

  // Which clauses the contributor sees, and which version we record against
  // the pledge. A North Carolina state race and a federal race do not have the
  // same rules about who may give, so this must follow the candidate.
  const attestationVersion = attestationVersionFor(target.candidate);

  const [step, setStep] = useState<Step>(resumePledgeId ? "confirm" : "amount");
  const [amountCents, setAmountCents] = useState<number>(
    initialAmountCents ??
      target.suggestedAmounts[1] ??
      target.suggestedAmounts[0] ??
      5000,
  );
  const [customAmount, setCustomAmount] = useState("");
  const [pledgeId, setPledgeId] = useState<string | null>(
    resumePledgeId ?? null,
  );
  const [outboundUrl, setOutboundUrl] = useState<string | null>(null);
  const noClickIntentRef = useRef<{
    amountCents: number;
    key: string;
  } | null>(null);

  const [confirmedText, setConfirmedText] = useState("");
  const [editingAmount, setEditingAmount] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const receiptFileRef = useRef<File | null>(null);
  const [receiptEvidenceToken, setReceiptEvidenceToken] = useState<
    string | null
  >(null);
  const [receiptOutcome, setReceiptOutcome] =
    useState<ReceiptOutcome>("not-requested");
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [receiptAiConsent, setReceiptAiConsent] = useState(false);
  const [recordedAmountCents, setRecordedAmountCents] = useState<number | null>(
    null,
  );
  const [attested, setAttested] = useState(false);
  const [attestError, setAttestError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    state: returnState,
    startWatching,
    reset,
    refocusPopup,
    markReturned,
  } = useReturnDetection({
    onReturn: () => setStep("confirm"),
  });

  // Reset everything when the modal is dismissed, so reopening is a clean run
  // rather than a half-finished one. The zero-delay callback keeps state work
  // out of the effect body while still making the next open a clean session.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setStep(resumePledgeId ? "confirm" : "amount");
      setPledgeId(resumePledgeId ?? null);
      setOutboundUrl(null);
      setReceipt(null);
      receiptFileRef.current = null;
      setReceiptEvidenceToken(null);
      setReceiptOutcome("not-requested");
      setEvidenceError(null);
      setReceiptAiConsent(false);
      setRecordedAmountCents(null);
      setAttested(false);
      setAttestError(null);
      setError(null);
      setConfirmedText("");
      setEditingAmount(false);
      reset();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, resumePledgeId, reset]);

  const effectiveConfirmedCents = useCallback(() => {
    if (editingAmount) return parseContributionAmount(confirmedText);
    return amountCents;
  }, [editingAmount, confirmedText, amountCents]);

  /**
   * Step 1 -> 2. The popup is claimed synchronously here, before any await,
   * or the browser will treat the later navigation as an unsolicited popup.
   */
  const handleContribute = useCallback(async () => {
    setError(null);
    const popup = openPlaceholderWindow(
      `Opening ${platformLabel(target.candidate.platform)}…`,
    );

    setBusy(true);
    setStep("waiting");
    startWatching(popup);

    try {
      await ensureIdentity();

      const res = await fetch("/api/targets/generate-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: target.id, amountCents }),
      });

      const payload = await res.json();

      if (!res.ok) {
        popup?.close();
        reset();
        setStep("amount");
        setError(
          payload?.error?.message ?? "We couldn't open the donation page.",
        );
        return;
      }

      setPledgeId(payload.pledgeId);
      setOutboundUrl(payload.outboundUrl);

      if (popup && !popup.closed) {
        popup.location.href = payload.outboundUrl;
      } else {
        // Popup blocked. Rather than dead-ending, hand the user a link they
        // can click themselves, which carries its own user activation.
        setError("popup-blocked");
      }
    } catch {
      popup?.close();
      reset();
      setStep("amount");
      setError(
        "Something went wrong opening the donation page. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [amountCents, ensureIdentity, reset, startWatching, target]);

  /**
   * Starts a normal owned PENDING pledge without logging a processor click.
   * This is for someone who gave before arriving at Capital Ark; it must not
   * pretend they used our tracked outbound link.
   */
  const handleAlreadyContributed = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      await ensureIdentity();

      if (
        !noClickIntentRef.current ||
        noClickIntentRef.current.amountCents !== amountCents
      ) {
        noClickIntentRef.current = {
          amountCents,
          key: window.crypto.randomUUID(),
        };
      }

      const res = await fetch(
        `/api/targets/${encodeURIComponent(target.id)}/pledges`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": noClickIntentRef.current.key,
          },
          body: JSON.stringify({ amountCents }),
        },
      );
      const payload = await res.json();
      const nextPledgeId = payload?.pledge?.id;

      if (!res.ok || typeof nextPledgeId !== "string") {
        setError(
          payload?.error?.message ??
            "We couldn't start the confirmation. Please try again.",
        );
        return;
      }

      setPledgeId(nextPledgeId);
      setStep("confirm");
    } catch {
      setError("We couldn't start the confirmation. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [amountCents, ensureIdentity, target.id]);

  const submitConfirmation = useCallback(
    async (declined: boolean) => {
      if (!pledgeId) {
        setStep("amount");
        return;
      }

      const confirmed = declined ? null : effectiveConfirmedCents();

      if (!declined) {
        if (!receiptReviewAvailable) {
          setEvidenceError(
            "Receipt verification is not available for this recipient yet. Nothing has been added to the drive.",
          );
          return;
        }
        if (!receipt) {
          setEvidenceError(
            "Upload a screenshot of the completed contribution receipt.",
          );
          return;
        }
        if (!receiptAiConsent) {
          setEvidenceError(
            "Agree to the AI receipt check so we can verify the screenshot.",
          );
          return;
        }

        if (confirmed === null) {
          setError("That amount doesn't look right. Enter it like 50 or 50.00.");
          return;
        }

        // Receipt verification is deliberately its own stage. A successful
        // AI check reveals the attestation and final add action; inconclusive
        // or unavailable checks never fall through to public progress.
        if (receiptOutcome !== "ai-checked" || !receiptEvidenceToken) {
          setBusy(true);
          setError(null);
          setEvidenceError(null);
          setAttestError(null);

          try {
            const check = await checkReceipt({
              pledgeId,
              confirmedAmountCents: confirmed,
              receipt,
            });

            setReceiptEvidenceToken(check.evidenceToken);
            setReceiptOutcome(check.outcome);
            setAttested(false);

            if (check.outcome !== "ai-checked") {
              setEvidenceError(check.message);
            }
          } finally {
            setBusy(false);
          }
          return;
        }

        if (!attested) {
          setAttestError(
            "Please confirm the statement above so we can add this receipt-backed contribution.",
          );
          return;
        }
      }

      setBusy(true);
      setError(null);
      setAttestError(null);
      setEvidenceError(null);

      try {
        const res = await fetch("/api/pledges/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pledgeId,
            declined,
            attested: !declined,
            confirmedAmountCents: confirmed,
            receiptEvidenceToken: declined ? null : receiptEvidenceToken,
            attestationVersion,
          }),
        });

        const payload = await res.json();

        if (!res.ok) {
          const errorCode = payload?.error?.code;
          if (
            errorCode === "invalid_receipt_evidence" ||
            errorCode === "receipt_verification_required"
          ) {
            // The short-lived token can expire while the modal remains open.
            // Clear it so the next click performs a fresh check.
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
          } else if (errorCode === "receipt_already_used") {
            // Evidence already claimed for another pledge cannot be retried.
            // Keep the contribution unconfirmed and require another image.
            setReceipt(null);
            receiptFileRef.current = null;
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setReceiptAiConsent(false);
          }
          setError(
            payload?.error?.message ??
              "We couldn't save that. Please try again.",
          );
          return;
        }

        if (payload.progress) onProgressChange?.(payload.progress);

        if (declined) {
          noClickIntentRef.current = null;
          onClose();
          router.refresh();
          return;
        }

        setReceiptOutcome(
          receiptOutcomeFromEvidenceType(payload?.pledge?.evidenceType),
        );
        setRecordedAmountCents(
          payload?.pledge?.confirmedAmountCents ?? confirmed ?? amountCents,
        );
        noClickIntentRef.current = null;
        setStep("done");
        router.refresh();
      } catch {
        setError(
          "Your contribution may have gone through on the committee's site, but we couldn't update this tracker. Please try confirming again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [
      pledgeId,
      attested,
      attestationVersion,
      receipt,
      receiptAiConsent,
      receiptReviewAvailable,
      receiptEvidenceToken,
      receiptOutcome,
      effectiveConfirmedCents,
      amountCents,
      onProgressChange,
      onClose,
      router,
    ],
  );

  const stepIndex =
    step === "amount"
      ? 0
      : entryPoint === "already-contributed"
        ? 1
        : step === "waiting"
          ? 1
          : 2;
  const customAmountIsValid =
    customAmount.trim() === "" || parseContributionAmount(customAmount) !== null;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={stepTitle(step, target, entryPoint)}
      dismissible={!busy}
      footer={
        <ModalFooter
          step={step}
          busy={busy}
          amountCents={amountCents}
          amountIsValid={customAmountIsValid}
          entryPoint={entryPoint}
          receiptVerified={
            receiptOutcome === "ai-checked" && Boolean(receiptEvidenceToken)
          }
          receiptOutcome={receiptOutcome}
          receiptReviewAvailable={receiptReviewAvailable}
          onContribute={handleContribute}
          onContinueAlready={handleAlreadyContributed}
          onConfirm={() => submitConfirmation(false)}
          onDecline={() => submitConfirmation(true)}
          onDone={onClose}
          onReopen={() => outboundUrl && refocusPopup(outboundUrl)}
          onSkipWait={markReturned}
          returnState={returnState}
        />
      }
    >
      {step !== "done" && (
        <StepIndicator current={stepIndex} entryPoint={entryPoint} />
      )}

      {error && error !== "popup-blocked" && (
        <div
          role="alert"
          className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-inset ring-red-200"
        >
          {error}
        </div>
      )}

      {step === "amount" && (
        <AmountStep
          target={target}
          amountCents={amountCents}
          onSelect={setAmountCents}
          customAmount={customAmount}
          onCustomAmount={setCustomAmount}
          entryPoint={entryPoint}
        />
      )}

      {step === "waiting" && (
        <WaitingStep
          target={target}
          amountCents={amountCents}
          popupBlocked={error === "popup-blocked"}
          outboundUrl={outboundUrl}
        />
      )}

      {step === "confirm" && (
        <ConfirmStep
          target={target}
          entryPoint={entryPoint}
          attestationVersion={attestationVersion}
          amountCents={amountCents}
          editingAmount={editingAmount}
          onEditAmount={() => {
            setEditingAmount(true);
            setConfirmedText((amountCents / 100).toFixed(2));
          }}
          confirmedText={confirmedText}
          onConfirmedText={(value) => {
            setConfirmedText(value);
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setAttested(false);
          }}
          receipt={receipt}
          receiptOutcome={receiptOutcome}
          receiptVerified={
            receiptOutcome === "ai-checked" && Boolean(receiptEvidenceToken)
          }
          receiptReviewAvailable={receiptReviewAvailable}
          busy={busy}
          evidenceError={evidenceError}
          receiptAiConsent={receiptAiConsent}
          onReceiptAiConsent={(consented) => {
            setReceiptAiConsent(consented);
            if (consented) {
              setEvidenceError(null);
            } else {
              setReceiptEvidenceToken(null);
              setReceiptOutcome("not-requested");
              setAttested(false);
            }
          }}
          onReceipt={(nextReceipt) => {
            const isNewImage = receiptFileRef.current !== nextReceipt.file;
            receiptFileRef.current = nextReceipt.file;
            setReceipt(nextReceipt);
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setEvidenceError(null);
            setAttested(false);
            if (isNewImage) setReceiptAiConsent(false);
          }}
          onClearReceipt={() => {
            setReceipt(null);
            receiptFileRef.current = null;
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setReceiptAiConsent(false);
            setAttested(false);
          }}
          attested={attested}
          onAttested={(v) => {
            setAttested(v);
            if (v) setAttestError(null);
          }}
          attestError={attestError}
        />
      )}

      {step === "done" && (
        <DoneStep
          target={target}
          amountCents={recordedAmountCents ?? amountCents}
        />
      )}
    </ModalSheet>
  );
}

function stepTitle(
  step: Step,
  target: TargetView,
  entryPoint: ContributionEntryPoint,
): string {
  switch (step) {
    case "amount":
      return entryPoint === "already-contributed"
        ? "Add a contribution you already made"
        : `Contribute to ${target.candidate.fullName}`;
    case "waiting":
      return "Finish on the donation page";
    case "confirm":
      return entryPoint === "already-contributed"
        ? `Verify your contribution to ${target.candidate.fullName}`
        : "Verify your contribution";
    case "done":
      return "Receipt-backed contribution added";
  }
}

/** Always-visible progress through the flow, so nobody feels lost mid-handoff. */
function StepIndicator({
  current,
  entryPoint,
}: {
  current: number;
  entryPoint: ContributionEntryPoint;
}) {
  const steps =
    entryPoint === "already-contributed"
      ? ["Amount", "Verify"]
      : ["Amount", "Donate", "Verify"];
  return (
    <ol
      className="mb-4 flex items-center gap-2"
      aria-label={`Progress: step ${current + 1} of ${steps.length}`}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  done || active ? "bg-brand-600" : "bg-ink-200",
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  active
                    ? "text-brand-700"
                    : done
                      ? "text-ink-600"
                      : "text-ink-500",
                )}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AmountStep({
  target,
  amountCents,
  onSelect,
  customAmount,
  onCustomAmount,
  entryPoint,
}: {
  target: TargetView;
  amountCents: number;
  onSelect: (cents: number) => void;
  customAmount: string;
  onCustomAmount: (value: string) => void;
  entryPoint: ContributionEntryPoint;
}) {
  const isCustom = !target.suggestedAmounts.includes(amountCents);
  const parsedCustomAmount = parseContributionAmount(customAmount);
  const customAmountIsInvalid =
    customAmount.trim() !== "" && parsedCustomAmount === null;

  return (
    <div className="space-y-4 pb-2">
      <div>
        <p className="text-sm text-ink-600">
          {entryPoint === "already-contributed" ? (
            <>
              Enter the amount you already gave to{" "}
              {target.candidate.fullName}. On the next step, upload the
              completed receipt so we can verify it.
            </>
          ) : (
            <>
              Choose an amount. You&rsquo;ll complete the contribution on{" "}
              {platformLabel(target.candidate.platform)}, then come back here
              and upload the receipt to add it to the total.
            </>
          )}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2.5"
        role="group"
        aria-label="Contribution amount"
      >
        {target.suggestedAmounts.map((cents) => {
          const selected = cents === amountCents;
          return (
            <button
              key={cents}
              type="button"
              onClick={() => {
                onSelect(cents);
                onCustomAmount("");
              }}
              aria-pressed={selected}
              className={cn(
                "tap-target rounded-xl px-4 py-3 text-base font-bold transition-all",
                selected
                  ? "bg-brand-700 text-white shadow-sm ring-2 ring-brand-700"
                  : "bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50",
              )}
            >
              {formatCentsShort(cents)}
            </button>
          );
        })}
      </div>

      <div>
        <label
          htmlFor="custom-amount"
          className="block text-sm font-semibold text-ink-800"
        >
          Or enter another amount
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-ink-500">
            $
          </span>
          <Input
            id="custom-amount"
            inputMode="decimal"
            placeholder="0.00"
            className="pl-8"
            value={customAmount}
            invalid={
              customAmountIsInvalid
            }
            aria-describedby={
              customAmountIsInvalid ? "custom-amount-error" : undefined
            }
            onChange={(e) => {
              onCustomAmount(e.target.value);
              const cents = parseContributionAmount(e.target.value);
              if (cents !== null) onSelect(cents);
            }}
          />
        </div>
        {customAmountIsInvalid && (
          <p
            id="custom-amount-error"
            role="alert"
            className="mt-1.5 text-xs font-medium text-red-700"
          >
            Enter an amount from $0.01 to $100,000.
          </p>
        )}
        {isCustom && parsedCustomAmount !== null && (
          <p className="mt-1.5 text-xs text-ink-500">
            Contributing {formatCents(amountCents)}
          </p>
        )}
      </div>

      {entryPoint === "already-contributed" ? (
        <div
          role="note"
          className="rounded-xl bg-brand-50 p-3.5 text-sm leading-relaxed text-brand-950 ring-1 ring-inset ring-brand-200"
        >
          <span className="font-semibold">Nothing will be charged.</span> This
          only adds a contribution you already completed to this drive&rsquo;s
          progress after its receipt is verified. An earlier contribution may
          not carry this drive&rsquo;s tracking tag, so the committee&rsquo;s processor
          may not attribute it to the drive.
        </div>
      ) : (
        <HandoffNotice
          platform={target.candidate.platform}
          committeeName={target.candidate.committeeName}
        />
      )}
    </div>
  );
}

function WaitingStep({
  target,
  amountCents,
  popupBlocked,
  outboundUrl,
}: {
  target: TargetView;
  amountCents: number;
  popupBlocked: boolean;
  outboundUrl: string | null;
}) {
  if (popupBlocked && outboundUrl) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
          <p className="text-sm font-semibold text-amber-900">
            Your browser blocked the popup
          </p>
          <p className="mt-1 text-sm text-amber-800">
            No problem — use the button below to open the donation page, then
            come back to this tab.
          </p>
        </div>
        <a
          href={outboundUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target flex w-full items-center justify-center rounded-2xl bg-brand-700 px-6 py-4 text-base font-semibold text-white hover:bg-brand-800"
        >
          Open {platformLabel(target.candidate.platform)}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50">
        <span className="size-7 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-700" />
      </div>

      <div>
        <p className="text-base font-semibold text-ink-900">
          We opened {platformLabel(target.candidate.platform)} in a new tab
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-600">
          Complete your {formatCentsShort(amountCents)} contribution there. Come
          back to this tab when you&rsquo;re done and we&rsquo;ll pick up right
          here. Keep the confirmation page or email so you can upload its
          receipt.
        </p>
      </div>

      <NonCustodyNote className="mx-auto max-w-xs" />
    </div>
  );
}

function ConfirmStep({
  target,
  entryPoint,
  attestationVersion,
  amountCents,
  editingAmount,
  onEditAmount,
  confirmedText,
  onConfirmedText,
  receipt,
  receiptOutcome,
  receiptVerified,
  receiptReviewAvailable,
  busy,
  evidenceError,
  receiptAiConsent,
  onReceiptAiConsent,
  onReceipt,
  onClearReceipt,
  attested,
  onAttested,
  attestError,
}: {
  target: TargetView;
  entryPoint: ContributionEntryPoint;
  attestationVersion: string;
  amountCents: number;
  editingAmount: boolean;
  onEditAmount: () => void;
  confirmedText: string;
  onConfirmedText: (v: string) => void;
  receipt: ReceiptResult | null;
  receiptOutcome: ReceiptOutcome;
  receiptVerified: boolean;
  receiptReviewAvailable: boolean;
  busy: boolean;
  evidenceError: string | null;
  receiptAiConsent: boolean;
  onReceiptAiConsent: (consented: boolean) => void;
  onReceipt: (r: ReceiptResult) => void;
  onClearReceipt: () => void;
  attested: boolean;
  onAttested: (v: boolean) => void;
  attestError: string | null;
}) {
  const ocrSuggestion =
    receipt?.ocrAmountCents && receipt.ocrAmountCents !== amountCents
      ? receipt.ocrAmountCents
      : null;
  const confirmedAmountIsInvalid =
    editingAmount && parseContributionAmount(confirmedText) === null;

  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-ink-600">
        {entryPoint === "already-contributed" ? (
          <>
            Upload the completed receipt for what you already gave. We&rsquo;ll
            check its visible details before updating {target.coalition.name}
            &rsquo;s progress.
          </>
        ) : (
          <>
            Upload the receipt from {platformLabel(target.candidate.platform)}
            . We can&rsquo;t see the processor&rsquo;s records, so a matched
            receipt is required before this can be added to the drive.
          </>
        )}
      </p>

      {!editingAmount ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-3.5 ring-1 ring-inset ring-ink-200">
          <div>
            <p className="text-xs font-medium text-ink-500">Amount</p>
            <p className="text-xl font-bold text-ink-900 tabular-nums">
              {formatCents(amountCents)}
            </p>
          </div>
          <button
            type="button"
            onClick={onEditAmount}
            className="tap-target rounded-lg px-3 text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            I gave a different amount
          </button>
        </div>
      ) : (
        <div>
          <label
            htmlFor="confirmed-amount"
            className="block text-sm font-semibold text-ink-800"
          >
            How much did you contribute?
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-ink-500">
              $
            </span>
            <Input
              id="confirmed-amount"
              inputMode="decimal"
              autoFocus
              className="pl-8"
              value={confirmedText}
              invalid={confirmedAmountIsInvalid}
              aria-describedby={
                confirmedAmountIsInvalid
                  ? "confirmed-amount-error"
                  : undefined
              }
              onChange={(e) => onConfirmedText(e.target.value)}
            />
          </div>
          {confirmedAmountIsInvalid && (
            <p
              id="confirmed-amount-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-red-700"
            >
              Enter an amount from $0.01 to $100,000.
            </p>
          )}
          {ocrSuggestion && (
            <button
              type="button"
              onClick={() => onConfirmedText((ocrSuggestion / 100).toFixed(2))}
              className="mt-1.5 text-xs font-semibold text-brand-700 underline underline-offset-2"
            >
              Use {formatCents(ocrSuggestion)} from your receipt
            </button>
          )}
        </div>
      )}

      <section
        aria-labelledby="receipt-verification-heading"
        className="space-y-2.5 rounded-xl bg-ink-50 p-3.5 ring-1 ring-inset ring-ink-200"
      >
        <div>
          <h3
            id="receipt-verification-heading"
            className="text-sm font-semibold text-ink-900"
          >
            Verify with a receipt
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            Required. Keep the committee or recipient, amount, date, and
            completed status visible. Your receipt image is never shown in
            public activity.
          </p>
        </div>

        <ReceiptCaptureHelp />

        {!receiptReviewAvailable ? (
          <div
            role="alert"
            className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 ring-1 ring-inset ring-amber-200"
          >
            <p className="font-semibold">
              Receipt verification isn&rsquo;t ready for this recipient.
            </p>
            <p className="mt-1">
              Nothing can be added to the drive until verification is
              available. Please try again later.
            </p>
          </div>
        ) : (
          <>
            <ReceiptDropzone
              onResult={onReceipt}
              onClear={onClearReceipt}
              disabled={busy}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-ink-200">
              <input
                type="checkbox"
                checked={receiptAiConsent}
                required
                disabled={busy || receiptVerified}
                onChange={(event) =>
                  onReceiptAiConsent(event.currentTarget.checked)
                }
                aria-describedby="receipt-ai-consent-description receipt-retention-disclosure"
                className="mt-0.5 size-5 shrink-0 rounded accent-brand-700"
              />
              <span
                id="receipt-ai-consent-description"
                className="text-xs leading-relaxed text-ink-700"
              >
                I agree to send this image to OpenAI for the required receipt
                check. I understand that an AI match is an automated
                consistency check, not confirmation from the campaign or
                payment processor.
              </span>
            </label>
            <p
              id="receipt-retention-disclosure"
              className="text-xs leading-relaxed text-ink-600"
            >
              Capital Ark does not store the raw image. OpenAI may retain it in
              abuse-monitoring logs for up to 30 days unless Zero Data
              Retention applies.{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
              >
                Read the privacy details
              </a>
              .
            </p>

            {receiptVerified && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-950 ring-1 ring-inset ring-emerald-200"
              >
                <p className="font-semibold">Receipt details matched</p>
                <p className="mt-1">
                  The visible recipient, amount, date, processor, and completed
                  status passed the automated check. Confirm the statement
                  below to add this receipt-backed contribution.
                </p>
              </div>
            )}

            {(receiptOutcome === "needs-review" ||
              receiptOutcome === "unavailable") && (
              <div
                id="receipt-evidence-error"
                role="alert"
                className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 ring-1 ring-inset ring-amber-200"
              >
                <p className="font-semibold">
                  {receiptOutcome === "needs-review"
                    ? "We couldn’t verify that receipt."
                    : "We couldn’t check the receipt right now."}
                </p>
                <p className="mt-1">
                  {evidenceError} Nothing has been added.{" "}
                  {receiptOutcome === "needs-review"
                    ? "Remove it and upload a clearer screenshot with all required details visible."
                    : "Try the receipt check again in a moment, or upload another screenshot."}
                </p>
              </div>
            )}

            {evidenceError &&
              receiptOutcome !== "needs-review" &&
              receiptOutcome !== "unavailable" && (
                <p
                  id="receipt-evidence-error"
                  role="alert"
                  className="text-xs font-medium text-red-700"
                >
                  {evidenceError}
                </p>
              )}
          </>
        )}
      </section>

      {receiptVerified && (
        <AttestationCheckbox
          checked={attested}
          onChange={onAttested}
          version={attestationVersion}
          error={attestError}
        />
      )}
    </div>
  );
}

function DoneStep({
  target,
  amountCents,
}: {
  target: TargetView;
  amountCents: number;
}) {
  const shareUrl = absoluteUrl(`/t/${target.slug}`);
  const shareText = [
    `I contributed ${formatCents(amountCents)} to support ${target.candidate.fullName} through ${target.coalition.name}.`,
    target.title,
    shareUrl,
  ].join("\n");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-8 text-emerald-700"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="mt-3 text-lg font-bold text-ink-900">
          {formatCents(amountCents)} added to the total
        </p>
        <p className="mt-1 text-sm text-ink-600">
          Thanks for backing {target.candidate.fullName} with{" "}
          {target.coalition.name}. Your receipt passed the automated check, so
          this appears as receipt-backed. It is not confirmation from campaign
          records.
        </p>
      </div>

      <div className="space-y-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0f7b45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0b6b3a] active:bg-[#075a32]"
        >
          Share on WhatsApp
        </a>
        <p className="text-center text-xs leading-relaxed text-ink-500">
          Opens a draft with your recorded amount and this drive&rsquo;s public
          link. You choose where it goes and tap Send.
        </p>
      </div>

      {isSupabaseConfigured && <ClaimAccountCard />}

      <NonCustodyNote />
    </div>
  );
}

function ModalFooter({
  step,
  busy,
  amountCents,
  amountIsValid,
  entryPoint,
  receiptVerified,
  receiptOutcome,
  receiptReviewAvailable,
  onContribute,
  onContinueAlready,
  onConfirm,
  onDecline,
  onDone,
  onReopen,
  onSkipWait,
  returnState,
}: {
  step: Step;
  busy: boolean;
  amountCents: number;
  amountIsValid: boolean;
  entryPoint: ContributionEntryPoint;
  receiptVerified: boolean;
  receiptOutcome: ReceiptOutcome;
  receiptReviewAvailable: boolean;
  onContribute: () => void;
  onContinueAlready: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onDone: () => void;
  onReopen: () => void;
  onSkipWait: () => void;
  returnState: string;
}) {
  if (step === "amount") {
    return (
      <Button
        size="lg"
        fullWidth
        loading={busy}
        disabled={!amountIsValid}
        onClick={
          entryPoint === "already-contributed"
            ? onContinueAlready
            : onContribute
        }
      >
        {entryPoint === "already-contributed"
          ? `Continue with ${formatCentsShort(amountCents)}`
          : `Contribute ${formatCentsShort(amountCents)}`}
      </Button>
    );
  }

  if (step === "waiting") {
    return (
      <div className="space-y-2">
        <Button size="lg" fullWidth variant="secondary" onClick={onSkipWait}>
          I&rsquo;m done — verify my receipt
        </Button>
        <Button size="sm" fullWidth variant="ghost" onClick={onReopen}>
          Reopen the donation page
        </Button>
        <span className="sr-only" aria-live="polite">
          {returnState === "returned"
            ? "Welcome back. Please upload your contribution receipt."
            : "Waiting for you to finish on the donation page."}
        </span>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-2">
        <Button
          size="lg"
          fullWidth
          loading={busy}
          disabled={!receiptReviewAvailable}
          onClick={onConfirm}
        >
          {receiptVerified
            ? "Add receipt-backed contribution"
            : receiptOutcome === "needs-review" ||
                receiptOutcome === "unavailable"
              ? "Try receipt check again"
              : "Check receipt"}
        </Button>
        <Button
          size="sm"
          fullWidth
          variant="ghost"
          disabled={busy}
          onClick={onDecline}
        >
          {entryPoint === "already-contributed"
            ? "Cancel — don’t add it"
            : "I didn’t contribute"}
        </Button>
      </div>
    );
  }

  return (
    <Button size="lg" fullWidth variant="secondary" onClick={onDone}>
      Back to the drive
    </Button>
  );
}

function parseContributionAmount(input: string): number | null {
  const cents = parseAmountToCents(input);
  return cents !== null && cents <= MAX_CONTRIBUTION_CENTS ? cents : null;
}

function receiptOutcomeFromEvidenceType(value: unknown): ReceiptOutcome {
  if (value === "RECEIPT_AI_CHECKED") return "ai-checked";
  // Anything other than an AI-checked receipt fails closed. The server also
  // enforces this, so the UI never describes tokenless evidence as checked.
  return "not-requested";
}

async function checkReceipt({
  pledgeId,
  confirmedAmountCents,
  receipt,
}: {
  pledgeId: string;
  confirmedAmountCents: number;
  receipt: ReceiptResult;
}): Promise<{
  outcome: ReceiptOutcome;
  evidenceToken: string | null;
  message: string;
}> {
  try {
    const formData = new FormData();
    formData.set("pledgeId", pledgeId);
    formData.set("confirmedAmountCents", String(confirmedAmountCents));
    formData.set("consent", "true");
    formData.set("receipt", receipt.file);

    const res = await fetch("/api/receipts/verify", {
      method: "POST",
      body: formData,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        outcome: "unavailable",
        evidenceToken: null,
        message:
          payload?.error?.message ??
          "The receipt service could not read that upload.",
      };
    }

    if (
      payload?.status === "ai_checked" &&
      payload?.receiptBacked === true &&
      typeof payload?.evidenceToken === "string"
    ) {
      return {
        outcome: "ai-checked",
        evidenceToken: payload.evidenceToken,
        message: "The visible receipt details matched.",
      };
    }
    if (payload?.status === "needs_review") {
      return {
        outcome: "needs-review",
        evidenceToken: null,
        message:
          receiptReasonMessage(payload) ??
          "The required receipt details did not all match.",
      };
    }
    return {
      outcome: "unavailable",
      evidenceToken: null,
      message:
        receiptReasonMessage(payload) ??
        "Receipt verification is temporarily unavailable.",
    };
  } catch {
    return {
      outcome: "unavailable",
      evidenceToken: null,
      message: "The receipt service did not respond.",
    };
  }
}

function receiptReasonMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("reasons" in payload)) {
    return null;
  }
  const reasons = (payload as { reasons?: unknown }).reasons;
  if (!Array.isArray(reasons)) return null;
  const reason = reasons.find(
    (item): item is { message: string } =>
      Boolean(
        item &&
          typeof item === "object" &&
          "message" in item &&
          typeof (item as { message?: unknown }).message === "string",
      ),
  );
  return reason?.message ?? null;
}
