import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";

const SOURCE_URL =
  "https://github.com/PatrickSean/capital-ark-crowdsourced-platform";

describe("DisclaimerFooter open-source disclosure", () => {
  const markup = renderToStaticMarkup(createElement(DisclaimerFooter));
  const linkStart = markup.indexOf(`<a href="${SOURCE_URL}"`);
  const linkEnd = markup.indexOf("</a>", linkStart);
  const sourceLink = markup.slice(linkStart, linkEnd + 4);

  it("offers a restrained, factual code-review invitation", () => {
    expect(markup).toContain("Open source");
    expect(markup).toContain(
      "Capital Ark\u2019s source code is public so anyone can review how the platform works.",
    );
    expect(sourceLink).toContain("Review the code");
    expect(markup).not.toMatch(/\baudited?\b/i);
  });

  it("opens the public repository securely with an accessible name", () => {
    expect(linkStart).toBeGreaterThanOrEqual(0);
    expect(sourceLink).toContain('target="_blank"');
    expect(sourceLink).toContain('rel="noopener noreferrer"');
    expect(sourceLink).toContain(
      'aria-label="Review Capital Ark&#x27;s open-source code (opens in a new tab)"',
    );
  });
});
