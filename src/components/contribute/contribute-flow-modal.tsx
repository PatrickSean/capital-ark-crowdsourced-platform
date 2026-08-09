"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  openPlaceholderWindow,
  useReturnDetection,
} from "./use-return-detection";
import { ReceiptDropzone, type ReceiptResult } from "./receipt-dropzone";
import { ClaimAccountCard } from "@/components/account/claim-account-card";

/**
 * The contribute-and-track flow.
 *
 * Steps: choose an amount, go to the processor, confirm what happened. The
 * user always knows which of the three they're on, and every step has a way
 * out that doesn't strand them.
 */
type Step = "amount" | "waiting" | "confirm" | "done";
type ReceiptOutcome = "not-requested" | "stored" | "failed";

export function ContributeFlowModal({
  target,
  open,
  onClose,
  initialAmountCents,
  resumePledgeId,
  onProgressChange,
}: {
  target: TargetView;
  open: boolean;
  onClose: () => void;
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

  const [confirmedText, setConfirmedText] = useState("");
  const [editingAmount, setEditingAmount] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [uploadedReceiptKey, setUploadedReceiptKey] = useState<string | null>(
    null,
  );
  const [receiptOutcome, setReceiptOutcome] =
    useState<ReceiptOutcome>("not-requested");
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
  // rather than a half-finished one.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setStep(resumePledgeId ? "confirm" : "amount");
      setPledgeId(resumePledgeId ?? null);
      setOutboundUrl(null);
      setReceipt(null);
      setUploadedReceiptKey(null);
      setReceiptOutcome("not-requested");
      setRecordedAmountCents(null);
      setAttested(false);
      setAttestError(null);
      setError(null);
      setConfirmedText("");
      setEditingAmount(false);
      reset();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, resumePledgeId, reset]);

  const effectiveConfirmedCents = useCallback(() => {
    if (editingAmount) return parseAmountToCents(confirmedText);
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

  const submitConfirmation = useCallback(
    async (declined: boolean) => {
      if (!pledgeId) {
        setStep("amount");
        return;
      }

      if (!declined && !attested) {
        setAttestError(
          "Please confirm the statement above so we can record this.",
        );
        return;
      }

      setBusy(true);
      setError(null);
      setAttestError(null);

      try {
        let receiptUrl = declined ? null : uploadedReceiptKey;
        if (!declined && receipt && !receiptUrl) {
          receiptUrl = await uploadReceipt(pledgeId, receipt);
          if (receiptUrl) setUploadedReceiptKey(receiptUrl);
        }

        const confirmed = declined ? null : effectiveConfirmedCents();

        if (!declined && confirmed === null) {
          setBusy(false);
          setError(
            "That amount doesn't look right. Enter it like 50 or 50.00.",
          );
          return;
        }

        const res = await fetch("/api/pledges/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pledgeId,
            declined,
            attested: !declined,
            confirmedAmountCents: confirmed,
            ocrAmountCents: receipt?.ocrAmountCents ?? null,
            receiptUrl,
            attestationVersion,
          }),
        });

        const payload = await res.json();

        if (!res.ok) {
          setError(
            payload?.error?.message ??
              "We couldn't save that. Please try again.",
          );
          return;
        }

        if (payload.progress) onProgressChange?.(payload.progress);

        if (declined) {
          onClose();
          router.refresh();
          return;
        }

        const storedReceipt = Boolean(payload?.pledge?.receiptUrl);
        setReceiptOutcome(
          storedReceipt ? "stored" : receipt ? "failed" : "not-requested",
        );
        setRecordedAmountCents(
          payload?.pledge?.confirmedAmountCents ?? confirmed ?? amountCents,
        );
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
      uploadedReceiptKey,
      effectiveConfirmedCents,
      amountCents,
      onProgressChange,
      onClose,
      router,
    ],
  );

  const stepIndex = step === "amount" ? 0 : step === "waiting" ? 1 : 2;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={stepTitle(step, target)}
      dismissible={!busy}
      footer={
        <ModalFooter
          step={step}
          busy={busy}
          amountCents={amountCents}
          onContribute={handleContribute}
          onConfirm={() => submitConfirmation(false)}
          onDecline={() => submitConfirmation(true)}
          onDone={onClose}
          onReopen={() => outboundUrl && refocusPopup(outboundUrl)}
          onSkipWait={markReturned}
          returnState={returnState}
        />
      }
    >
      {step !== "done" && <StepIndicator current={stepIndex} />}

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
          attestationVersion={attestationVersion}
          amountCents={amountCents}
          editingAmount={editingAmount}
          onEditAmount={() => {
            setEditingAmount(true);
            setConfirmedText((amountCents / 100).toFixed(2));
          }}
          confirmedText={confirmedText}
          onConfirmedText={setConfirmedText}
          receipt={receipt}
          onReceipt={(nextReceipt) => {
            setReceipt(nextReceipt);
            setUploadedReceiptKey(null);
            setReceiptOutcome("not-requested");
          }}
          onClearReceipt={() => {
            setReceipt(null);
            setUploadedReceiptKey(null);
            setReceiptOutcome("not-requested");
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

function stepTitle(step: Step, target: TargetView): string {
  switch (step) {
    case "amount":
      return `Contribute to ${target.candidate.fullName}`;
    case "waiting":
      return "Finish on the donation page";
    case "confirm":
      return "Did you complete your contribution?";
    case "done":
      return "Thank you";
  }
}

/** Always-visible progress through the flow, so nobody feels lost mid-handoff. */
function StepIndicator({ current }: { current: number }) {
  const steps = ["Amount", "Donate", "Confirm"];
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
}: {
  target: TargetView;
  amountCents: number;
  onSelect: (cents: number) => void;
  customAmount: string;
  onCustomAmount: (value: string) => void;
}) {
  const isCustom = !target.suggestedAmounts.includes(amountCents);

  return (
    <div className="space-y-4 pb-2">
      <div>
        <p className="text-sm text-ink-600">
          Choose an amount. You&rsquo;ll complete the contribution on{" "}
          {platformLabel(target.candidate.platform)}, then come back here and
          we&rsquo;ll add it to the total.
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
              Boolean(customAmount) && parseAmountToCents(customAmount) === null
            }
            onChange={(e) => {
              onCustomAmount(e.target.value);
              const cents = parseAmountToCents(e.target.value);
              if (cents !== null) onSelect(cents);
            }}
          />
        </div>
        {isCustom && parseAmountToCents(customAmount) !== null && (
          <p className="mt-1.5 text-xs text-ink-500">
            Contributing {formatCents(amountCents)}
          </p>
        )}
      </div>

      <HandoffNotice
        platform={target.candidate.platform}
        committeeName={target.candidate.committeeName}
      />
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
  attestationVersion,
  amountCents,
  editingAmount,
  onEditAmount,
  confirmedText,
  onConfirmedText,
  receipt,
  onReceipt,
  onClearReceipt,
  attested,
  onAttested,
  attestError,
}: {
  target: TargetView;
  attestationVersion: string;
  amountCents: number;
  editingAmount: boolean;
  onEditAmount: () => void;
  confirmedText: string;
  onConfirmedText: (v: string) => void;
  receipt: ReceiptResult | null;
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

  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-ink-600">
        Tell us what happened so we can update {target.coalition.name}&rsquo;s
        progress. This is the only way the total moves — we have no access to{" "}
        {platformLabel(target.candidate.platform)}&rsquo;s records.
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
              invalid={
                Boolean(confirmedText) &&
                parseAmountToCents(confirmedText) === null
              }
              onChange={(e) => onConfirmedText(e.target.value)}
            />
          </div>
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

      {isSupabaseConfigured && (
        <>
          <ReceiptDropzone onResult={onReceipt} onClear={onClearReceipt} />
          <p className="text-xs text-ink-500">
            A receipt moves your contribution into the receipt-backed part of the
            progress bar. Without one it still counts, just as self-reported.
          </p>
        </>
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

function DoneStep({
  target,
  amountCents,
  receiptOutcome,
}: {
  target: TargetView;
  amountCents: number;
  receiptOutcome: ReceiptOutcome;
}) {
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
          {receiptOutcome === "stored"
            ? " Your receipt was attached and puts this in the receipt-backed segment."
            : receiptOutcome === "failed"
              ? " We couldn't attach your receipt, so this counts as self-reported."
              : " This counts as self-reported."}
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
  onContribute,
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
  onContribute: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onDone: () => void;
  onReopen: () => void;
  onSkipWait: () => void;
  returnState: string;
}) {
  if (step === "amount") {
    return (
      <Button size="lg" fullWidth loading={busy} onClick={onContribute}>
        Contribute {formatCentsShort(amountCents)}
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
          Yes, I contributed
        </Button>
        <Button
          size="sm"
          fullWidth
          variant="ghost"
          disabled={busy}
          onClick={onDecline}
        >
          I didn&rsquo;t contribute
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

/**
 * Uploads the receipt straight to storage and returns its object key.
 *
 * Returns null on any failure: a receipt is a nice-to-have, and losing one
 * must never block the user from recording that they contributed.
 */
async function uploadReceipt(
  pledgeId: string,
  receipt: ReceiptResult,
): Promise<string | null> {
  try {
    const res = await fetch("/api/receipts/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pledgeId, contentType: receipt.file.type }),
    });
    if (!res.ok) return null;

    const payload = await res.json();
    if (!payload.uploadUrl) return null;

    const upload = await fetch(payload.uploadUrl, {
      method: "PUT",
      body: receipt.file,
      headers: { "content-type": receipt.file.type },
    });

    return upload.ok ? payload.objectKey : null;
  } catch {
    return null;
  }
}
