export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;

const SOCIAL_CARD_ROOT = "/social/v1";
const NC_HEMP_COALITION_SLUG = "nc-hemp-industry";
const ncHempTargetSlugs = new Set([
  "hemp-destin-hall",
  "hemp-brenden-h-jones",
  "hemp-david-willis",
  "hemp-jeffrey-c-mcneely",
  "hemp-tricia-ann-cotham",
  "hemp-allen-chesser",
  "hemp-cody-huneycutt",
  "hemp-robert-t-reives-ii",
  "hemp-josh-stein",
  "hemp-tim-moore",
  "hemp-diane-wheatley",
  "hemp-ben-t-moss-jr",
  "hemp-jonathan-l-almond",
  "hemp-brian-echevarria",
  "hemp-erin-pare",
  "hemp-john-m-blust",
  "hemp-joe-pike",
  "hemp-john-l-lowery",
]);

export function homeSocialCardPath(): string {
  return `${SOCIAL_CARD_ROOT}/capital-ark.png`;
}

export function coalitionSocialCardPath(slug: string): string {
  return slug === NC_HEMP_COALITION_SLUG
    ? `${SOCIAL_CARD_ROOT}/coalitions/${slug}.png`
    : `${SOCIAL_CARD_ROOT}/coalitions/default.png`;
}

export function targetSocialCardPath(slug: string): string {
  return ncHempTargetSlugs.has(slug)
    ? `${SOCIAL_CARD_ROOT}/targets/${slug}.png`
    : `${SOCIAL_CARD_ROOT}/targets/default.png`;
}

export function openGraphImageDescriptor(url: string, alt: string) {
  return {
    url,
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    alt,
    type: "image/png",
  } as const;
}

export function twitterImageDescriptor(url: string, alt: string) {
  return {
    url,
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    alt,
  } as const;
}

export function truncateForSocial(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const boundary = lastSpace >= Math.floor(maxLength * 0.7) ? lastSpace : candidate.length;
  return `${candidate.slice(0, boundary).replace(/[.,;:!?-]+$/, "")}…`;
}
