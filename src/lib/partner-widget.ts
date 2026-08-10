import { normalizeGoogleFormsResponderUrl } from "@/lib/google-forms";

export const PARTNER_WIDGET_LABEL_MAX_LENGTH = 120;
export const CAPITAL_ARK_EMBED_RESIZE_MESSAGE = "capital-ark:embed-resize";
export const CAPITAL_ARK_EMBED_RESIZE_REQUEST =
  "capital-ark:embed-resize-request";
export const CAPITAL_ARK_EMBED_MIN_HEIGHT = 480;
export const CAPITAL_ARK_EMBED_MAX_HEIGHT = 2_000;
export const CAPITAL_ARK_EMBED_FALLBACK_HEIGHT = 1_280;

export const CAPITAL_ARK_IFRAME_SANDBOX = [
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-same-origin",
  "allow-scripts",
].join(" ");

export const GOOGLE_FORM_IFRAME_SANDBOX = [
  "allow-forms",
  "allow-same-origin",
  "allow-scripts",
].join(" ");

export function buildPartnerWidgetHtml(args: {
  embedUrl: string;
  driveName: string;
  organizationName: string;
  googleFormUrl: string | null;
}): string {
  const driveName = capLabel(args.driveName, "Capital Ark drive");
  const organization = capLabel(args.organizationName, "");
  const googleForm = normalizeGoogleFormsResponderUrl(args.googleFormUrl ?? "");

  if (!googleForm.ok) {
    throw new Error("A valid Google Forms responder URL is required.");
  }
  if (googleForm.normalizedUrl && !organization) {
    throw new Error("An organization name is required with a Google Form.");
  }

  const driveTitle = `${driveName} — Capital Ark fundraising drive`;
  const formTitle = `${organization} follow-up form`;
  const formSection = googleForm.normalizedUrl
    ? [
        '  <section aria-label="Partner follow-up form" style="min-width:0">',
        `    <p style="margin:0 0 12px;color:#303846;font:600 14px/1.5 system-ui,sans-serif">Responses go directly to ${escapeHtml(organization)} through Google. Capital Ark does not receive them.</p>`,
        "    <iframe",
        `      src="${escapeHtml(googleForm.normalizedUrl)}"`,
        `      title="${escapeHtml(formTitle)}"`,
        "      width=\"100%\"",
        "      height=\"900\"",
        "      loading=\"lazy\"",
        "      referrerpolicy=\"no-referrer\"",
        `      sandbox="${GOOGLE_FORM_IFRAME_SANDBOX}"`,
        "      style=\"width:100%;min-height:720px;border:0;border-radius:16px;background:#fff\"",
        "    ></iframe>",
        "  </section>",
      ]
    : [];

  return [
    "<!-- Capital Ark pilot widget: form responses go directly to Google, never Capital Ark. -->",
    '<div data-capital-ark-partner-widget style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px;width:100%;align-items:start">',
    "  <iframe",
    `    src="${escapeHtml(args.embedUrl)}"`,
    `    title="${escapeHtml(driveTitle)}"`,
    "    width=\"100%\"",
    `    height="${CAPITAL_ARK_EMBED_FALLBACK_HEIGHT}"`,
    "    loading=\"lazy\"",
    "    referrerpolicy=\"no-referrer\"",
    `    sandbox="${CAPITAL_ARK_IFRAME_SANDBOX}"`,
    `    style="width:100%;height:${CAPITAL_ARK_EMBED_FALLBACK_HEIGHT}px;border:0;border-radius:16px;background:#fff"`,
    "  ></iframe>",
    "  <script>",
    "    (() => {",
    "      const script = document.currentScript;",
    "      const frame = script?.previousElementSibling;",
    "      if (!(frame instanceof HTMLIFrameElement)) return;",
    "      let expectedOrigin;",
    "      try { expectedOrigin = new URL(frame.src).origin; } catch { return; }",
    "      window.addEventListener('message', (event) => {",
    "        if (event.source !== frame.contentWindow || event.origin !== expectedOrigin) return;",
    "        const data = event.data;",
    `        if (!data || data.type !== '${CAPITAL_ARK_EMBED_RESIZE_MESSAGE}') return;`,
    "        const height = Math.ceil(Number(data.height));",
    `        if (!Number.isFinite(height) || height < ${CAPITAL_ARK_EMBED_MIN_HEIGHT} || height > ${CAPITAL_ARK_EMBED_MAX_HEIGHT}) return;`,
    "        frame.height = String(height);",
    "        frame.style.height = `${height}px`;",
    "      });",
    "      const requestHeight = () => frame.contentWindow?.postMessage(",
    `        { type: '${CAPITAL_ARK_EMBED_RESIZE_REQUEST}' },`,
    "        expectedOrigin,",
    "      );",
    "      frame.addEventListener('load', requestHeight);",
    "    })();",
    "  </script>",
    ...formSection,
    "</div>",
    '<p style="margin:12px 0 0;color:#59616e;font:13px/1.5 system-ui,sans-serif">Contributions open the recipient committee&rsquo;s official processor. Capital Ark never handles funds or Google Form responses.</p>',
  ].join("\n");
}

function capLabel(value: string, fallback: string): string {
  const label = value.trim();
  if (!label) return fallback;
  return Array.from(label).slice(0, PARTNER_WIDGET_LABEL_MAX_LENGTH).join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
