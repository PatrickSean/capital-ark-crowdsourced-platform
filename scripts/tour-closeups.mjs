/**
 * Viewport-sized captures for review.
 *
 * The full-page shots in tour.mjs scale a 4000px dashboard down until the copy
 * is unreadable, which defeats the point when the thing being reviewed is the
 * wording on a compliance notice. These are cropped to the viewport instead.
 *
 *   node scripts/tour-closeups.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3002";
const OUT = "screenshots/closeup";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const shot = async (name, opts = {}) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log(`  ${name}`);
};

await page.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
await shot("01-dashboard-top");

// The first few drive cards, at a size where the processor badge is legible.
const list = page.locator("main >> text=Fundraising drives").first();
await list.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot("02-drive-cards");

await page.evaluate(() => window.scrollBy(0, 900));
await page.waitForTimeout(400);
await shot("03-drive-cards-more");

await page.goto(`${BASE}/t/hemp-destin-hall`, { waitUntil: "networkidle" });
await shot("04-target-winred");

await page.goto(`${BASE}/t/hemp-timothy-k-moore`, { waitUntil: "networkidle" });
await shot("05-target-federal");
await page.evaluate(() => window.scrollBy(0, 520));
await page.waitForTimeout(300);
await shot("06-target-federal-limits");

await browser.close();
console.log(`\nWrote to ${OUT}\n`);
