import {
  ContributionEvidenceType,
  PledgeStatus,
} from "@/generated/prisma/enums";
import type { ProgressSnapshot } from "@/lib/domain/types";
import { percentOf } from "@/lib/money";

export interface ProgressInputRow {
  status: PledgeStatus;
  amountCents: number;
  confirmedAmountCents: number | null;
  userId: string;
  evidenceType: ContributionEvidenceType | null;
}

/**
 * Rolls pledge rows into the three-way split the progress bar renders.
 *
 * Two rules worth stating explicitly, because they're what keeps the bar
 * honest given the platform has no access to candidate backends:
 *
 *  - PENDING dollars are tracked but excluded from `raisedCents`. Someone
 *    clicking through to a donation page is not the same as money moving.
 *  - Only COMPLETED (receipt-verified) dollars contribute to public progress.
 *    Historical UNVERIFIED self-reports remain in storage for audit/history,
 *    but do not move totals or donor counts.
 */
export function computeProgress(
  goalCents: number,
  deadline: Date | string | null,
  rows: ProgressInputRow[],
): ProgressSnapshot {
  let confirmedCents = 0;
  const attestedCents = 0;
  let pendingCents = 0;
  const donors = new Set<string>();

  for (const row of rows) {
    switch (row.status) {
      case PledgeStatus.COMPLETED:
        if (
          row.evidenceType !== ContributionEvidenceType.RECEIPT_ATTACHED &&
          row.evidenceType !== ContributionEvidenceType.RECEIPT_AI_CHECKED
        ) {
          break;
        }
        confirmedCents += row.confirmedAmountCents ?? row.amountCents;
        donors.add(row.userId);
        break;
      case PledgeStatus.UNVERIFIED:
        // Preserved historically, intentionally excluded from public totals.
        break;
      case PledgeStatus.PENDING:
        pendingCents += row.amountCents;
        break;
      // DECLINED and EXPIRED contribute nothing by design.
      default:
        break;
    }
  }

  const raisedCents = confirmedCents;

  return {
    goalCents,
    confirmedCents,
    attestedCents,
    pendingCents,
    raisedCents,
    percent: percentOf(raisedCents, goalCents),
    donorCount: donors.size,
    daysRemaining: daysUntil(deadline),
  };
}

export function daysUntil(deadline: Date | string | null): number | null {
  if (!deadline) return null;

  const end = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(end.getTime())) return null;

  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
