"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { absoluteUrl } from "@/lib/site";
import { useNativeShareAvailable } from "@/lib/use-native-share";

/**
 * The end of the wizard.
 *
 * The organizer came here to get a link they can send to people, so that link
 * is the entire screen: big, copyable, with a QR code for in-person events and
 * a native share button for the group chat.
 */
export function WizardSuccess({
  coalitionSlug,
  targetSlug,
  candidateName,
}: {
  coalitionSlug: string;
  targetSlug: string;
  candidateName: string;
}) {
  const shareUrl = absoluteUrl(`/t/${targetSlug}`);
  const [copied, setCopied] = useState(false);
  const canShare = useNativeShareAvailable();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The form this replaces is long, so without resetting scroll the organizer
  // lands on the footer instead of the link they came for. Focus follows so
  // screen reader users are told the view changed.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    headingRef.current?.focus();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: `Support ${candidateName}`,
        url: shareUrl,
      });
    } catch {
      void copy();
    }
  };

  return (
    <div className="animate-rise space-y-5">
      <Card className="p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-8 text-emerald-700" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-xl font-bold tracking-tight text-ink-900 outline-none sm:text-2xl"
        >
          Your drive is live
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
          Send this link to your group. Anyone who opens it can contribute
          straight away — no account needed.
        </p>

        <div className="mt-5 rounded-xl bg-ink-50 p-3.5 ring-1 ring-ink-200 ring-inset">
          <p className="break-all font-mono text-sm text-ink-800">{shareUrl}</p>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" fullWidth onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button size="lg" fullWidth variant="secondary" onClick={share}>
              Share
            </Button>
          )}
        </div>

        <QrCode value={shareUrl} />
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/t/${targetSlug}`}
          className="tap-target flex flex-1 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
        >
          View the drive page
        </Link>
        <Link
          href={`/c/${coalitionSlug}`}
          className="tap-target flex flex-1 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
        >
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}

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
          width: 180,
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
    <div className="mt-6 border-t border-ink-100 pt-6">
      <p className="text-xs font-medium text-ink-500">
        Or have people scan this at your next meeting
      </p>
      <div className="mt-3 flex justify-center">
        <canvas
          ref={canvasRef}
          className="rounded-xl ring-1 ring-ink-200"
          role="img"
          aria-label="QR code linking to your drive"
        />
      </div>
    </div>
  );
}
