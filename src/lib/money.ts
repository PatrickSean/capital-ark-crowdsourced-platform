/**
 * Money helpers.
 *
 * Every amount in this system is an integer number of cents. Floats are never
 * used for money: `0.1 + 0.2 !== 0.3` is not an acceptable property for a
 * campaign finance ledger.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** `$1,234.56` */
export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

/** `$1,235` — drops cents when they're zero, for headline figures. */
export function formatCentsShort(cents: number): string {
  return cents % 100 === 0 ? USD_COMPACT.format(cents / 100) : formatCents(cents);
}

/**
 * Parses user-entered text into cents. Tolerant of the ways people actually
 * type money: "$1,234.5", " 50 ", "1234.567".
 * Returns null when the input isn't a usable amount.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100);
}

/** Dollars for URL parameters. Processors expect "50" or "2.5", never "50.00". */
export function centsToUrlAmount(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2).replace(/0$/, "");
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 1000) / 10);
}
