/**
 * Sanity-checks the organizer wizard's sticky submit for real overlap.
 *
 * A full-page screenshot renders `position: sticky` at whatever offset the
 * resized viewport implies, which makes a correctly-pinned footer look like it
 * is floating over the form. This measures the live geometry instead.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3002";
await mkdir("screenshots/wizard", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });

  const submit = page.getByRole("button", { name: /create drive/i });
  const textarea = page.locator("textarea").first();

  for (const [label, scroll] of [["top", 0], ["bottom", 99_999]]) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(250);

    const s = await submit.boundingBox();
    const t = await textarea.boundingBox();
    const overlaps =
      s && t && s.y < t.y + t.height && s.y + s.height > t.y;

    console.log(
      `  scrolled ${label}: submit y=${s?.y.toFixed(0)} h=${s?.height.toFixed(0)}, ` +
        `textarea y=${t?.y.toFixed(0)} h=${t?.height.toFixed(0)} -> ` +
        (overlaps ? "OVERLAPS" : "clear"),
    );

    // What is actually under the middle of the submit button?
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60) : "none";
      },
      [s.x + s.width / 2, s.y + s.height / 2],
    );
    console.log(`    topmost element at submit centre: ${hit}`);

    await page.screenshot({ path: `screenshots/wizard/${label}.png` });
  }
} finally {
  await browser.close();
}
