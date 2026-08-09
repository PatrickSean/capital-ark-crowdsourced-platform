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
  | "receipt-attached"
  | "needs-review"
  | "unavailable";
type EvidenceMethod = "self-reported" | "receipt-backed";

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
  const [evidenceMethod, setEvidenceMethod] =
    useState<EvidenceMethod>("self-reported");
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
      setEvidenceMethod("self-reported");
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

      if (!declined) {
        let invalid = false;

        if (evidenceMethod === "receipt-backed" && !receipt) {
          setEvidenceError(
            "Add a receipt image, or choose self-report to continue without one.",
          );
          invalid = true;
        } else if (evidenceMethod === "receipt-backed" && !receiptAiConsent) {
          setEvidenceError(
            "Confirm that you agree to the optional AI receipt check, or choose self-report.",
          );
          invalid = true;
        }
        if (!attested) {
          setAttestError(
            "Please confirm the statement above so we can record this.",
          );
          invalid = true;
        }
        if (invalid) return;
      }

      setBusy(true);
      setError(null);
      setAttestError(null);
      setEvidenceError(null);

      try {
        const confirmed = declined ? null : effectiveConfirmedCents();

        if (!declined && confirmed === null) {
          setBusy(false);
          setError(
            "That amount doesn't look right. Enter it like 50 or 50.00.",
          );
          return;
        }

        let nextEvidenceToken = declined ? null : receiptEvidenceToken;
        let nextReceiptOutcome: ReceiptOutcome = declined
          ? "not-requested"
          : receiptOutcome;

        if (
          !declined &&
          confirmed !== null &&
          evidenceMethod === "receipt-backed" &&
          receipt &&
          !nextEvidenceToken &&
          nextReceiptOutcome === "not-requested"
        ) {
          const check = await checkReceipt({
            pledgeId,
            confirmedAmountCents: confirmed,
            receipt,
          });

          nextEvidenceToken = check.evidenceToken;
          nextReceiptOutcome = check.outcome;
          setReceiptEvidenceToken(check.evidenceToken);
          setReceiptOutcome(check.outcome);

          // Never turn a requested receipt check into a self-report behind the
          // contributor's back. If matching is unavailable or inconclusive,
          // pause here, select the honest fallback, and require their next
          // explicit click before anything is added to public progress.
          if (check.outcome !== "ai-checked") {
            setReceipt(null);
            receiptFileRef.current = null;
            setReceiptAiConsent(false);
            setEvidenceMethod("self-reported");
            return;
          }
        }

        const res = await fetch("/api/pledges/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pledgeId,
            declined,
            attested: !declined,
            confirmedAmountCents: confirmed,
            ocrAmountCents:
              evidenceMethod === "receipt-backed"
                ? receipt?.ocrAmountCents ?? null
                : null,
            receiptEvidenceToken: nextEvidenceToken,
            attestationVersion,
          }),
        });

        const payload = await res.json();

        if (!res.ok) {
          const errorCode = payload?.error?.code;
          if (errorCode === "invalid_receipt_evidence") {
            // The short-lived token can expire while the modal remains open.
            // Clear it so the next click performs a fresh check.
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
          } else if (errorCode === "receipt_already_used") {
            // Never keep retrying evidence the server has already claimed for
            // another pledge. Discard it locally and offer an explicit
            // self-report fallback instead.
            setReceipt(null);
            receiptFileRef.current = null;
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setReceiptAiConsent(false);
            setEvidenceMethod("self-reported");
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
      evidenceMethod,
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
          evidenceMethod={evidenceMethod}
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
          }}
          receipt={receipt}
          evidenceMethod={evidenceMethod}
          receiptOutcome={receiptOutcome}
          receiptReviewAvailable={receiptReviewAvailable}
          onEvidenceMethod={(method) => {
            setEvidenceMethod(method);
            setEvidenceError(null);
            if (method === "self-reported") {
              setReceipt(null);
              receiptFileRef.current = null;
              setReceiptEvidenceToken(null);
              setReceiptOutcome("not-requested");
              setReceiptAiConsent(false);
            } else {
              setReceiptEvidenceToken(null);
              setReceiptOutcome("not-requested");
            }
          }}
          evidenceError={evidenceError}
          receiptAiConsent={receiptAiConsent}
          onReceiptAiConsent={(consented) => {
            setReceiptAiConsent(consented);
            if (consented) setEvidenceError(null);
          }}
          onReceipt={(nextReceipt) => {
            const isNewImage = receiptFileRef.current !== nextReceipt.file;
            receiptFileRef.current = nextReceipt.file;
            setReceipt(nextReceipt);
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setEvidenceError(null);
            if (isNewImage) setReceiptAiConsent(false);
          }}
          onClearReceipt={() => {
            setReceipt(null);
            receiptFileRef.current = null;
            setReceiptEvidenceToken(null);
            setReceiptOutcome("not-requested");
            setReceiptAiConsent(false);
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
          receiptOutcome={receiptOutcome}
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
        ? `Confirm your contribution to ${target.candidate.fullName}`
        : "Did you complete your contribution?";
    case "done":
      return "Thank you";
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
      ? ["Amount", "Confirm"]
      : ["Amount", "Donate", "Confirm"];
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
              {target.candidate.fullName}. On the next step, you can add it as
              self-reported or attach a receipt.
            </>
          ) : (
            <>
              Choose an amount. You&rsquo;ll complete the contribution on{" "}
              {platformLabel(target.candidate.platform)}, then come back here
              and we&rsquo;ll add it to the total.
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
          progress. An earlier contribution may not carry this drive&rsquo;s
          tracking tag, so the committee&rsquo;s processor may not attribute it
          to the drive.
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
          here.
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
  evidenceMethod,
  receiptOutcome,
  receiptReviewAvailable,
  onEvidenceMethod,
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
  evidenceMethod: EvidenceMethod;
  receiptOutcome: ReceiptOutcome;
  receiptReviewAvailable: boolean;
  onEvidenceMethod: (method: EvidenceMethod) => void;
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
            Add what you already gave to {target.coalition.name}&rsquo;s
            progress. Choose self-report for the fastest path, or attach a
            receipt as supporting evidence.
          </>
        ) : (
          <>
            Tell us what happened so we can update{" "}
            {target.coalition.name}&rsquo;s progress. We have no access to{" "}
            {platformLabel(target.candidate.platform)}&rsquo;s records.
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

      {(receiptOutcome === "needs-review" ||
        receiptOutcome === "unavailable") && (
        <div
          role="status"
          className="rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-950 ring-1 ring-inset ring-amber-200"
        >
          <p className="font-semibold">
            {receiptOutcome === "needs-review"
              ? "We couldn’t confidently match that receipt."
              : "The optional receipt check is unavailable right now."}
          </p>
          <p className="mt-1 text-xs text-amber-900">
            Nothing has been added yet. Use the selected self-report option
            below, or choose AI-check a receipt again to try another image.
          </p>
        </div>
      )}

      <fieldset
        className="space-y-2"
        aria-describedby={evidenceError ? "receipt-evidence-error" : undefined}
      >
        <legend className="text-sm font-semibold text-ink-800">
          How should this contribution be shown?
        </legend>

        <EvidenceChoice
          value="self-reported"
          selected={evidenceMethod === "self-reported"}
          title="Self-report"
          description="Fastest. Adds the amount to the clearly labeled self-reported total."
          onSelect={onEvidenceMethod}
        />

        <EvidenceChoice
          value="receipt-backed"
          selected={evidenceMethod === "receipt-backed"}
          title="AI-check a receipt"
          description={
            receiptReviewAvailable
              ? "Optional. Checks whether the visible receipt details match this contribution."
              : "Not available yet. You can still add this contribution as self-reported."
          }
          disabled={!receiptReviewAvailable}
          onSelect={onEvidenceMethod}
        />
      </fieldset>

      {evidenceMethod === "receipt-backed" && (
        <div className="space-y-2 rounded-xl bg-ink-50 p-3.5 ring-1 ring-inset ring-ink-200">
          <p className="text-xs leading-relaxed text-ink-600">
            Before uploading, crop or cover your address, email, and card
            digits. We only need the committee name, amount, and date. A
            receipt is supporting evidence; it does not confirm the
            contribution against campaign records.
          </p>
          <ReceiptDropzone onResult={onReceipt} onClear={onClearReceipt} />
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-ink-200">
            <input
              type="checkbox"
              checked={receiptAiConsent}
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
              I agree to send this image to OpenAI for an optional AI receipt
              check. I understand that an AI match is not confirmation from
              the campaign or payment processor.
            </span>
          </label>
          <p
            id="receipt-retention-disclosure"
            className="text-xs leading-relaxed text-ink-600"
          >
            Capital Ark does not store the raw image. OpenAI may retain it in
            abuse-monitoring logs for up to 30 days unless Zero Data Retention
            applies.{" "}
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
          {evidenceError && (
            <p
              id="receipt-evidence-error"
              role="alert"
              className="text-xs font-medium text-red-700"
            >
              {evidenceError}
            </p>
          )}
        </div>
      )}

      <AttestationCheckbox
        checked={attested}
        onChange={onAttested}
        version={attestationVersion}
        error={attestError}
      />
    </div>
  );
}

function EvidenceChoice({
  value,
  selected,
  title,
  description,
  disabled = false,
  onSelect,
}: {
  value: EvidenceMethod;
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: (method: EvidenceMethod) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-16 items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        selected
          ? "bg-brand-50 ring-brand-500"
          : "bg-white ring-ink-200",
        !selected && !disabled && "hover:bg-ink-50",
      )}
    >
      <input
        type="radio"
        name="contribution-evidence"
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="mt-0.5 size-5 shrink-0 accent-brand-700"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
          {description}
        </span>
      </span>
    </label>
  );
}

function DoneStep({
  target,
  amountCents,
  receiptOutcome,
}: {
  target: TargetView;
  amountCents: number;
  receiptOutcome: ReceiptOutcome;
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
          {target.coalition.name}.
          {receiptOutcome === "ai-checked"
            ? " Your receipt was AI-checked and matched the visible contribution details, so this appears as receipt-backed. It is not confirmation from campaign records."
            : receiptOutcome === "receipt-attached"
              ? " Your receipt was attached, so this appears as receipt-backed. It is not confirmation from campaign records."
            : receiptOutcome === "needs-review"
              ? " The receipt could not be confidently matched, so this counts as self-reported."
              : receiptOutcome === "unavailable"
                ? " The optional receipt check was unavailable, so this counts as self-reported."
                : " This counts as self-reported."}
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
  evidenceMethod,
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
  evidenceMethod: EvidenceMethod;
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
          I&rsquo;m done — confirm my contribution
        </Button>
        <Button size="sm" fullWidth variant="ghost" onClick={onReopen}>
          Reopen the donation page
        </Button>
        <span className="sr-only" aria-live="polite">
          {returnState === "returned"
            ? "Welcome back. Please confirm your contribution."
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
          onClick={onConfirm}
        >
          {evidenceMethod === "receipt-backed"
            ? "Check receipt and add"
            : "Add as self-reported"}
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
  if (value === "RECEIPT_ATTACHED") return "receipt-attached";
  if (value === "SELF_REPORTED") return "not-requested";
  // Null and unknown future values fail closed to the least-trusting public
  // description.
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
    if (!res.ok) {
      return { outcome: "unavailable", evidenceToken: null };
    }

    const payload = await res.json();
    if (
      payload?.status === "ai_checked" &&
      payload?.receiptBacked === true &&
      typeof payload?.evidenceToken === "string"
    ) {
      return {
        outcome: "ai-checked",
        evidenceToken: payload.evidenceToken,
      };
    }
    if (payload?.status === "needs_review") {
      return { outcome: "needs-review", evidenceToken: null };
    }
    return { outcome: "unavailable", evidenceToken: null };
  } catch {
    // Receipt analysis is optional. A provider/network failure must never
    // strand a contributor; confirmation continues as self-reported.
    return { outcome: "unavailable", evidenceToken: null };
  }
}
