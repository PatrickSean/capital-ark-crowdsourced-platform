/**
 * Captures a walkthrough of the app for review.
 *
 *   node scripts/tour.mjs [baseUrl]
 *
 * Writes to screenshots/tour/. Not a test: it asserts nothing and is only here
 * to produce images of each screen in a known state.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3002";
const OUT = "screenshots/tour";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log(`  ${name}`);
};

try {
  const desktop = await browser.newContext({
    viewport: { width: 1360, height: 940 },
    deviceScaleFactor: 2,
  });
  const page = await desktop.newPage();

  // Stub the popup so opening the contribute flow never leaves the app.
  await page.addInitScript(() => {
    window.__opened = null;
    window.open = (url) => {
      window.__opened = url ?? null;
      return {
        closed: false,
        close() {},
        focus() {},
        get location() {
          return { set href(v) { window.__opened = v; } };
        },
        set location(v) { window.__opened = v; },
        document: { write() {}, close() {} },
      };
    };
  });

  console.log("\nDesktop");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "01-home", { fullPage: true });

  await page.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
  await shot(page, "02-hemp-dashboard", { fullPage: true });

  await page.goto(`${BASE}/t/hemp-josh-stein`, { waitUntil: "networkidle" });
  await shot(page, "03-target-state-actblue", { fullPage: true });

  await page.goto(`${BASE}/t/hemp-destin-hall`, { waitUntil: "networkidle" });
  await shot(page, "04-target-state-winred", { fullPage: true });

  // The one federal race on the list, so the limits and attestation differ.
  await page.goto(`${BASE}/t/hemp-timothy-k-moore`, { waitUntil: "networkidle" });
  await shot(page, "05-target-federal", { fullPage: true });

  await page.goto(`${BASE}/t/hemp-josh-stein`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /contribute/i }).first().click();
  await page.waitForTimeout(400);
  await shot(page, "06-modal-amount");

  await page.getByRole("button", { name: /^Contribute \$/ }).click();
  await page.waitForFunction(() => window.__opened, null, { timeout: 10_000 });
  console.log(`  outbound: ${await page.evaluate(() => window.__opened)}`);
  await page.waitForTimeout(300);
  await shot(page, "07-modal-waiting");

  await page.getByRole("button", { name: /confirm my contribution/i }).click();
  await page.waitForTimeout(300);
  await shot(page, "08-modal-confirm");

  await page.getByRole("button", { name: /read the full statement/i }).click();
  await page.waitForTimeout(200);
  await shot(page, "09-modal-nc-attestation");

  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /^Yes, I contributed$/ }).click();
  await page.waitForTimeout(900);
  await shot(page, "10-modal-done");

  await page.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
  await shot(page, "11-hemp-dashboard-after", { fullPage: true });

  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  await shot(page, "12-organizer-wizard", { fullPage: true });

  await page.goto(`${BASE}/c/nc-small-business`, { waitUntil: "networkidle" });
  await shot(page, "13-demo-coalition", { fullPage: true });

  await page.goto(`${BASE}/compliance`, { waitUntil: "networkidle" });
  await shot(page, "14-compliance", { fullPage: true });

  console.log("\nMobile");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const m = await phone.newPage();

  await m.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
  await shot(m, "20-mobile-dashboard", { fullPage: true });

  await m.goto(`${BASE}/t/hemp-josh-stein`, { waitUntil: "networkidle" });
  await shot(m, "21-mobile-target");

  await m.getByRole("button", { name: /contribute/i }).first().click();
  await m.waitForTimeout(500);
  await shot(m, "22-mobile-sheet");
} finally {
  await browser.close();
}

console.log(`\nWrote screenshots to ${OUT}\n`);
