import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ReceiptCaptureHelp } from "./receipt-capture-help";
import { ReceiptDropzone } from "./receipt-dropzone";

describe("receipt verification UI", () => {
  it("uses a compact native disclosure with guidance for common devices", () => {
    const html = renderToStaticMarkup(createElement(ReceiptCaptureHelp));

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Need help capturing a receipt?");
    expect(html).toContain("iPhone:");
    expect(html).toContain("Android:");
    expect(html).toContain("Windows:");
    expect(html).toContain("Mac:");
    expect(html).toContain("Email receipt:");
  });

  it("tells contributors what to keep and what private details to crop", () => {
    const html = renderToStaticMarkup(createElement(ReceiptCaptureHelp));

    expect(html).toContain("completed status");
    expect(html).toContain("address");
    expect(html).toContain("email");
    expect(html).toContain("phone number");
    expect(html).toContain("card digits");
  });

  it("labels the image upload as required and accepts supported image formats", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptDropzone, {
        onResult: vi.fn(),
        onClear: vi.fn(),
      }),
    );

    expect(html).toContain("Upload receipt screenshot");
    expect(html).toContain("(required)");
    expect(html).toContain('type="file"');
    expect(html).toContain("required");
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html.toLowerCase()).not.toContain("optional");
  });

  it("keeps the contribution modal free of a self-report fallback", () => {
    const modalSource = readFileSync(
      new URL("./contribute-flow-modal.tsx", import.meta.url),
      "utf8",
    );

    expect(modalSource).not.toMatch(/self[ -]?report/i);
    expect(modalSource).toContain("Add receipt-backed contribution");
    expect(modalSource).toContain("Nothing has been added");
  });
});
