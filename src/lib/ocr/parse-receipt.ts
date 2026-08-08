/**
 * Pulls a contribution amount out of OCR'd receipt text.
 *
 * Best-effort by design. The extracted figure is only ever used to prefill the
 * amount field with a visible "we read $X — tap to edit"; the user's own
 * attested number is what gets stored. OCR being wrong should cost a tap, not
 * corrupt the ledger.
 */

/** Lines near these words are far more likely to hold the real total. */
const TOTAL_HINTS = [
  "total",
  "amount",
  "contribution",
  "donation",
  "charged",
  "payment",
  "you gave",
  "gift",
];

/** Lines near these are decoys: tips, fees, and running lifetime totals. */
const DECOY_HINTS = ["fee", "tip", "processing", "to date", "lifetime", "goal"];

const MONEY = /\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g;

export interface ReceiptParseResult {
  amountCents: number | null;
  /** 0-1. Below ~0.5 the UI asks the user to confirm rather than asserting. */
  confidence: number;
  candidates: number[];
}

export function parseReceiptText(rawText: string): ReceiptParseResult {
  const text = rawText.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const scored: { cents: number; score: number }[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasHint = TOTAL_HINTS.some((h) => lower.includes(h));
    const hasDecoy = DECOY_HINTS.some((h) => lower.includes(h));

    for (const match of line.matchAll(MONEY)) {
      const cents = toCents(match[1]);
      if (cents === null) continue;

      let score = 1;
      if (hasHint) score += 3;
      if (hasDecoy) score -= 2;
      // Sub-dollar figures on a receipt are nearly always fees.
      if (cents < 100) score -= 1;

      scored.push({ cents, score });
    }
  }

  if (scored.length === 0) {
    return { amountCents: null, confidence: 0, candidates: [] };
  }

  // Highest score wins; ties break toward the larger amount, since the total
  // generally exceeds the fees and line items printed alongside it.
  scored.sort((a, b) => b.score - a.score || b.cents - a.cents);

  const best = scored[0];
  const distinct = [...new Set(scored.map((s) => s.cents))];

  let confidence = 0.35;
  if (best.score >= 4) confidence = 0.9;
  else if (best.score >= 2) confidence = 0.65;
  if (distinct.length === 1) confidence = Math.max(confidence, 0.8);

  return {
    amountCents: best.cents,
    confidence,
    candidates: distinct.slice(0, 5),
  };
}

function toCents(raw: string): number | null {
  const normalized = raw.replace(/,/g, "");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Anything above $1M on a receipt is an OCR artifact, not a contribution.
  if (value > 1_000_000) return null;
  return Math.round(value * 100);
}
