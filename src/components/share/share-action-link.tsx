"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useNativeShareAvailable } from "@/lib/use-native-share";

/**
 * Share the drive.
 *
 * Uses the native share sheet where it exists, which on a phone is the whole
 * point: the realistic distribution path is someone dropping this into a group
 * chat. Falls back to copy-to-clipboard plus a QR code for in-person events,
 * where reading a URL aloud is the actual failure mode.
 */
export function ShareActionLink({
  url,
  title,
  label = "Share action link",
}: {
  url: string;
  title: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canNativeShare = useNativeShareAvailable();
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;

  const share = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the share sheet, or it failed. Fall through to the
        // modal rather than doing nothing.
      }
    }
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={share}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
          <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
        </svg>
        {label}
      </Button>

      <ModalSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Share this drive"
        description="Anyone with this link can contribute. No account needed."
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-[#0f7b45] px-6 text-base font-semibold text-white transition-colors hover:bg-[#0b6b3a] active:bg-[#075a32]"
            >
              Share to WhatsApp
            </a>
            <Button fullWidth size="lg" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          <QrCode value={url} />

          <div className="rounded-xl bg-ink-50 p-3 ring-1 ring-inset ring-ink-200">
            <p className="text-xs font-medium text-ink-600">Link</p>
            <p className="mt-1 break-all font-mono text-xs text-ink-800">{url}</p>
          </div>

          <p className="text-xs text-ink-500">
            Contributions made through this link are tagged with your
            coalition&rsquo;s tracking code, so the committee can see the
            support came from your group.
          </p>

          <p className="text-xs text-ink-500">
            WhatsApp opens with a draft. You choose where it goes, review it,
            and tap Send.
          </p>
        </div>
      </ModalSheet>
    </>
  );
}

/**
 * Renders the QR client-side and lazily, so the qrcode library isn't in the
 * initial bundle for the many users who never open the share sheet.
 */
function QrCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        if (cancelled || !canvasRef.current) return;
        await QRCode.toCanvas(canvasRef.current, value, {
          width: 200,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) return null;

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="rounded-xl ring-1 ring-ink-200"
        aria-label="QR code for this drive"
        role="img"
      />
    </div>
  );
}
