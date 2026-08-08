/**
 * Verifies the NC Hemp Industry drive end to end against a running dev server.
 *
 *   node scripts/verify-hemp.mjs [baseUrl]
 *
 * Checks the two things that would silently ruin this campaign: that the
 * outbound link actually carries refcode=HEMP and nothing else, and that the
 * nine candidates with no processor link cannot be contributed to.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3002";
const SHOTS = "screenshots/hemp";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();

try {
  await mkdir(SHOTS, { recursive: true });

  // ---- Coalition dashboard -------------------------------------------------
  console.log("\nCoalition dashboard");
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });

  const heading = await page.locator("h1").first().innerText();
  check("coalition renders", heading.includes("North Carolina Hemp Industry"), heading);

  const cards = await page.locator("h2:text('Fundraising drives') ~ * a[href^='/t/']").count();
  const driveLinks = await page.locator("a[href^='/t/hemp-']").count();
  check("all ten drives listed", driveLinks >= 10, `${driveLinks} links (${cards} cards)`);

  const combinedGoal = await page
    .locator("text=Combined goal")
    .locator("xpath=following-sibling::*[1]")
    .innerText();
  check(
    "combined goal totals the CSV",
    combinedGoal.replace(/[^0-9]/g, "") === "640000",
    combinedGoal,
  );

  const notice = page.locator("#source-of-funds-heading");
  check("source-of-funds warning shown", await notice.isVisible());

  const noticeBody = await notice.locator("xpath=..").innerText();
  check("names the NC business-entity ban", /LLC|business entity/i.test(noticeBody));
  check("states the NC limit", noticeBody.includes("$6,800"));
  check("states the federal limit for Moore", noticeBody.includes("$3,500"));

  await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true });

  // ---- A target with no donation link -------------------------------------
  console.log("\nTarget without a processor link (Destin Hall)");
  await page.goto(`${BASE}/t/hemp-destin-hall`, { waitUntil: "networkidle" });

  const pending = page.locator("text=Not ready for contributions yet");
  check("blocked with an explanation", await pending.isVisible());
  check(
    "no contribute button offered",
    (await page.getByRole("button", { name: /contribute/i }).count()) === 0,
  );
  await page.screenshot({ path: `${SHOTS}/no-link.png`, fullPage: true });

  // ---- A target with a real link ------------------------------------------
  console.log("\nTarget with a processor link (Josh Stein)");
  await page.goto(`${BASE}/t/hemp-josh-stein`, { waitUntil: "networkidle" });

  const contribute = page.getByRole("button", { name: /contribute/i }).first();
  check("contribute button offered", await contribute.isVisible());

  // Intercept the popup so we can read the URL without leaving the site.
  await page.addInitScript(() => {
    window.__opened = null;
    window.open = (url) => {
      window.__opened = url ?? null;
      return {
        closed: false,
        close() {},
        focus() {},
        get location() {
          return {
            set href(v) {
              window.__opened = v;
            },
          };
        },
        set location(v) {
          window.__opened = v;
        },
        document: { write() {}, close() {} },
      };
    };
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: /contribute/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/modal-amount.png` });

  const attestationCopy = await page.locator("[role='dialog']").innerText();
  check(
    "modal names ActBlue",
    attestationCopy.includes("ActBlue"),
    attestationCopy.split("\n").find((l) => l.includes("ActBlue")) ?? "",
  );

  await page.getByRole("button", { name: /^Contribute \$/ }).click();
  await page.waitForFunction(() => window.__opened, null, { timeout: 10_000 });
  const outbound = await page.evaluate(() => window.__opened);

  console.log(`  outbound: ${outbound}`);
  const url = new URL(outbound);
  check("goes to the official ActBlue page", url.hostname === "secure.actblue.com", url.hostname);
  check("refcode is exactly HEMP", url.searchParams.get("refcode") === "HEMP", String(url.searchParams.get("refcode")));
  check("no one-click auto-charge param", !url.searchParams.has("express_lane"));
  check("no recurring enrollment", !url.searchParams.has("recurring"));

  // ---- NC attestation on the confirm step ---------------------------------
  console.log("\nNC attestation");
  await page.getByRole("button", { name: /confirm my contribution/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /read the full statement/i }).click();
  const clauses = await page.locator("[role='dialog']").innerText();

  check("uses the NC wording, not the FEC wording", clauses.includes("business entity"));
  check("warns about LLC funds", /LLC/.test(clauses));
  check("mentions the NC lobbyist bar", /lobbyist/i.test(clauses));
  check("does not show the federal-contractor clause", !clauses.includes("federal contractor"));
  await page.screenshot({ path: `${SHOTS}/nc-attestation.png` });

  // ---- Federal candidate gets federal wording -----------------------------
  console.log("\nFederal candidate (Tim Moore) is treated differently");
  await page.goto(`${BASE}/t/hemp-timothy-k-moore`, { waitUntil: "networkidle" });
  const moore = await page.locator("main").innerText();
  check("shown as a federal race", moore.includes("U.S. House of Representatives"));
  check("federal limit surfaced", moore.includes("$3,500"));

  // ---- Mobile ------------------------------------------------------------
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await phone.newPage();
  await mobilePage.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: `${SHOTS}/dashboard-mobile.png`, fullPage: true });
  console.log("\n  mobile screenshot captured");
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
