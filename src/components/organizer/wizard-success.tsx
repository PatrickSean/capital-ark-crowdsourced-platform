"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { absoluteUrl } from "@/lib/site";
import { useNativeShareAvailable } from "@/lib/use-native-share";

export function WizardSuccess({
  coalitionSlug,
  coalitionName,
  candidateCount,
}: {
  coalitionSlug: string;
  coalitionName: string;
  candidateCount: number;
}) {
  const shareUrl = absoluteUrl(`/c/${coalitionSlug}`);
  const shareText = `Join ${coalitionName} and support ${candidateCount === 1 ? "this candidate" : `these ${candidateCount} candidates`}.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const [copied, setCopied] = useState(false);
  const canShare = useNativeShareAvailable();
  const headingRef = useRef<HTMLHeadingElement>(null);

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
      await navigator.share({ title: coalitionName, text: shareText, url: shareUrl });
    } catch {
      void copy();
    }
  };

  return (
    <div className="animate-rise space-y-5">
      <Card className="p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-8 text-emerald-700"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-xl font-bold tracking-tight text-ink-900 outline-none sm:text-2xl"
        >
          Your drive is live
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          One link now takes your community to the complete {candidateCount === 1 ? "candidate" : `${candidateCount}-candidate`} slate.
          Contributions still happen on each committee&rsquo;s own processor.
        </p>

        <div className="mt-5 rounded-xl bg-ink-50 p-3.5 ring-1 ring-ink-200 ring-inset">
          <p className="break-all font-mono text-sm text-ink-800">{shareUrl}</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button size="lg" fullWidth onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button size="lg" fullWidth variant="secondary" onClick={share}>
              Share
            </Button>
          )}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0f7b45] px-4 text-sm font-semibold text-white hover:bg-[#0b693a]"
          >
            Share to WhatsApp
          </a>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          WhatsApp opens with a ready-to-send message. You choose the chat and
          review it before sending.
        </p>

        <QrCode value={shareUrl} />
      </Card>

      <Link
        href={`/c/${coalitionSlug}`}
        className="tap-target flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
      >
        View and share your drive
      </Link>
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
