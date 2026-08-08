/**
 * Keyboard and screen-reader checks on the contribute modal.
 *
 * The modal is the one place in this app where a user is mid-transaction, so
 * a focus trap that leaks or a dialog that can't be escaped is not a cosmetic
 * problem.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3210";
const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass, detail });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/t/webb-senate-push`, { waitUntil: "networkidle" });

// --- Landmarks and headings -------------------------------------------------
check("page has exactly one <h1>", (await page.locator("h1").count()) === 1);
check("page has a <main> landmark", (await page.locator("main").count()) >= 1);
check(
  "progress bar exposes an accessible value",
  Boolean(
    await page.locator('[role="progressbar"]').first().getAttribute("aria-valuetext"),
  ),
);

// --- Open the modal by keyboard only ---------------------------------------
await page.keyboard.press("Tab");
let opened = false;
for (let i = 0; i < 25 && !opened; i++) {
  const label = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  if (/Contribute & track/i.test(label)) {
    await page.keyboard.press("Enter");
    opened = await page
      .waitForSelector('[role="dialog"]', { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    break;
  }
  await page.keyboard.press("Tab");
}
check("modal opens via keyboard", opened);

if (opened) {
  const dialog = page.locator('[role="dialog"]');
  check("dialog is aria-modal", (await dialog.getAttribute("aria-modal")) === "true");
  check(
    "dialog has an accessible name",
    Boolean(
      (await dialog.getAttribute("aria-label")) ??
        (await dialog.getAttribute("aria-labelledby")),
    ),
  );

  // Focus should have moved into the dialog.
  const focusInside = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return Boolean(dlg && dlg.contains(document.activeElement));
  });
  check("focus moves into the dialog on open", focusInside);

  // Background must be inert to scrolling.
  const bodyLocked = await page.evaluate(
    () => getComputedStyle(document.body).overflow === "hidden",
  );
  check("background scroll is locked", bodyLocked);

  // Tab many times; focus must never escape the dialog.
  let escaped = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return Boolean(dlg && dlg.contains(document.activeElement));
    });
    if (!inside) {
      escaped = true;
      break;
    }
  }
  check("focus is trapped inside the dialog", !escaped);

  // Escape must close it.
  await page.keyboard.press("Escape");
  const closed = await page
    .waitForSelector('[role="dialog"]', { state: "detached", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  check("Escape closes the dialog", closed);

  const restored = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  check(
    "focus returns to the trigger on close",
    /Contribute & track/i.test(restored),
    restored,
  );

  const unlocked = await page.evaluate(
    () => getComputedStyle(document.body).overflow !== "hidden",
  );
  check("background scroll is restored", unlocked);
}

// --- Reduced motion ---------------------------------------------------------
const reduced = await browser.newContext({ reducedMotion: "reduce" });
const rp = await reduced.newPage();
await rp.goto(`${BASE}/t/webb-senate-push`, { waitUntil: "networkidle" });
const animDuration = await rp.evaluate(() => {
  const el = document.querySelector('[role="progressbar"] div div');
  return el ? getComputedStyle(el).transitionDuration : null;
});
check(
  "reduced motion shortens transitions",
  animDuration === null || parseFloat(animDuration) < 0.05,
  String(animDuration),
);
await reduced.close();

await browser.close();

console.log("\nAccessibility checks\n");
for (const r of results) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;
