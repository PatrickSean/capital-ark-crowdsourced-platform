/**
 * WCAG AA scan for the public launch routes at desktop and phone widths.
 * Start a production server first, then run `npm run test:a11y`.
 */
import axe from "axe-core";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3210";
const routes = [
  "/",
  "/drives",
  "/c/nc-hemp-industry",
  "/t/hemp-destin-hall",
  "/start",
  "/compliance",
  "/privacy",
  "/terms",
  "/partners/widgets",
  "/embed/nc-hemp-industry",
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
];

const browser = await chromium.launch();
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.addScriptTag({ content: axe.source });
      await collectViolations(page, route, viewport.name, "default");

      if (route === "/partners/widgets") {
        const drivePicker = page.locator('button[aria-haspopup="listbox"]');
        if ((await drivePicker.count()) > 0) {
          await drivePicker.click();
          await collectViolations(page, route, viewport.name, "picker-open");
        }
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

async function collectViolations(page, route, viewport, state) {
  const result = await page.evaluate(async () =>
    globalThis.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    }),
  );

  for (const violation of result.violations) {
    failures.push({
      route,
      viewport,
      state,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      help: violation.help,
    });
  }
}

if (failures.length > 0) {
  console.error("WCAG AA violations:");
  console.table(failures);
  process.exitCode = 1;
} else {
  console.log(
    `PASS: ${routes.length} public routes at ${viewports.length} viewport sizes have no axe WCAG AA violations.`,
  );
}
