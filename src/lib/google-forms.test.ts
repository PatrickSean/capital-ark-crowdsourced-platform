import { describe, expect, it } from "vitest";
import { normalizeGoogleFormsResponderUrl } from "./google-forms";

const FORM_ID = "1FAIpQLScAbc_123-example";

describe("Google Forms responder URLs", () => {
  it("allows an optional blank value", () => {
    expect(normalizeGoogleFormsResponderUrl("   ")).toEqual({
      ok: true,
      normalizedUrl: null,
    });
  });

  it("normalizes the exact responder URL and discards query parameters and fragments", () => {
    expect(
      normalizeGoogleFormsResponderUrl(
        `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?usp=sharing&embedded=false#responses`,
      ),
    ).toEqual({
      ok: true,
      normalizedUrl: `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?embedded=true`,
    });
  });

  it.each([
    `http://docs.google.com/forms/d/e/${FORM_ID}/viewform`,
    `https://evil.example/forms/d/e/${FORM_ID}/viewform`,
    `https://docs.google.com.evil.example/forms/d/e/${FORM_ID}/viewform`,
    `https://docs.google.com@evil.example/forms/d/e/${FORM_ID}/viewform`,
    `https://docs-google.com/forms/d/e/${FORM_ID}/viewform`,
    `https://forms.gle/${FORM_ID}`,
    `https://docs.google.com/forms/d/${FORM_ID}/edit`,
    `https://docs.google.com/forms/d/e/${FORM_ID}/viewform/`,
    `https://docs.google.com/forms/d/e/bad%2Fid/viewform`,
    `https://user@docs.google.com/forms/d/e/${FORM_ID}/viewform`,
  ])("rejects non-responder or untrusted URLs: %s", (url) => {
    expect(normalizeGoogleFormsResponderUrl(url)).toMatchObject({ ok: false });
  });
});
