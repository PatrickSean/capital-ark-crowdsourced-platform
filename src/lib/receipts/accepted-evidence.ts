import { ReceiptCheckStatus } from "@/generated/prisma/enums";
import type { ReceiptEvidenceInput } from "@/lib/data/store-types";

/**
 * Defense-in-depth boundary for every Store implementation. Route handlers
 * authenticate the opaque token first; the Store independently refuses to
 * turn a pledge into public progress unless the derived receipt evidence is a
 * complete match for that exact pledge, recipient target, candidate, and
 * amount.
 */
export function isAcceptedReceiptEvidenceFor(
  evidence: ReceiptEvidenceInput | null | undefined,
  expected: {
    pledgeId: string;
    userId: string;
    targetId: string;
    candidateId: string;
    amountCents: number;
  },
): evidence is ReceiptEvidenceInput {
  return Boolean(
    evidence &&
      evidence.status === ReceiptCheckStatus.AI_CHECKED_MATCH &&
      evidence.pledgeId === expected.pledgeId &&
      evidence.userId === expected.userId &&
      evidence.targetId === expected.targetId &&
      evidence.candidateId === expected.candidateId &&
      evidence.amountCents === expected.amountCents &&
      evidence.extractedAmountCents === expected.amountCents &&
      evidence.amountMatched === true &&
      evidence.processorMatched === true &&
      evidence.datePlausible === true &&
      (evidence.candidateMatched === true ||
        evidence.committeeMatched === true) &&
      /^[0-9a-f]{64}$/.test(evidence.evidenceHash) &&
      typeof evidence.model === "string" &&
      evidence.model.length > 0 &&
      Number.isFinite(evidence.checkedAt.getTime()) &&
      evidence.contributionDate instanceof Date &&
      Number.isFinite(evidence.contributionDate.getTime()) &&
      evidence.reasons.length === 0,
  );
}
