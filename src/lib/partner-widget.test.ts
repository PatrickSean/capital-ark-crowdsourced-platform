import { describe, expect, it } from "vitest";
import {
  CAPITAL_ARK_EMBED_FALLBACK_HEIGHT,
  CAPITAL_ARK_EMBED_RESIZE_MESSAGE,
  CAPITAL_ARK_EMBED_RESIZE_REQUEST,
  CAPITAL_ARK_IFRAME_SANDBOX,
  GOOGLE_FORM_IFRAME_SANDBOX,
  buildPartnerWidgetHtml,
} from "./partner-widget";

describe("partner widget HTML", () => {
  it("emits separate, privacy-restricted Capital Ark and Google iframes", () => {
    const html = buildPartnerWidgetHtml({
      embedUrl: "https://capitalark.com/embed/nc-hemp-industry",
      driveName: "North Carolina Hemp Industry",
      organizationName: "Hemp Partners",
      googleFormUrl:
        "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform?embedded=true",
    });

    expect(html.match(/<iframe/g)).toHaveLength(2);
    expect(html).toContain('src="https://capitalark.com/embed/nc-hemp-industry"');
    expect(html).toContain(
      'src="https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform?embedded=true"',
    );
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain(`sandbox="${CAPITAL_ARK_IFRAME_SANDBOX}"`);
    expect(html).toContain(`sandbox="${GOOGLE_FORM_IFRAME_SANDBOX}"`);
    expect(CAPITAL_ARK_IFRAME_SANDBOX).not.toContain("allow-forms");
    expect(GOOGLE_FORM_IFRAME_SANDBOX).not.toContain("allow-popups");
    expect(html).not.toContain("allow-top-navigation");
    expect(html).toContain(
      `height="${CAPITAL_ARK_EMBED_FALLBACK_HEIGHT}"`,
    );
    expect(html).toContain(CAPITAL_ARK_EMBED_RESIZE_MESSAGE);
    expect(html).toContain(CAPITAL_ARK_EMBED_RESIZE_REQUEST);
    expect(html).toContain("event.source !== frame.contentWindow");
    expect(html).toContain("event.origin !== expectedOrigin");
    expect(html).toContain(
      "Responses go directly to Hemp Partners through Google. Capital Ark does not receive them.",
    );
  });

  it("escapes organization, drive, and URL values before writing attributes", () => {
    const payload = '\"><script data-pwned="yes">alert(1)</script>';
    const html = buildPartnerWidgetHtml({
      embedUrl: `https://capitalark.com/embed/test${payload}`,
      driveName: payload,
      organizationName: payload,
      googleFormUrl: null,
    });

    expect(html).not.toContain(payload);
    expect(html).not.toContain("<script data-pwned");
    expect(html).not.toContain('data-pwned="yes"');
    expect(html).toContain("&quot;&gt;&lt;script");
    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(html.match(/<script>/gi)).toHaveLength(1);
  });

  it("escapes visible organization disclosure text", () => {
    const html = buildPartnerWidgetHtml({
      embedUrl: "https://capitalark.com/embed/example",
      driveName: "Example",
      organizationName: 'Neighbors <script>alert("x")</script>',
      googleFormUrl:
        "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform",
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain(
      "Neighbors &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; through Google",
    );
  });

  it("requires an organization name whenever a Google Form is present", () => {
    expect(() =>
      buildPartnerWidgetHtml({
        embedUrl: "https://capitalark.com/embed/example",
        driveName: "Example",
        organizationName: "   ",
        googleFormUrl:
          "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform",
      }),
    ).toThrow("organization name");
  });

  it("rejects an untrusted Google lookalike at the HTML boundary", () => {
    expect(() =>
      buildPartnerWidgetHtml({
        embedUrl: "https://capitalark.com/embed/example",
        driveName: "Example",
        organizationName: "Neighbors",
        googleFormUrl:
          "https://docs.google.com.evil.example/forms/d/e/1FAIpQLSexample/viewform",
      }),
    ).toThrow("valid Google Forms responder URL");
  });

  it("caps generated labels even if a caller bypasses the input limit", () => {
    const longLabel = "A".repeat(500);
    const html = buildPartnerWidgetHtml({
      embedUrl: "https://capitalark.com/embed/example",
      driveName: longLabel,
      organizationName: longLabel,
      googleFormUrl:
        "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform",
    });

    expect(html).not.toContain("A".repeat(121));
    expect(html).toContain("A".repeat(120));
  });
});
