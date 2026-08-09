import Link from "next/link";
import { Card, PartyBadge, ProcessorBadge } from "@/components/ui/primitives";
import { LayeredProgressBar } from "./layered-progress-bar";
import { ContributeButton } from "@/components/contribute/contribute-button";
import { DeadlinePill } from "./deadline-pill";
import type { TargetView } from "@/lib/domain/types";
import { isAiReceiptReviewConfigured } from "@/lib/receipts/config";

/**
 * A single fundraising drive.
 *
 * Ordered the way someone decides: who this is, how the drive is going, how
 * long is left, then the one action. The action is always the last thing and
 * always full width, so on a phone it sits under the thumb.
 */
export function TargetCandidateCard({ target }: { target: TargetView }) {
  const { candidate, progress } = target;
  const receiptReviewAvailable =
    isAiReceiptReviewConfigured() &&
    Boolean(target.candidate.donationUrlVerifiedAt);

  return (
    <Card className="flex h-full flex-col gap-5 p-5">
      <div className="flex items-start gap-4">
        <Avatar name={candidate.fullName} photoUrl={candidate.photoUrl} />

        <div className="min-w-0 flex-1">
          <Link
            href={`/t/${target.slug}`}
            aria-label={`View the fundraising drive for ${candidate.fullName}`}
            className="tap-target inline-flex items-center text-lg font-bold tracking-tight text-ink-900 hover:text-brand-800"
          >
            {candidate.fullName}
          </Link>
          <p className="mt-0.5 text-sm text-ink-600">
            {candidate.office}
            {candidate.district ? ` · ${candidate.district}` : ""}
            {candidate.state && !candidate.district ? ` · ${candidate.state}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PartyBadge party={candidate.party} />
            <ProcessorBadge platform={candidate.platform} />
            {/* Only when the drive is live. Otherwise the pending block below
                already surfaces this link, with room to explain it. */}
            {candidate.donationUrl && candidate.websiteUrl && (
              <a
                href={candidate.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={`Visit ${candidate.fullName}’s campaign site (opens in a new tab)`}
                className="tap-target inline-flex items-center text-xs font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
              >
                Campaign site
              </a>
            )}
          </div>
        </div>
      </div>

      {candidate.bio && (
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-600">
          {candidate.bio}
        </p>
      )}

      <LayeredProgressBar
        progress={progress}
        ariaLabel={`Fundraising progress for ${candidate.fullName}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600">
        <span>
          <span className="font-semibold text-ink-900">{progress.donorCount}</span>{" "}
          {progress.donorCount === 1 ? "contributor" : "contributors"}
        </span>
        <DeadlinePill daysRemaining={progress.daysRemaining} />
      </div>

      <div className="mt-auto">
        <ContributeButton
          target={target}
          compactPendingState
          receiptReviewAvailable={receiptReviewAvailable}
        />
      </div>
    </Card>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const dimension = size === "lg" ? "size-20 text-2xl" : "size-14 text-lg";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={`${dimension} shrink-0 rounded-full object-cover ring-1 ring-ink-200`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800 ring-1 ring-brand-200`}
    >
      {initials}
    </div>
  );
}
