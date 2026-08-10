import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

async function configuredHeaders(): Promise<HeaderRule[]> {
  if (typeof nextConfig.headers !== "function") {
    throw new Error("Next.js headers configuration is missing");
  }

  return (await nextConfig.headers()) as HeaderRule[];
}

function valueFor(rule: HeaderRule, key: string): string | undefined {
  return rule.headers.find((header) => header.key === key)?.value;
}

describe("embed security headers", () => {
  it("keeps application pages unframeable", async () => {
    const rules = await configuredHeaders();
    const application = rules.find((rule) =>
      rule.source.startsWith("/:path((?!embed"),
    );

    expect(application).toBeDefined();
    expect(valueFor(application!, "X-Frame-Options")).toBe("DENY");
    expect(valueFor(application!, "Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("exposes only the dedicated embed route to secure parent pages", async () => {
    const rules = await configuredHeaders();
    const embed = rules.find((rule) => rule.source === "/embed/:path*");

    expect(embed).toBeDefined();
    expect(valueFor(embed!, "X-Frame-Options")).toBeUndefined();
    expect(valueFor(embed!, "Content-Security-Policy")).toContain(
      "frame-ancestors https:",
    );
    expect(valueFor(embed!, "Content-Security-Policy")).toContain(
      "form-action 'none'",
    );
    expect(valueFor(embed!, "Referrer-Policy")).toBe("no-referrer");
    expect(valueFor(embed!, "Cross-Origin-Resource-Policy")).toBe(
      "cross-origin",
    );
  });

  it("allows previews only on the widget builder", async () => {
    const rules = await configuredHeaders();
    const builder = rules.find(
      (rule) => rule.source === "/partners/widgets",
    );
    const csp = valueFor(builder!, "Content-Security-Policy");

    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://docs.google.com");
    expect(csp).not.toContain("frame-src https:");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
