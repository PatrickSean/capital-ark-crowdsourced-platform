import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 1000, deviceScaleFactor: 1 },
};

const PAGES = [
  ["home", "/"],
  ["dashboard", "/c/nc-small-business"],
  ["target", "/t/webb-senate-push"],
  ["wizard", "/start"],
];

const browser = await chromium.launch();

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.isMobile ?? false,
  });

  for (const [label, path] of PAGES) {
    const page = await context.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `${OUT}/${label}-${name}.png`,
      fullPage: name === "desktop",
    });
    console.log(`captured ${label}-${name}`);
    await page.close();
  }

  // The contribute modal, which is the flow's centrepiece.
  const page = await context.newPage();
  await page.goto(`${BASE}/t/webb-senate-push`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Contribute & track/i }).first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/modal-amount-${name}.png` });
  console.log(`captured modal-amount-${name}`);
  await page.close();

  await context.close();
}

await browser.close();
console.log("done");
