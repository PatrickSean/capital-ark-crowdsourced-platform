import type { EmbeddableDriveSummary } from "@/lib/data/store-types";

export const DRIVE_PICKER_RESULT_LIMIT = 50;

export interface DriveSearchRecord {
  drive: EmbeddableDriveSummary;
  normalizedName: string;
  normalizedSlug: string;
}

export interface DriveSearchResult {
  items: EmbeddableDriveSummary[];
  totalMatches: number;
}

const nonSearchCharacters = /[^a-z0-9]+/g;
const combiningMarks = /\p{M}/gu;

export function buildDriveSearchIndex(
  drives: EmbeddableDriveSummary[],
): DriveSearchRecord[] {
  return drives.map((drive) => ({
    drive,
    normalizedName: normalizeDriveSearchText(drive.name),
    normalizedSlug: normalizeDriveSearchText(drive.slug),
  }));
}

export function searchDriveCatalog(
  index: DriveSearchRecord[],
  query: string,
  selectedSlug: string,
  limit = DRIVE_PICKER_RESULT_LIMIT,
): DriveSearchResult {
  const normalizedQuery = normalizeDriveSearchText(query);
  const terms = normalizedQuery ? normalizedQuery.split(" ") : [];

  const ranked = index
    .filter((record) => {
      if (terms.length === 0) return true;
      const haystack = `${record.normalizedName} ${record.normalizedSlug}`;
      return terms.every((term) => haystack.includes(term));
    })
    .map((record) => ({
      ...record,
      rank: rankDrive(record, normalizedQuery, selectedSlug),
    }))
    .sort((left, right) =>
      left.rank !== right.rank
        ? left.rank - right.rank
        : left.drive.name.localeCompare(right.drive.name, "en", {
            sensitivity: "base",
          }),
    );

  return {
    items: ranked.slice(0, Math.max(1, limit)).map(({ drive }) => drive),
    totalMatches: ranked.length,
  };
}

export function normalizeDriveSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(nonSearchCharacters, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function rankDrive(
  record: DriveSearchRecord,
  normalizedQuery: string,
  selectedSlug: string,
): number {
  if (!normalizedQuery) {
    return record.drive.slug === selectedSlug ? 0 : 10;
  }
  if (
    record.normalizedName === normalizedQuery ||
    record.normalizedSlug === normalizedQuery
  ) {
    return 0;
  }
  if (record.normalizedName.startsWith(normalizedQuery)) return 1;
  if (
    record.normalizedName
      .split(" ")
      .some((word) => word.startsWith(normalizedQuery))
  ) {
    return 2;
  }
  return 3;
}
