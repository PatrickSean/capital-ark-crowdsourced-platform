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

await page.goto(`${BASE}/t/hemp-destin-hall`, { waitUntil: "networkidle" });

// --- Landmarks and headings -------------------------------------------------
check("page has exactly one <h1>", (await page.locator("h1").count()) === 1);
check("page has a <main> landmark", (await page.locator("main").count()) >= 1);
check(
  "progress bar exposes an accessible value",
  Boolean(
    await page.locator('[role="progressbar"]').first().getAttribute("aria-valuetext"),
  ),
);
check(
  "progress bar has an accessible name",
  Boolean(await page.locator('[role="progressbar"]').first().getAttribute("aria-label")),
);

// --- Open the modal by keyboard only ---------------------------------------
await page.keyboard.press("Tab");
let opened = false;
for (let i = 0; i < 25 && !opened; i++) {
  const label = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  if (/Contribute to Destin Hall/i.test(label)) {
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

  const backgroundIsInert = await page.evaluate(() =>
    [...document.body.children]
      .filter((element) => !element.querySelector('[role="dialog"]'))
      .every(
        (element) =>
          element.hasAttribute("inert") &&
          element.getAttribute("aria-hidden") === "true",
      ),
  );
  check("background is hidden from assistive technology", backgroundIsInert);

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
    /Contribute to Destin Hall/i.test(restored),
    restored,
  );

  const unlocked = await page.evaluate(
    () => getComputedStyle(document.body).overflow !== "hidden",
  );
  check("background scroll is restored", unlocked);
}

// --- Already-contributed route ---------------------------------------------
// This path must be discoverable without first visiting the processor and
// must retain all the same dialog/focus behavior as the outbound flow.
const alreadyTrigger = page
  .getByRole("button", { name: "I already contributed" })
  .first();
await alreadyTrigger.focus();
await page.keyboard.press("Enter");
const alreadyOpened = await page
  .waitForSelector('[role="dialog"]', { timeout: 3000 })
  .then(() => true)
  .catch(() => false);
check("already-contributed flow opens via keyboard", alreadyOpened);

if (alreadyOpened) {
  const dialog = page.locator('[role="dialog"]');
  check(
    "already-contributed flow has a descriptive name",
    /already made/i.test((await dialog.getAttribute("aria-label")) ?? ""),
  );
  check(
    "already-contributed flow is two clear steps",
    /step 1 of 2/i.test(
      (await dialog.locator('ol[aria-label^="Progress:"]').getAttribute("aria-label")) ??
        "",
    ),
  );
  check(
    "already-contributed flow says it will not charge the user",
    /nothing will be charged/i.test((await dialog.textContent()) ?? ""),
  );

  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', {
    state: "detached",
    timeout: 3000,
  });
  check(
    "focus returns to already-contributed trigger",
    /I already contributed/i.test(
      await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""),
    ),
  );
}

// --- Reduced motion ---------------------------------------------------------
const reduced = await browser.newContext({ reducedMotion: "reduce" });
const rp = await reduced.newPage();
await rp.goto(`${BASE}/t/hemp-destin-hall`, { waitUntil: "networkidle" });
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
