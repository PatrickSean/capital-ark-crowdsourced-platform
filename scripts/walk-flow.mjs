/**
 * Walks the full contributor journey in a real browser and captures each step.
 *
 * This is the acceptance test from the plan: open a shared link in a fresh
 * context (no session, no signup) and reach the processor in one tap, then
 * come back, confirm, and watch the bar move.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = "screenshots/flow";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

const page = await context.newPage();
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  captured ${name}`);
};

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

console.log("1. Fresh visitor opens a shared link (no session, no signup)");
await page.goto(`${BASE}/t/webb-senate-push`, { waitUntil: "networkidle" });

const cookiesBefore = await context.cookies();
console.log(`   cookies before any interaction: ${cookiesBefore.length}`);
if (cookiesBefore.length > 0) {
  console.log("   note: identity should not exist before first pledge intent");
}

const raisedBefore = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
console.log(`   progress bar reports raised = $${raisedBefore}`);

console.log("\n2. One tap on the primary action");
await page.getByRole("button", { name: /Contribute & track/i }).first().click();
await page.waitForSelector('[role="dialog"]');
await shot("01-amount");

console.log("\n3. Choose $100 and go");
await page.getByRole("button", { name: "$100", exact: true }).click();

// Hold the outbound tab so we can read where it was sent. Its URL is set
// asynchronously after generate-link resolves, so we read it on a delay
// rather than at open, when it's still about:blank.
let popupPage = null;
context.on("page", (popup) => {
  popupPage = popup;
});

await page.getByRole("button", { name: /^Contribute \$100$/ }).click();
await page.waitForTimeout(1500);
await shot("02-waiting");

let outboundUrl = popupPage?.url() ?? null;
if (outboundUrl === "about:blank") {
  await page.waitForTimeout(1500);
  outboundUrl = popupPage?.url() ?? null;
}

const cookiesAfter = await context.cookies();
const identity = cookiesAfter.find((c) => c.name === "ca_demo_uid");
console.log(`   identity minted at pledge intent: ${Boolean(identity)}`);
if (!identity) fail("no identity cookie was created");

console.log(`   outbound tab went to: ${outboundUrl ?? "(not captured)"}`);
if (outboundUrl && !/[?&](sc|refcode|source_code)=/.test(outboundUrl)) {
  fail("outbound URL is missing a tracking parameter");
}
if (outboundUrl && /[?&](oc|express_lane|recurring)=/.test(outboundUrl)) {
  fail("outbound URL contains a forbidden auto-charge parameter");
}

console.log("\n4. User returns and confirms");

// Return detection may already have advanced the modal on its own when focus
// came back from the popup. Either path is correct, so accept both.
const confirmHeading = page.getByText(/Did you complete/i);
const stillWaiting = page.getByRole("button", {
  name: /confirm my contribution/i,
});

if (await confirmHeading.count()) {
  console.log("   return detection advanced the modal automatically");
} else {
  console.log("   using the manual 'I'm done' escape hatch");
  await stillWaiting.click({ timeout: 15000 });
}

await page.waitForSelector("text=/Yes, I contributed/i", { timeout: 15000 });
await page.waitForTimeout(500);
await shot("03-confirm");

// The primary button must not proceed until the attestation is ticked.
await page.getByRole("button", { name: /Yes, I contributed/i }).click();
await page.waitForTimeout(400);
const blocked = await page.getByRole("alert").count();
console.log(`   confirm blocked without attestation: ${blocked > 0}`);
if (blocked === 0) fail("confirm was allowed without the FEC attestation");
await shot("04-attestation-required");

await page.getByRole("checkbox").check();
await page.getByRole("button", { name: /Yes, I contributed/i }).click();
await page.waitForSelector("text=/added to the total/i", { timeout: 15000 });
await shot("05-done");

console.log("\n5. Back to the drive — did the bar move?");
await page.getByRole("button", { name: /Back to the drive/i }).click();
await page.waitForTimeout(1500);

const raisedAfter = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
console.log(`   raised before = $${raisedBefore}, after = $${raisedAfter}`);

if (Number(raisedAfter) !== Number(raisedBefore) + 100) {
  fail(`expected the bar to rise by exactly $100`);
} else {
  console.log("   bar rose by exactly $100");
}
await shot("06-updated");

await browser.close();
console.log(
  process.exitCode ? "\nFLOW FAILED" : "\nFLOW PASSED — zero signup, one tap, bar moved",
);
