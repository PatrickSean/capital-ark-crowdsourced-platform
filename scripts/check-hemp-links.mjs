/**
 * End-to-end check that every NC Hemp drive hands off to a real processor page
 * carrying the flat HEMP tag.
 *
 *   node scripts/check-hemp-links.mjs [baseUrl] [--live]
 *
 * Opens each drive and reads the outbound URL the app would send a contributor
 * to, asserting the tag lands in the parameter that processor actually reads.
 *
 * `--live` additionally loads each outbound URL against the real processor.
 * That is the only way to catch link rot -- a committee switching from Anedot
 * to WinRed leaves us with a URL that still parses fine but 404s the donor --
 * so it is worth running periodically even though it is slow and depends on
 * the processors being up.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const BASE = args.find((a) => !a.startsWith("--")) ?? "http://localhost:3002";

const baseUrl = new URL(BASE);
const isLocalBase = ["localhost", "127.0.0.1", "::1"].includes(
  baseUrl.hostname,
);
if (!isLocalBase && process.env.ALLOW_PRODUCTION_MUTATIONS !== "true") {
  throw new Error(
    "Refusing to run against a non-local app: this check creates persistent pledge intents. Use a disposable staging database, or set ALLOW_PRODUCTION_MUTATIONS=true only for an intentional audited run.",
  );
}

/** The parameter each processor reads a source code from. */
const TAG_PARAM = {
  "secure.winred.com": "sc",
  "secure.actblue.com": "refcode",
  "secure.anedot.com": "source_code",
};

// Fixture target ids are deterministic: candidate 220..229 -> target 320..329.
const targetId = (n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const EXPECT = [
  ["Destin Hall", 320, "secure.winred.com"],
  ["Brenden H. Jones", 321, "secure.anedot.com"],
  ["David Willis", 322, "secure.anedot.com"],
  ["Jeffrey C. McNeely", 323, "secure.anedot.com"],
  ["Tricia Ann Cotham", 324, "secure.winred.com"],
  ["Allen Chesser", 325, "secure.anedot.com"],
  ["Cody Huneycutt", 326, "secure.anedot.com"],
  ["Robert T. Reives II", 327, "secure.actblue.com"],
  ["Josh Stein", 328, "secure.actblue.com"],
  ["Tim Moore", 329, "secure.anedot.com"],
];

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(
    `${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

const slug = (n) =>
  `hemp-${n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 950 },
});
const outbound = [];

console.log("\nEvery drive can generate a tracked outbound link");
for (const [name, n, host] of EXPECT) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/t/${slug(name)}`, { waitUntil: "networkidle" });

    // Ask the app for the handoff URL exactly as the modal does.
    const res = await page.evaluate(async (id) => {
      const r = await fetch("/api/targets/generate-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: id, amountCents: 5000 }),
      });
      return { status: r.status, body: await r.json() };
    }, targetId(n));

    if (res.status !== 200) {
      check(
        name,
        false,
        `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`,
      );
      await page.close();
      continue;
    }

    const url = new URL(res.body.outboundUrl);
    const param = TAG_PARAM[url.hostname];
    const tag = url.searchParams.get(param);

    const ok =
      url.hostname === host &&
      url.protocol === "https:" &&
      tag === "HEMP" &&
      res.body.trackingTag === "HEMP" &&
      Boolean(res.body.committeeName);
    check(
      name,
      ok,
      `${url.hostname} ${param}=${tag} → ${res.body.committeeName}`,
    );
    if (ok) outbound.push([name, url.toString(), res.body.committeeName]);
  } catch (err) {
    check(name, false, err.message.split("\n")[0]);
  }
  await page.close();
}

console.log("\nNo drive is left in the pending state");
const dash = await ctx.newPage();
await dash.goto(`${BASE}/c/nc-hemp-industry`, { waitUntil: "networkidle" });
const body = await dash.locator("main").innerText();
check(
  "no 'needs a donation link' warnings",
  !/needs a donation link/i.test(body),
);
check(
  "ten contribute buttons",
  (await dash.getByRole("button", { name: /contribute/i }).count()) === 10,
);
check(
  "NC business-entity notice still shown",
  /business contribution drive/i.test(body),
);
await dash.screenshot({
  path: "screenshots/links/dashboard-linked.png",
  fullPage: true,
});

console.log("\nFederal vs state rules still split correctly");
for (const [name, expected] of [
  ["Tim Moore", /\$3,500 per election/],
  ["Josh Stein", /\$6,800 per election/],
]) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/t/${slug(name)}`, { waitUntil: "networkidle" });
  const t = await p.locator("main").innerText();
  check(`${name} shows the right limit`, expected.test(t));
  await p.close();
}

if (LIVE) {
  console.log(
    "\nEach outbound URL still resolves to its committee's donation form",
  );
  // A plausible desktop UA: WinRed sits behind Cloudflare and will serve an
  // interstitial to an obvious headless client, which would read as a failure.
  const live = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1200, height: 1000 },
    locale: "en-US",
  });

  for (const [name, url, committee] of outbound) {
    const p = await live.newPage();
    try {
      const r = await p.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await p.waitForTimeout(4000);
      const text = (
        await p
          .locator("body")
          .innerText()
          .catch(() => "")
      ).replace(/\s+/g, " ");

      if (/just a moment|security verification/i.test(text)) {
        console.log(`  SKIP  ${name} — bot protection, verify by hand`);
        await p.close();
        continue;
      }

      // Match on a distinctive word from the committee name rather than the
      // whole string: processors render it with their own punctuation and
      // capitalisation, so an exact compare gives false failures.
      const token = committee
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 4 && !/committee|elect|friends|north|carolina/i.test(w),
        )
        .slice(-1)[0];

      const ok =
        r?.status() === 200 && (!token || new RegExp(token, "i").test(text));
      check(
        name,
        ok,
        `HTTP ${r?.status()}${token ? `, looked for "${token}"` : ""}`,
      );
    } catch (err) {
      check(name, false, err.message.split("\n")[0]);
    }
    await p.close();
  }
}

await browser.close();
console.log(
  failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
