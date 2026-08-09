import Link from "next/link";
import {
  ActivityType,
  ContributionEvidenceType,
} from "@/generated/prisma/enums";
import type { ActivityItem } from "@/lib/domain/types";
import { formatCentsShort } from "@/lib/money";
import { Card, relativeTime } from "@/components/ui/primitives";

type ActivityScope = "coalition" | "target";

/**
 * Public community momentum without public contributor identities.
 *
 * Activity events contain useful social proof, but receipt images can carry
 * names, addresses, and payment fragments. This component deliberately shows
 * only the event, amount, candidate, and time; it never renders an actor label
 * or a receipt detail.
 */
export function ActivityFeed({
  items,
  scope = "coalition",
}: {
  items: ActivityItem[];
  scope?: ActivityScope;
}) {
  const titleId = `recent-activity-${scope}`;

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className="overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-verified ring-4 ring-verified-soft"
          />
          <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">
            Community momentum
          </p>
        </div>
        <h2
          id={titleId}
          className="mt-2 text-lg font-bold tracking-tight text-ink-900"
        >
          Recent activity
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          {scope === "target"
            ? "Updates for this candidate appear here as supporters report them."
            : "Updates across this drive appear here as supporters report them."}
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-900 ring-1 ring-brand-100 ring-inset">
          <PrivacyIcon />
          <p>
            Contributor names and receipt details stay private. Activity is
            crowdsourced; receipt labels describe evidence shared with Capital
            Ark, not confirmation from a campaign processor.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="mt-5 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100 ring-inset">
            <p className="text-sm font-semibold text-ink-800">
              {scope === "target"
                ? "No support has been reported for this candidate yet."
                : "No support has been reported yet."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              The first contribution a supporter reports will appear here
              without publishing their identity or receipt.
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-ink-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <ActivityMarker item={item} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink-800">
                    {renderMessage(item, scope === "coalition")}
                  </p>
                  <time
                    dateTime={item.createdAt}
                    className="mt-1 block text-xs text-ink-500"
                  >
                    {relativeTime(item.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function renderMessage(item: ActivityItem, showCandidate: boolean) {
  switch (item.type) {
    case ActivityType.PLEDGE_CONFIRMED:
      return (
        <>
          A supporter {renderContributionEvidence(item)}
          {showCandidate && item.candidateName ? (
            <>
              {" "}
              to <CandidateReference item={item} />
            </>
          ) : null}
          .
        </>
      );
    case ActivityType.GOAL_REACHED:
      return (
        <>
          The community reached the fundraising goal
          {showCandidate && item.candidateName ? (
            <>
              {" "}
              for <CandidateReference item={item} />
            </>
          ) : null}
          .
        </>
      );
    case ActivityType.TARGET_CREATED:
      return (
        <>
          {showCandidate && item.candidateName ? (
            <>
              A candidate drive was published for{" "}
              <CandidateReference item={item} />.
            </>
          ) : (
            "This candidate drive was published."
          )}
        </>
      );
    case ActivityType.MEMBER_JOINED:
      return "A supporter joined this coalition.";
    default:
      return "A new community update was posted.";
  }
}

function renderContributionEvidence(item: ActivityItem) {
  const amount = item.amountCents !== null && (
    <span className="font-semibold text-ink-900 tabular-nums">
      {formatCentsShort(item.amountCents)}
    </span>
  );

  if (item.evidenceType === ContributionEvidenceType.RECEIPT_AI_CHECKED) {
    return (
      <>
        added an AI-checked receipt for {amount ? <>a {amount} contribution</> : "a contribution"}
      </>
    );
  }

  if (item.evidenceType === ContributionEvidenceType.RECEIPT_ATTACHED) {
    return (
      <>
        added {amount ? <>a receipt-backed {amount} contribution</> : "a receipt-backed contribution"}
      </>
    );
  }

  return <>reported {amount ? <>a {amount} contribution</> : "a contribution"}</>;
}

function CandidateReference({ item }: { item: ActivityItem }) {
  const label = item.candidateName ?? item.targetTitle ?? "this candidate";

  if (!item.targetSlug) {
    return <span className="font-semibold text-ink-900">{label}</span>;
  }

  return (
    <Link
      href={`/t/${item.targetSlug}`}
      className="font-semibold text-brand-800 underline decoration-brand-300 underline-offset-2 hover:text-brand-950"
    >
      {label}
    </Link>
  );
}

function ActivityMarker({ item }: { item: ActivityItem }) {
  const contribution = item.type === ActivityType.PLEDGE_CONFIRMED;
  const checked =
    item.evidenceType === ContributionEvidenceType.RECEIPT_AI_CHECKED;
  const goal = item.type === ActivityType.GOAL_REACHED;

  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
        checked
          ? "bg-verified-soft text-emerald-800"
          : contribution || goal
            ? "bg-brand-100 text-brand-800"
            : "bg-ink-100 text-ink-600"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path
            fillRule="evenodd"
            d="M16.704 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : contribution ? (
        <span className="text-xs font-bold">$</span>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
      )}
    </span>
  );
}

function PrivacyIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5 8V6a5 5 0 0110 0v2a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2zm8-2v2H7V6a3 3 0 116 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
