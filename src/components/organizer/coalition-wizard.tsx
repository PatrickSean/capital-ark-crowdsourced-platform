"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { Party } from "@/generated/prisma/enums";
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

/**
 * One-screen drive setup.
 *
 * Two things are deliberately absent. There is no "which processor?" dropdown,
 * because the host of the pasted URL already answers that. And there is no
 * required tracking-code field, because organizers should never have to learn
 * what a source code is; it's derived from the coalition name and tucked
 * behind a disclosure for the minority who care.
 */
export function CoalitionWizard() {
  const router = useRouter();
  const { ensureIdentity } = useIdentity();

  const [coalitionName, setCoalitionName] = useState("");
  const [description, setDescription] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [office, setOffice] = useState("");
  const [party, setParty] = useState<Party>(Party.INDEPENDENT);
  const [stateCode, setStateCode] = useState("");
  const [donationUrl, setDonationUrl] = useState("");
  const [goalText, setGoalText] = useState("");
  const [deadline, setDeadline] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPrefix, setCustomPrefix] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    coalitionSlug: string;
    targetSlug: string;
  } | null>(null);

  const platform = useMemo(
    () => (donationUrl.trim() ? detectPlatform(donationUrl) : null),
    [donationUrl],
  );
  const urlTouched = donationUrl.trim().length > 6;

  const prefix = customPrefix
    ? sanitizeTrackingTag(customPrefix)
    : coalitionName
      ? derivePrefix(coalitionName)
      : "";

  const goalCents = parseAmountToCents(goalText);

  const canSubmit =
    coalitionName.trim().length >= 2 &&
    candidateName.trim().length >= 2 &&
    office.trim().length >= 2 &&
    platform !== null &&
    goalCents !== null &&
    !busy;

  if (result) {
    return (
      <WizardSuccess
        coalitionSlug={result.coalitionSlug}
        targetSlug={result.targetSlug}
        candidateName={candidateName}
      />
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || goalCents === null) return;

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
          candidateName: candidateName.trim(),
          office: office.trim(),
          party,
          state: stateCode.trim().toUpperCase() || null,
          donationUrl: donationUrl.trim(),
          goalCents,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          suggestedAmounts: DEFAULT_AMOUNTS,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? "We couldn't create the drive.");
        return;
      }

      setResult({
        coalitionSlug: payload.coalitionSlug,
        targetSlug: payload.targetSlug,
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
      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-ink-900">
            Who are you raising for?
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Paste the candidate&rsquo;s official donation page. We&rsquo;ll work
            out the rest.
          </p>
        </div>

        <Field
          label="Official donation link"
          htmlFor="donation-url"
          hint="From WinRed, ActBlue, or Anedot."
          error={
            urlTouched && !platform
              ? "We don't recognize that as a WinRed, ActBlue, or Anedot page."
              : null
          }
        >
          <Input
            id="donation-url"
            inputMode="url"
            autoComplete="off"
            placeholder="secure.winred.com/example/donate"
            value={donationUrl}
            invalid={urlTouched && !platform}
            onChange={(e) => setDonationUrl(e.target.value)}
          />
        </Field>

        {platform && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0 text-emerald-700" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium text-emerald-900">
              This is a {PLATFORM_LABELS[platform]} page. Contributions go
              directly there.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Candidate name" htmlFor="candidate-name">
            <Input
              id="candidate-name"
              placeholder="Marcus Webb"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
          </Field>

          <Field label="Office sought" htmlFor="office">
            <Input
              id="office"
              placeholder="U.S. Senate"
              value={office}
              onChange={(e) => setOffice(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Party" htmlFor="party">
            <select
              id="party"
              value={party}
              onChange={(e) => setParty(e.target.value as Party)}
              className="h-12 w-full rounded-xl bg-white px-3.5 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none"
            >
              {PARTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="State" htmlFor="state" hint="Two-letter abbreviation.">
            <Input
              id="state"
              maxLength={2}
              placeholder="NC"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              className="uppercase"
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-ink-900">
            Your group and your goal
          </h2>
        </div>

        <Field label="Group name" htmlFor="coalition-name">
          <Input
            id="coalition-name"
            placeholder="NC Small Business Coalition"
            value={coalitionName}
            onChange={(e) => setCoalitionName(e.target.value)}
          />
        </Field>

        <Field
          label="What brings your group together?"
          htmlFor="description"
          hint="Optional. Shown on the drive page."
        >
          <textarea
            id="description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Independent business owners backing candidates who show up for Main Street."
            className="w-full rounded-xl bg-white px-3.5 py-3 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 ring-inset placeholder:text-ink-400 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fundraising goal"
            htmlFor="goal"
            error={goalText && goalCents === null ? "Enter an amount like 25000." : null}
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-ink-500">
                $
              </span>
              <Input
                id="goal"
                inputMode="decimal"
                placeholder="25,000"
                className="pl-8"
                value={goalText}
                invalid={Boolean(goalText) && goalCents === null}
                onChange={(e) => setGoalText(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Deadline" htmlFor="deadline" hint="Optional.">
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-ink-800"
          >
            {showAdvanced ? "Hide" : "Show"} tracking code settings
          </button>

          {showAdvanced && (
            <div className="mt-3">
              <Field
                label="Tracking code prefix"
                htmlFor="prefix"
                hint="Added to every contribution link so the committee can see the support came from your group. We generate one for you."
              >
                <Input
                  id="prefix"
                  value={customPrefix}
                  placeholder={prefix || "NCSBC"}
                  onChange={(e) => setCustomPrefix(e.target.value)}
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

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset">
          {error}
        </div>
      )}

      {/* Sticky so the submit is always reachable on a long mobile form. The
          fade above it keeps scrolled content from looking abruptly clipped. */}
      <div className="sticky bottom-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          aria-hidden="true"
          className="pointer-events-none h-6 bg-gradient-to-t from-ink-50 to-transparent"
        />
        <div className="bg-ink-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!canSubmit}>
            Create drive and get my link
          </Button>
          <p className="mt-2 text-center text-xs text-ink-500">
            Listing a candidate isn&rsquo;t an endorsement, and Capital Ark
            never handles contributions.
          </p>
        </div>
      </div>
    </form>
  );
}
