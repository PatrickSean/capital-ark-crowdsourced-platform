import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import {
  hempCandidates,
  hempCoalition,
  hempTargets,
} from "../src/lib/data/campaigns/nc-hemp";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = join(process.cwd(), "public", "social", "v1");
const BRAND = "#1E6851";
const BRAND_DARK = "#123F35";
const INK = "#0F172A";
const MUTED = "#475569";
const PALE = "#E7F4EF";

const markBuffer = await readFile(
  join(process.cwd(), "public", "brand", "capital-ark-mark.png"),
);
const markDataUrl = `data:image/png;base64,${markBuffer.toString("base64")}`;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let truncated = false;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharacters || current.length === 0) {
      current = next;
      continue;
    }

    if (lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
      continue;
    }

    truncated = true;
    break;
  }

  if (lines.length < maxLines && current) lines.push(current);

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = `${lines.at(-1)?.replace(/[.,;:!?]?$/, "")}…`;
  }

  return lines.map(escapeXml);
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  className: string,
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${line}</text>`,
    )
    .join("");
}

function sharedDefs(): string {
  return `
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#EFF8F4"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#123F35" flood-opacity="0.13"/>
      </filter>
      <clipPath id="markClip" clipPathUnits="objectBoundingBox"><rect width="1" height="1" rx="0.22"/></clipPath>
      <style>
        text { font-family: Arial, Helvetica, sans-serif; }
        .brand { fill: ${INK}; font-size: 31px; font-weight: 700; letter-spacing: -0.5px; }
        .eyebrow { fill: ${BRAND}; font-size: 20px; font-weight: 700; letter-spacing: 2.2px; }
        .title { fill: ${INK}; font-size: 62px; font-weight: 800; letter-spacing: -1.8px; }
        .genericTitle { fill: ${INK}; font-size: 54px; font-weight: 800; letter-spacing: -1.5px; }
        .description { fill: ${MUTED}; font-size: 27px; font-weight: 400; }
        .small { fill: ${MUTED}; font-size: 20px; font-weight: 600; }
      </style>
    </defs>`;
}

function brandLockup(x = 64, y = 54): string {
  return `
    <g transform="translate(${x} ${y})">
      <image href="${markDataUrl}" width="82" height="82" clip-path="url(#markClip)"/>
      <text x="104" y="53" class="brand">Capital Ark</text>
    </g>`;
}

function shell(content: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      ${sharedDefs()}
      <rect width="1200" height="630" fill="url(#background)"/>
      <circle cx="1115" cy="-20" r="250" fill="#D7EEE5" opacity="0.7"/>
      <circle cx="1180" cy="665" r="310" fill="#DDEFE8" opacity="0.85"/>
      ${content}
    </svg>`;
}

function homeCardSvg(): string {
  return shell(`
    ${brandLockup()}
    <text x="64" y="184" class="eyebrow">CROWDFUNDING FOR COMMUNITIES</text>
    ${textLines(["Set a goal. Share one link.", "Watch it fill."], 64, 262, 72, "title")}
    <text x="64" y="429" class="description">Coordinate support across a whole slate—</text>
    <text x="64" y="465" class="description">without Capital Ark ever touching the money.</text>

    <g transform="translate(790 74)" filter="url(#shadow)">
      <rect width="346" height="482" rx="34" fill="#FFFFFF" stroke="#D8E4DF" stroke-width="2"/>
      <text x="30" y="48" fill="${BRAND}" font-size="17" font-weight="700" letter-spacing="1.7">ONE SHARED DRIVE</text>
      ${stepRow(1, "Choose your candidates", 96)}
      ${stepRow(2, "Share one trusted link", 211)}
      ${stepRow(3, "See momentum build", 326)}
      <rect x="30" y="420" width="286" height="10" rx="5" fill="#DCE8E3"/>
      <rect x="30" y="420" width="212" height="10" rx="5" fill="${BRAND}"/>
    </g>

    <g transform="translate(64 546)">
      <circle cx="10" cy="10" r="10" fill="${BRAND}"/>
      <path d="M5.8 10.1 8.8 13l5.5-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="32" y="17" class="small">Official campaign processors</text>
      <circle cx="326" cy="10" r="10" fill="${BRAND}"/>
      <path d="M321.8 10.1 324.8 13l5.5-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="348" y="17" class="small">Transparent progress</text>
    </g>
  `);
}

function stepRow(number: number, label: string, y: number): string {
  return `
    <g transform="translate(30 ${y})">
      <circle cx="31" cy="31" r="31" fill="${PALE}"/>
      <text x="31" y="40" text-anchor="middle" fill="${BRAND}" font-size="26" font-weight="800">${number}</text>
      <text x="82" y="39" fill="${INK}" font-size="22" font-weight="700">${escapeXml(label)}</text>
    </g>`;
}

async function candidateImageDataUrl(photoUrl: string | null): Promise<string | null> {
  if (!photoUrl || !/^\/candidates\/[a-z0-9-]+\.webp$/.test(photoUrl)) {
    return null;
  }
  const data = await readFile(join(process.cwd(), "public", photoUrl.slice(1)));
  const png = await sharp(data).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function coalitionCardSvg(): Promise<string> {
  const goalCents = hempTargets.reduce((sum, target) => sum + target.goalCents, 0);
  const description =
    "Hemp consumers, growers, processors, retailers, and advocates across North Carolina.";
  const portraits = (
    await Promise.all(
      hempCandidates.slice(0, 6).map(async (candidate) => ({
        name: candidate.fullName,
        src: await candidateImageDataUrl(candidate.photoUrl),
      })),
    )
  ).filter((portrait): portrait is { name: string; src: string } => Boolean(portrait.src));

  const portraitPositions = [
    [830, 144, 150],
    [970, 124, 132],
    [915, 268, 168],
    [1054, 265, 116],
    [802, 333, 116],
    [1032, 392, 132],
  ] as const;

  const portraitMarkup = portraits
    .map(({ name, src }, index) => {
      const [x, y, size] = portraitPositions[index];
      const clip = `portrait-${index}`;
      return `
        <defs><clipPath id="${clip}"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath></defs>
        <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2 + 6}" fill="#FFFFFF" filter="url(#shadow)"/>
        <image href="${src}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})">
          <title>${escapeXml(name)}</title>
        </image>`;
    })
    .join("");

  const titleLines = wrapText(hempCoalition.name, 22, 2);
  const descriptionLines = wrapText(description, 48, 2);

  return shell(`
    <ellipse cx="970" cy="330" rx="220" ry="224" fill="#DDEFE8"/>
    ${portraitMarkup}
    ${brandLockup()}
    <g transform="translate(64 158)">
      <rect width="205" height="40" rx="20" fill="#DCFCE7"/>
      <circle cx="24" cy="20" r="8" fill="#16A34A"/>
      <text x="42" y="27" fill="#166534" font-size="18" font-weight="700">PLATFORM REVIEWED</text>
    </g>
    ${textLines(titleLines, 64, 265, 69, "title")}
    ${textLines(descriptionLines, 64, 424, 35, "description")}

    <g transform="translate(64 524)">
      ${statPill(`${hempTargets.length} candidate drives`, 0, 222)}
      ${statPill(`${formatShortDollars(goalCents)} combined goal`, 236, 256)}
      ${statPill("1 shareable link", 506, 196)}
    </g>

  `);
}

function statPill(label: string, x: number, width: number): string {
  return `
    <g transform="translate(${x} 0)">
      <rect width="${width}" height="52" rx="26" fill="#FFFFFF" stroke="#D7E3DE" stroke-width="2"/>
      <text x="${width / 2}" y="33" text-anchor="middle" fill="${INK}" font-size="19" font-weight="700">${escapeXml(label)}</text>
    </g>`;
}

async function targetCardSvg(targetIndex: number): Promise<string> {
  const target = hempTargets[targetIndex];
  const candidate = hempCandidates[targetIndex];
  const photo = await candidateImageDataUrl(candidate.photoUrl);
  const nameLines = wrapText(candidate.fullName, 20, 2);
  const office = `${candidate.office}${candidate.district ? ` · ${candidate.district}` : ""}`;
  const officeLines = wrapText(office, 37, 2);
  const goal = formatShortDollars(target.goalCents);
  const hasProcessor = Boolean(candidate.donationUrl && candidate.platform);
  const actionLabel = hasProcessor ? "See live progress →" : "View drive details →";
  const footer = hasProcessor
    ? "Contributions go directly to the committee’s official processor."
    : "Official contribution link pending. Capital Ark never handles payments.";

  return shell(`
    <defs>
      <clipPath id="candidatePortrait"><rect x="64" y="72" width="408" height="486" rx="38"/></clipPath>
    </defs>
    <rect x="43" y="51" width="450" height="528" rx="46" fill="#D7EEE5"/>
    ${photo ? `<image href="${photo}" x="64" y="72" width="408" height="486" preserveAspectRatio="xMidYMid slice" clip-path="url(#candidatePortrait)"/>` : genericPortrait(64, 72, 408, 486)}

    <g transform="translate(536 56)">
      <image href="${markDataUrl}" width="62" height="62" clip-path="url(#markClip)"/>
      <text x="79" y="40" fill="${INK}" font-size="25" font-weight="700">Capital Ark</text>
    </g>
    <text x="536" y="157" class="eyebrow">${escapeXml(hempCoalition.name.toUpperCase())}</text>
    ${textLines(nameLines, 536, 238, 66, "title")}
    ${textLines(officeLines, 536, 367, 33, "description")}

    <g transform="translate(536 452)">
      <text x="0" y="0" fill="${BRAND}" font-size="20" font-weight="700" letter-spacing="1.5">COMMUNITY GOAL</text>
      <text x="0" y="69" fill="${INK}" font-size="64" font-weight="800">${escapeXml(goal)}</text>
      <g transform="translate(259 16)">
        <rect width="286" height="58" rx="29" fill="${BRAND}"/>
        <text x="143" y="37" text-anchor="middle" fill="#FFFFFF" font-size="20" font-weight="700">${escapeXml(actionLabel)}</text>
      </g>
    </g>
    <text x="536" y="586" fill="${MUTED}" font-size="19">${escapeXml(footer)}</text>
  `);
}

function genericPortrait(x: number, y: number, width: number, height: number): string {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="38" fill="${BRAND}"/>
    <image href="${markDataUrl}" x="${x + 84}" y="${y + 123}" width="240" height="240"/>`;
}

function genericCoalitionCardSvg(): string {
  return shell(`
    ${brandLockup()}
    <text x="64" y="190" class="eyebrow">A COMMUNITY DRIVE ON CAPITAL ARK</text>
    ${textLines(["A shared goal.", "A slate you choose."], 64, 280, 73, "title")}
    <text x="64" y="458" class="description">Open the drive to meet the candidates,</text>
    <text x="64" y="494" class="description">see the goal, and follow current progress.</text>

    <g transform="translate(815 122)" filter="url(#shadow)">
      <rect width="310" height="390" rx="38" fill="#FFFFFF" stroke="#D8E4DF" stroke-width="2"/>
      <image href="${markDataUrl}" x="79" y="48" width="152" height="152"/>
      <rect x="42" y="246" width="226" height="14" rx="7" fill="#DCE8E3"/>
      <rect x="42" y="246" width="162" height="14" rx="7" fill="${BRAND}"/>
      <text x="155" y="309" text-anchor="middle" fill="${INK}" font-size="24" font-weight="700">Follow the momentum</text>
      <text x="155" y="344" text-anchor="middle" fill="${MUTED}" font-size="18">Current progress lives on the page</text>
    </g>
    <text x="64" y="574" class="small">Capital Ark never processes or holds contributions.</text>
  `);
}

function genericTargetCardSvg(): string {
  return shell(`
    ${genericPortrait(64, 72, 408, 486)}
    <g transform="translate(536 56)">
      <image href="${markDataUrl}" width="62" height="62" clip-path="url(#markClip)"/>
      <text x="79" y="40" fill="${INK}" font-size="25" font-weight="700">Capital Ark</text>
    </g>
    <text x="536" y="166" class="eyebrow">COMMUNITY FUNDRAISING DRIVE</text>
    ${textLines(["Support a candidate.", "Track the momentum."], 536, 256, 64, "genericTitle")}
    <text x="536" y="436" class="description">Open the link to see the candidate, goal,</text>
    <text x="536" y="472" class="description">official processor, and current progress.</text>
    <g transform="translate(536 524)">
      <rect width="320" height="62" rx="31" fill="${BRAND}"/>
      <text x="160" y="40" text-anchor="middle" fill="#FFFFFF" font-size="22" font-weight="700">View the drive →</text>
    </g>
  `);
}

function formatShortDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars % 1_000 === 0 ? 0 : 1)}K`;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

async function render(relativePath: string, svg: string): Promise<void> {
  const outputPath = join(OUT_DIR, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

await Promise.all([
  render("capital-ark.png", homeCardSvg()),
  render("coalitions/default.png", genericCoalitionCardSvg()),
  render("coalitions/nc-hemp-industry.png", await coalitionCardSvg()),
  render("targets/default.png", genericTargetCardSvg()),
  ...hempTargets.map(async (_, index) =>
    render(
      `targets/${hempTargets[index].slug}.png`,
      await targetCardSvg(index),
    ),
  ),
]);

console.log(`Generated ${hempTargets.length + 4} social cards in ${OUT_DIR}`);
