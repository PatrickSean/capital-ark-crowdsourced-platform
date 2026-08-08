"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { parseReceiptText } from "@/lib/ocr/parse-receipt";

export interface ReceiptResult {
  file: File;
  previewUrl: string;
  ocrAmountCents: number | null;
  ocrConfidence: number;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/heic"];

/**
 * Optional receipt attachment with in-browser OCR.
 *
 * The image is read locally and only uploaded on confirm. Running OCR client
 * side means a document with the donor's name and partial card number never
 * touches our servers just to extract a dollar figure.
 */
export function ReceiptDropzone({
  onResult,
  onClear,
  disabled,
}: {
  onResult: (result: ReceiptResult) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResult | null>(null);

  // Revoke the object URL on unmount so previews don't leak memory.
  const previewRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED.includes(file.type)) {
        setError("That file type isn't supported. Use a PNG, JPEG, or WebP image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("That image is over 10MB. Try a screenshot instead of a photo.");
        return;
      }

      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const previewUrl = URL.createObjectURL(file);
      previewRef.current = previewUrl;

      const base: ReceiptResult = {
        file,
        previewUrl,
        ocrAmountCents: null,
        ocrConfidence: 0,
      };

      setResult(base);
      onResult(base);

      setBusy(true);
      try {
        const text = await runOcr(file);
        const parsed = parseReceiptText(text);
        const withOcr: ReceiptResult = {
          ...base,
          ocrAmountCents: parsed.amountCents,
          ocrConfidence: parsed.confidence,
        };
        setResult(withOcr);
        onResult(withOcr);
      } catch {
        // OCR is a convenience. If it fails the receipt is still attached and
        // the user just types the amount, so this is not surfaced as an error.
      } finally {
        setBusy(false);
      }
    },
    [onResult],
  );

  const clear = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }, [onClear]);

  if (result) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.previewUrl}
          alt="Receipt preview"
          className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-emerald-300"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-900">Receipt attached</p>
          <p className="truncate text-xs text-emerald-700">{result.file.name}</p>
          {busy && (
            <p className="mt-1 text-xs text-emerald-700">Reading the amount…</p>
          )}
          {!busy && result.ocrAmountCents !== null && (
            <p className="mt-1 text-xs text-emerald-700">
              We read {formatCents(result.ocrAmountCents)}
              {result.ocrConfidence < 0.6 && " — please double-check"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="tap-target shrink-0 rounded-lg px-2 text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4",
          "text-sm font-medium transition-colors",
          dragging
            ? "border-brand-500 bg-brand-50 text-brand-800"
            : "border-ink-300 bg-white text-ink-600 hover:border-ink-400 hover:bg-ink-50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
          <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
          <path d="M9 13h2v3a1 1 0 11-2 0v-3z" />
        </svg>
        Add a receipt screenshot
        <span className="text-ink-400">(optional)</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        // Sends mobile users straight to the camera rather than a file browser.
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Runs Tesseract in the browser.
 *
 * Imported dynamically: the WASM bundle is multiple megabytes and most users
 * never attach a receipt, so it must not be part of the initial page load.
 */
async function runOcr(file: File): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng");
  return data.text ?? "";
}
