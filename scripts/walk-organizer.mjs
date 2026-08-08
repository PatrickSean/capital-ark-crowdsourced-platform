/**
 * Walks the organizer path: paste a donation URL, confirm the processor is
 * detected without a dropdown, and land on a shareable link.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = "screenshots/organizer";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const shot = async (n) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log(`  captured ${n}`);
};

let failed = false;
const check = (name, pass) => {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failed = true;
};

await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });

console.log("There is no processor dropdown to choose from:");
const selects = await page.locator("select").allTextContents();
check("only the party selector exists", selects.length === 1);

console.log("\nPasting an ActBlue URL:");
await page.getByLabel("Official donation link").fill("secure.actblue.com/donate/example-2");
await page.waitForTimeout(600);
check(
  "processor auto-detected and echoed back",
  await page.getByText(/This is a ActBlue page|ActBlue page/i).isVisible(),
);
await shot("01-detected");

console.log("\nPasting an unsupported URL:");
await page.getByLabel("Official donation link").fill("https://example.com/donate");
await page.waitForTimeout(600);
check(
  "unsupported processor is rejected inline",
  await page.getByText(/don't recognize that/i).isVisible(),
);
await shot("02-rejected");

console.log("\nCompleting the form:");
await page.getByLabel("Official donation link").fill("secure.actblue.com/donate/example-2");
await page.getByLabel("Candidate name").fill("Elena Ruiz");
await page.getByLabel("Office sought").fill("U.S. House");
await page.getByLabel("State").fill("NC");
await page.getByLabel("Group name").fill("Durham Care Workers");
await page.getByLabel("Fundraising goal").fill("15000");
await page.waitForTimeout(400);

console.log("\nThe tracking code is derived, not asked for:");
await page.getByRole("button", { name: /tracking code settings/i }).click();
await page.waitForTimeout(300);
const derived = await page.getByLabel("Tracking code prefix").getAttribute("placeholder");
console.log(`  derived prefix: ${derived}`);
check("a prefix was derived from the group name", Boolean(derived) && derived !== "NCSBC");
await shot("03-advanced");

await page.getByRole("button", { name: /Create drive and get my link/i }).click();
await page.waitForSelector("text=/Your drive is live/i", { timeout: 15000 });
await page.waitForTimeout(900);
await shot("04-success");

const link = await page.getByText(/\/t\//).first().textContent();
console.log(`  shareable link: ${link?.trim()}`);
check("ends on a shareable link", Boolean(link && link.includes("/t/")));
check("QR code rendered", (await page.locator("canvas").count()) > 0);

await browser.close();
console.log(failed ? "\nORGANIZER FLOW FAILED" : "\nORGANIZER FLOW PASSED");
process.exitCode = failed ? 1 : 0;
