/**
 * Provenance for the locally optimized portraits used by the verified NC
 * Hemp slate. The app serves local derivatives for reliability and speed, but
 * retains the authoritative source and reuse terms for every photograph.
 */
export interface CandidatePhotoSource {
  assetPath: string;
  credit: string;
  shortCredit: string;
  sourcePageUrl: string;
  originalImageUrl: string;
  license: string;
  licenseUrl: string;
  retrievedAt: string;
}

const NCGA_DISCLAIMER_URL = "https://www.ncleg.gov/Disclaimer";
const RETRIEVED_AT = "2026-08-09";
const NEW_NCGA_RETRIEVED_AT = "2026-08-10";

const ncgaPortrait = (
  assetName: string,
  memberId: string,
  retrievedAt = RETRIEVED_AT,
): CandidatePhotoSource => ({
  assetPath: `/candidates/${assetName}.webp`,
  credit: "North Carolina General Assembly",
  shortCredit: "NC General Assembly",
  sourcePageUrl: `https://www.ncleg.gov/Members/Biography/H/${memberId}`,
  originalImageUrl: `https://www.ncleg.gov/Members/MemberImage/H/${memberId}/High`,
  license: "Public domain",
  licenseUrl: NCGA_DISCLAIMER_URL,
  retrievedAt,
});

export const NC_HEMP_CANDIDATE_PHOTOS: Readonly<
  Record<string, CandidatePhotoSource>
> = {
  "Destin Hall": ncgaPortrait("destin-hall", "719"),
  "Brenden H. Jones": ncgaPortrait("brenden-jones", "723"),
  "David Willis": ncgaPortrait("david-willis", "779"),
  "Jeffrey C. McNeely": ncgaPortrait("jeffrey-mcneely", "761"),
  "Tricia Ann Cotham": ncgaPortrait("tricia-cotham", "817"),
  "Allen Chesser": ncgaPortrait("allen-chesser", "799"),
  "Cody Huneycutt": ncgaPortrait("cody-huneycutt", "833"),
  "Robert T. Reives II": ncgaPortrait("robert-reives", "684"),
  "Diane Wheatley": ncgaPortrait(
    "diane-wheatley",
    "785",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Ben T. Moss, Jr.": ncgaPortrait(
    "ben-moss",
    "784",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Jonathan L. Almond": ncgaPortrait(
    "jonathan-almond",
    "843",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Brian Echevarria": ncgaPortrait(
    "brian-echevarria",
    "828",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Erin Paré": ncgaPortrait(
    "erin-pare",
    "770",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "John M. Blust": ncgaPortrait(
    "john-blust",
    "234",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Joe Pike": ncgaPortrait(
    "joe-pike",
    "808",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "John L. Lowery": ncgaPortrait(
    "john-lowery",
    "1001",
    NEW_NCGA_RETRIEVED_AT,
  ),
  "Josh Stein": {
    assetPath: "/candidates/josh-stein.webp",
    credit:
      "Sammy Mayo Jr. / U.S. Department of Housing and Urban Development",
    shortCredit: "Sammy Mayo Jr. / HUD",
    sourcePageUrl:
      "https://commons.wikimedia.org/wiki/File:Josh_Stein,_Governor_of_North_Carolina_(cropped).jpg",
    originalImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/b/bb/Josh_Stein%2C_Governor_of_North_Carolina_%28cropped%29.jpg",
    license: "Public domain — U.S. federal government work",
    licenseUrl:
      "https://commons.wikimedia.org/wiki/File:Josh_Stein,_Governor_of_North_Carolina_(cropped).jpg",
    retrievedAt: RETRIEVED_AT,
  },
  "Tim Moore": {
    assetPath: "/candidates/tim-moore.webp",
    credit: "Office of Congressman Tim Moore / U.S. House of Representatives",
    shortCredit: "U.S. House",
    sourcePageUrl: "https://timmoore.house.gov/media/press-kit",
    originalImageUrl:
      "https://timmoore.house.gov/sites/evo-subsites/timmoore.house.gov/files/evo-media-image/2024_moore_tim_official.jpg",
    license: "U.S. federal government work",
    licenseUrl: "https://timmoore.house.gov/copyright",
    retrievedAt: RETRIEVED_AT,
  },
};

export function getNcHempCandidatePhotoSource(
  candidateName: string,
): CandidatePhotoSource | null {
  return NC_HEMP_CANDIDATE_PHOTOS[candidateName] ?? null;
}
