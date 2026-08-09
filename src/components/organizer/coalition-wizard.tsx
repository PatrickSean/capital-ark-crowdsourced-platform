"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { Jurisdiction, Party } from "@/generated/prisma/enums";
import {
  derivePrefix,
  detectPlatform,
  PLATFORM_LABELS,
  sanitizeTrackingTag,
} from "@/lib/tracking/link-builder";
import { parseAmountToCents } from "@/lib/money";
import { useIdentity } from "@/lib/auth/use-identity";
import { WizardSuccess } from "./wizard-success";

const PARTY_OPTIONS: { value: Party; label: string }[] = [
  { value: Party.REPUBLICAN, label: "Republican" },
  { value: Party.DEMOCRAT, label: "Democrat" },
  { value: Party.INDEPENDENT, label: "Independent" },
  { value: Party.LIBERTARIAN, label: "Libertarian" },
  { value: Party.GREEN, label: "Green" },
  { value: Party.OTHER, label: "Other" },
];

const DEFAULT_AMOUNTS = [2500, 5000, 10000, 25000];
const MAX_TARGETS = 20;

type TargetDraft = {
  id: string;
  candidateName: string;
  office: string;
  party: Party | "";
  jurisdiction: Jurisdiction | "";
  state: string;
  donationUrl: string;
  goalText: string;
  deadline: string;
};

function newTargetDraft(id: string): TargetDraft {
  return {
    id,
    candidateName: "",
    office: "",
    party: "",
    jurisdiction: "",
    state: "",
    donationUrl: "",
    goalText: "",
    deadline: "",
  };
}

/**
 * Open-platform drive setup. Coalition details are entered once, while each
 * candidate keeps their own race, processor URL, goal and deadline. The API
 * creates the full slate transactionally so organizers never publish a
 * half-built drive.
 */
export function CoalitionWizard() {
  const router = useRouter();
  const { ensureIdentity } = useIdentity();
  const formId = useId();
  const nextTargetNumber = useRef(1);

  const [coalitionName, setCoalitionName] = useState("");
  const [description, setDescription] = useState("");
  const [targets, setTargets] = useState<TargetDraft[]>(() => [
    newTargetDraft(`${formId}-target-0`),
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPrefix, setCustomPrefix] = useState("");
  const [organizerAttested, setOrganizerAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    coalitionSlug: string;
    candidateCount: number;
  } | null>(null);

  const prefix = customPrefix
    ? sanitizeTrackingTag(customPrefix)
    : coalitionName
      ? derivePrefix(coalitionName)
      : "";

  const parsedTargets = useMemo(
    () =>
      targets.map((target) => ({
        ...target,
        platform: target.donationUrl.trim()
          ? detectPlatform(target.donationUrl)
          : null,
        goalCents: parseAmountToCents(target.goalText),
      })),
    [targets],
  );

  const canSubmit =
    coalitionName.trim().length >= 2 &&
    parsedTargets.length > 0 &&
    parsedTargets.every(
      (target) =>
        target.candidateName.trim().length >= 2 &&
        target.office.trim().length >= 2 &&
        target.party !== "" &&
        target.jurisdiction !== "" &&
        target.state.trim().length === 2 &&
        target.platform !== null &&
        target.goalCents !== null,
    ) &&
    organizerAttested &&
    !busy;

  const updateTarget = <K extends keyof TargetDraft>(
    id: string,
    key: K,
    value: TargetDraft[K],
  ) => {
    setTargets((current) =>
      current.map((target) =>
        target.id === id ? { ...target, [key]: value } : target,
      ),
    );
  };

  const addTarget = () => {
    if (targets.length >= MAX_TARGETS) return;
    const id = `${formId}-target-${nextTargetNumber.current}`;
    nextTargetNumber.current += 1;
    setTargets((current) => [...current, newTargetDraft(id)]);
  };

  const removeTarget = (id: string) => {
    setTargets((current) => current.filter((target) => target.id !== id));
  };

  if (result) {
    return (
      <WizardSuccess
        coalitionSlug={result.coalitionSlug}
        candidateCount={result.candidateCount}
        coalitionName={coalitionName}
      />
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      await ensureIdentity();

      const res = await fetch("/api/coalitions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coalitionName: coalitionName.trim(),
          description: description.trim() || null,
          trackingPrefix: customPrefix ? prefix : null,
          organizerAttested,
          targets: parsedTargets.map((target) => ({
            candidateName: target.candidateName.trim(),
            office: target.office.trim(),
            party: target.party,
            jurisdiction: target.jurisdiction,
            state: target.state.trim().toUpperCase(),
            donationUrl: target.donationUrl.trim(),
            goalCents: target.goalCents,
            deadline: target.deadline
              ? new Date(target.deadline).toISOString()
              : null,
            suggestedAmounts: DEFAULT_AMOUNTS,
          })),
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? "We couldn't create the drive.");
        return;
      }

      setResult({
        coalitionSlug: payload.coalitionSlug,
        candidateCount: parsedTargets.length,
      });
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <SetupSteps candidateCount={targets.length} />

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
            Step 1
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-ink-900">
            Tell people what you&rsquo;re organizing
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            This becomes the shared home for every candidate in your drive.
          </p>
        </div>

        <Field label="Drive name" htmlFor="coalition-name">
          <Input
            id="coalition-name"
            required
            placeholder="e.g. Small businesses for clean energy"
            value={coalitionName}
            onChange={(event) => setCoalitionName(event.target.value)}
          />
        </Field>

        <Field
          label="What brings your community together?"
          htmlFor="description"
          hint="Optional. This appears on the public drive page."
        >
          <textarea
            id="description"
            rows={4}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain the issue, the community behind it, and the change you want to see."
            className="w-full rounded-xl bg-white px-3.5 py-3 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 ring-inset placeholder:text-ink-400 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          />
        </Field>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
            className="tap-target inline-flex items-center text-xs font-semibold text-ink-600 underline underline-offset-2 hover:text-ink-900"
          >
            {showAdvanced ? "Hide" : "Show"} tracking code settings
          </button>

          {showAdvanced && (
            <div className="mt-3">
              <Field
                label="Tracking code prefix"
                htmlFor="prefix"
                hint="Added to every contribution link so recipient committees can identify support from your drive."
              >
                <Input
                  id="prefix"
                  value={customPrefix}
                  placeholder={prefix || "YOURDRIVE"}
                  onChange={(event) => setCustomPrefix(event.target.value)}
                  className="font-mono uppercase"
                />
              </Field>
              {prefix && (
                <p className="mt-1.5 font-mono text-xs text-ink-500">
                  Links will be tagged {prefix}-XXXXXX-XXXXXX
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      <section aria-labelledby="candidates-heading" className="space-y-4">
        <div className="px-1">
          <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
            Step 2
          </p>
          <h2
            id="candidates-heading"
            className="mt-1 text-lg font-bold tracking-tight text-ink-900"
          >
            Build your candidate slate
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Add one candidate or twenty. Each contribution still goes directly
            through that candidate&rsquo;s official processor.
          </p>
        </div>

        {parsedTargets.map((target, index) => (
          <CandidateCard
            key={target.id}
            target={target}
            index={index}
            canRemove={parsedTargets.length > 1}
            onChange={updateTarget}
            onRemove={removeTarget}
          />
        ))}

        <button
          type="button"
          onClick={addTarget}
          disabled={targets.length >= MAX_TARGETS}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-5 py-4 text-sm font-bold text-brand-800 hover:border-brand-500 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            +
          </span>
          {targets.length >= MAX_TARGETS
            ? "Maximum of 20 candidates reached"
            : "Add another candidate"}
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-3.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset"
        >
          {error}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 text-sm leading-relaxed text-ink-700 ring-1 ring-ink-200">
        <input
          type="checkbox"
          required
          checked={organizerAttested}
          onChange={(event) => setOrganizerAttested(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-brand-700"
        />
        <span>
          I reviewed every candidate and official donation link. I understand
          this drive will be labeled as community-created until Capital Ark
          independently reviews it.
        </span>
      </label>

      <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!canSubmit}
        >
          Publish drive and get my link
        </Button>
        <p className="mt-2 text-center text-xs leading-relaxed text-ink-500">
          Community-created drives are labeled clearly. Listing a candidate
          isn&rsquo;t an endorsement, and Capital Ark never handles contributions.
        </p>
      </div>
    </form>
  );
}

type ParsedTarget = TargetDraft & {
  platform: ReturnType<typeof detectPlatform>;
  goalCents: number | null;
};

function CandidateCard({
  target,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  target: ParsedTarget;
  index: number;
  canRemove: boolean;
  onChange: <K extends keyof TargetDraft>(
    id: string,
    key: K,
    value: TargetDraft[K],
  ) => void;
  onRemove: (id: string) => void;
}) {
  const fieldId = (name: string) => `${name}-${target.id}`;
  const urlTouched = target.donationUrl.trim().length > 6;

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-ink-500">
            Candidate {index + 1}
          </p>
          <h3 className="mt-0.5 font-bold text-ink-900">
            {target.candidateName.trim() || "Candidate details"}
          </h3>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(target.id)}
            className="tap-target inline-flex items-center text-sm font-semibold text-red-700 hover:text-red-900"
            aria-label={`Remove candidate ${index + 1}`}
          >
            Remove
          </button>
        )}
      </div>

      <Field
        label="Official donation link"
        htmlFor={fieldId("donation-url")}
        hint="From WinRed, ActBlue, or Anedot. Organizers must review every link before publishing."
        error={
          urlTouched && !target.platform
            ? "We don't recognize that as a WinRed, ActBlue, or Anedot page."
            : null
        }
      >
        <Input
          id={fieldId("donation-url")}
          type="url"
          required
          inputMode="url"
          autoComplete="off"
          placeholder="Paste the candidate's official donation-page URL"
          value={target.donationUrl}
          invalid={urlTouched && !target.platform}
          onChange={(event) =>
            onChange(target.id, "donationUrl", event.target.value)
          }
        />
      </Field>

      {target.platform && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200 ring-inset">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 size-5 shrink-0 text-emerald-700"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-medium text-emerald-900">
            Recognized {PLATFORM_LABELS[target.platform]} link. Capital Ark
            never receives the contribution.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Candidate name" htmlFor={fieldId("candidate-name")}>
          <Input
            id={fieldId("candidate-name")}
            required
            placeholder="Candidate's full name"
            value={target.candidateName}
            onChange={(event) =>
              onChange(target.id, "candidateName", event.target.value)
            }
          />
        </Field>

        <Field label="Office sought" htmlFor={fieldId("office")}>
          <Input
            id={fieldId("office")}
            required
            placeholder="e.g. State House — District 12"
            value={target.office}
            onChange={(event) =>
              onChange(target.id, "office", event.target.value)
            }
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Party" htmlFor={fieldId("party")}>
          <select
            id={fieldId("party")}
            required
            value={target.party}
            onChange={(event) =>
              onChange(target.id, "party", event.target.value as Party | "")
            }
            className="h-12 w-full rounded-xl bg-white px-3.5 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none"
          >
            <option value="" disabled>
              Select a party
            </option>
            {PARTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="State" htmlFor={fieldId("state")} hint="Two-letter abbreviation.">
          <Input
            id={fieldId("state")}
            required
            maxLength={2}
            placeholder="e.g. NC"
            value={target.state}
            onChange={(event) =>
              onChange(target.id, "state", event.target.value.toUpperCase())
            }
            className="uppercase"
          />
        </Field>
      </div>

      <Field label="Election level" htmlFor={fieldId("jurisdiction")}>
        <select
          id={fieldId("jurisdiction")}
          required
          value={target.jurisdiction}
          onChange={(event) =>
            onChange(
              target.id,
              "jurisdiction",
              event.target.value as Jurisdiction | "",
            )
          }
          className="h-12 w-full rounded-xl bg-white px-3.5 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none"
        >
          <option value="" disabled>
            Select election level
          </option>
          <option value={Jurisdiction.STATE}>State or local</option>
          <option value={Jurisdiction.FEDERAL}>Federal</option>
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Goal for this candidate"
          htmlFor={fieldId("goal")}
          error={
            target.goalText && target.goalCents === null
              ? "Enter an amount like 25000."
              : null
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-ink-500">
              $
            </span>
            <Input
              id={fieldId("goal")}
              required
              inputMode="decimal"
              placeholder="25,000"
              className="pl-8"
              value={target.goalText}
              invalid={Boolean(target.goalText) && target.goalCents === null}
              onChange={(event) =>
                onChange(target.id, "goalText", event.target.value)
              }
            />
          </div>
        </Field>

        <Field label="Deadline" htmlFor={fieldId("deadline")} hint="Optional.">
          <Input
            id={fieldId("deadline")}
            type="date"
            value={target.deadline}
            onChange={(event) =>
              onChange(target.id, "deadline", event.target.value)
            }
          />
        </Field>
      </div>
    </Card>
  );
}

function SetupSteps({ candidateCount }: { candidateCount: number }) {
  return (
    <ol
      aria-label="Drive setup progress"
      className="grid grid-cols-3 overflow-hidden rounded-2xl bg-white text-xs font-semibold text-ink-600 ring-1 ring-ink-200"
    >
      <li className="border-r border-ink-100 bg-brand-50 px-3 py-3 text-brand-800">
        1. Drive
      </li>
      <li className="border-r border-ink-100 bg-brand-50 px-3 py-3 text-brand-800">
        2. {candidateCount} {candidateCount === 1 ? "candidate" : "candidates"}
      </li>
      <li className="px-3 py-3">3. Publish</li>
    </ol>
  );
}
