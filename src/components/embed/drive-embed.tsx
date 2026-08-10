"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PublicEmbedDriveSnapshot } from "@/lib/embed-drive";
import { formatCentsShort } from "@/lib/money";
import {
  CAPITAL_ARK_EMBED_MAX_HEIGHT,
  CAPITAL_ARK_EMBED_MIN_HEIGHT,
  CAPITAL_ARK_EMBED_RESIZE_MESSAGE,
  CAPITAL_ARK_EMBED_RESIZE_REQUEST,
} from "@/lib/partner-widget";

type PublicEmbedDriveTarget = PublicEmbedDriveSnapshot["targets"][number];
type PublicEmbedDriveActivity = PublicEmbedDriveSnapshot["activity"][number];

const POLL_INTERVAL_MS = 15_000;
const MAX_VISIBLE_CANDIDATES = 4;
const MAX_VISIBLE_ACTIVITY = 2;
const PARTY_STYLES: Record<string, string> = {
  REPUBLICAN: "bg-red-50 text-red-800",
  DEMOCRAT: "bg-blue-50 text-blue-800",
  INDEPENDENT: "bg-ink-100 text-ink-700",
  LIBERTARIAN: "bg-amber-50 text-amber-900",
  GREEN: "bg-emerald-50 text-emerald-800",
  OTHER: "bg-ink-100 text-ink-700",
};
const PARTY_LABELS: Record<string, string> = {
  REPUBLICAN: "Republican",
  DEMOCRAT: "Democrat",
  INDEPENDENT: "Independent",
  LIBERTARIAN: "Libertarian",
  GREEN: "Green",
  OTHER: "Other",
};
const ACTIVITY_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function DriveEmbed({
  initialSnapshot,
  slug,
}: {
  initialSnapshot: PublicEmbedDriveSnapshot;
  slug: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (inFlight || document.visibilityState === "hidden") return;

      inFlight = true;
      controller = new AbortController();

      try {
        const response = await fetch(
          `/api/embed/drives/${encodeURIComponent(slug)}`,
          {
            cache: "no-store",
            credentials: "omit",
            headers: { Accept: "application/json" },
            referrerPolicy: "no-referrer",
            signal: controller.signal,
          },
        );

        if (!response.ok) return;
        const next = (await response.json()) as PublicEmbedDriveSnapshot;
        if (mounted) setSnapshot(next);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Keep the last server-rendered snapshot. A transient refresh failure
          // should never replace useful public progress with an error state.
        }
      } finally {
        inFlight = false;
      }
    }

    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [slug]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || window.parent === window) return;
    const observedContainer: HTMLElement = container;

    function reportHeight() {
      const height = Math.ceil(
        observedContainer.getBoundingClientRect().height,
      );
      if (
        height < CAPITAL_ARK_EMBED_MIN_HEIGHT ||
        height > CAPITAL_ARK_EMBED_MAX_HEIGHT
      ) {
        return;
      }

      window.parent.postMessage(
        {
          type: CAPITAL_ARK_EMBED_RESIZE_MESSAGE,
          height,
        },
        "*",
      );
    }

    const observer = new ResizeObserver(reportHeight);
    observer.observe(observedContainer);
    const onResizeRequest = (event: MessageEvent) => {
      if (
        event.source === window.parent &&
        (event.data as { type?: unknown } | null)?.type ===
          CAPITAL_ARK_EMBED_RESIZE_REQUEST
      ) {
        reportHeight();
      }
    };
    window.addEventListener("message", onResizeRequest);
    reportHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener("message", onResizeRequest);
    };
  }, []);

  return (
    <main
      ref={containerRef}
      className="mx-auto w-full max-w-[760px] p-2 min-[400px]:p-3"
    >
      <article
        aria-label={`${snapshot.coalition.name} community fundraising drive`}
        className="overflow-hidden rounded-[1.375rem] bg-white shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_32px_-16px_rgb(15_23_42/0.28)] ring-1 ring-ink-200"
      >
        <DriveHeader snapshot={snapshot} />
        <DriveProgress snapshot={snapshot} />
        <CandidateList
          targets={snapshot.targets}
          totalCount={snapshot.progress.activeTargetCount}
        />
        <RecentActivity activity={snapshot.activity} />
        <DriveFooter snapshot={snapshot} />
      </article>
    </main>
  );
}

function DriveHeader({ snapshot }: { snapshot: PublicEmbedDriveSnapshot }) {
  const reviewed = snapshot.coalition.verificationStatus === "PLATFORM_VERIFIED";
  const count = snapshot.progress.activeTargetCount;

  return (
    <header className="border-b border-ink-100 px-4 pt-4 pb-5 min-[420px]:px-5 min-[420px]:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-sm font-bold text-ink-900">
          <Image
            src="/icons/capital-ark-192.png"
            alt=""
            width={32}
            height={32}
            sizes="32px"
            className="size-8 rounded-[0.65rem]"
            priority
          />
          Capital Ark
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] leading-4 font-bold ${
            reviewed
              ? "bg-verified-soft text-emerald-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {reviewed ? <CheckIcon /> : <CommunityIcon />}
          {reviewed ? "Platform reviewed" : "Community-created"}
        </span>
      </div>

      <h1 className="mt-4 text-xl leading-tight font-bold tracking-tight text-ink-950 min-[420px]:text-2xl">
        {snapshot.coalition.name}
      </h1>
      <p className="mt-1.5 text-sm text-ink-600">
        {count} {count === 1 ? "candidate" : "candidates"} in this community
        drive
      </p>
    </header>
  );
}

function DriveProgress({ snapshot }: { snapshot: PublicEmbedDriveSnapshot }) {
  const { progress } = snapshot;
  const width = Math.max(0, Math.min(100, progress.percent));

  return (
    <section
      aria-label="Drive progress"
      className="border-b border-ink-100 bg-ink-50/70 px-4 py-4 min-[420px]:px-5"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-ink-500 uppercase">
            Receipt-backed
          </p>
          <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-ink-950 tabular-nums">
            {formatCentsShort(progress.confirmedCents)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-500">Goal</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-800 tabular-nums">
            {formatCentsShort(progress.goalCents)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`${snapshot.coalition.name} receipt-backed fundraising progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={width}
          aria-valuetext={`${formatCentsShort(progress.confirmedCents)} receipt-backed of ${formatCentsShort(progress.goalCents)}, ${width} percent`}
          className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-200"
        >
          <div
            className="h-full rounded-full bg-verified transition-[width] duration-700 ease-out"
            style={{ width: `${width}%` }}
          />
        </div>
        <span className="w-11 shrink-0 text-right text-sm font-bold text-brand-800 tabular-nums">
          {width}%
        </span>
      </div>
    </section>
  );
}

function CandidateList({
  targets,
  totalCount,
}: {
  targets: PublicEmbedDriveTarget[];
  totalCount: number;
}) {
  const visible = targets.slice(0, MAX_VISIBLE_CANDIDATES);
  const remaining = Math.max(0, totalCount - visible.length);

  return (
    <section aria-labelledby="embed-candidates" className="px-4 py-4 min-[420px]:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="embed-candidates" className="text-sm font-bold text-ink-900">
          Candidates in this drive
        </h2>
        <span className="text-xs text-ink-500">Receipt-backed totals</span>
      </div>

      {visible.length > 0 ? (
        <ul className="mt-3 overflow-hidden rounded-2xl ring-1 ring-ink-100">
          {visible.map((target) => (
            <CandidateRow key={target.slug} target={target} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600 ring-1 ring-ink-100">
          No public candidates are available yet.
        </p>
      )}

      {remaining > 0 && (
        <p className="mt-2.5 text-center text-xs font-medium text-ink-500">
          +{remaining} more {remaining === 1 ? "candidate" : "candidates"} on
          the full drive
        </p>
      )}
    </section>
  );
}

function CandidateRow({ target }: { target: PublicEmbedDriveTarget }) {
  const { candidate, progress } = target;
  const width = Math.max(0, Math.min(100, progress.percent));

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-ink-100 bg-white p-3 last:border-b-0 min-[540px]:grid-cols-[auto_minmax(0,1fr)_9.5rem] min-[540px]:items-center">
      <CandidateAvatar name={candidate.fullName} photoUrl={candidate.photoUrl} />

      <div className="min-w-0 self-center">
        <p className="truncate text-sm font-bold text-ink-900">
          {candidate.fullName}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-600">
          {candidate.office}
          {candidate.district
            ? ` · ${candidate.district}`
            : candidate.state
              ? ` · ${candidate.state}`
              : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PartyPill party={String(candidate.party)} />
          {progress.donorCount > 0 && (
            <span className="text-[0.6875rem] text-ink-500">
              {progress.donorCount}{" "}
              {progress.donorCount === 1 ? "supporter" : "supporters"}
            </span>
          )}
        </div>
      </div>

      <div className="col-span-2 min-w-0 min-[540px]:col-span-1 min-[540px]:col-start-3 min-[540px]:row-start-1">
        <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
          <span className="font-semibold text-ink-800 tabular-nums">
            {formatCentsShort(progress.confirmedCents)}
          </span>
          <span className="text-ink-500 tabular-nums">{width}%</span>
        </div>
        <div
          aria-hidden="true"
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200"
        >
          <div
            className="h-full rounded-full bg-verified"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function CandidateAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={44}
        height={44}
        sizes="44px"
        className="size-11 shrink-0 rounded-full object-cover ring-1 ring-ink-200"
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 ring-1 ring-brand-200"
    >
      {initials}
    </span>
  );
}

function PartyPill({ party }: { party: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.625rem] leading-4 font-semibold ${PARTY_STYLES[party] ?? PARTY_STYLES.OTHER}`}
    >
      {PARTY_LABELS[party] ?? "Other"}
    </span>
  );
}

function RecentActivity({
  activity,
}: {
  activity: PublicEmbedDriveActivity[];
}) {
  const visible = activity.slice(0, MAX_VISIBLE_ACTIVITY);
  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="embed-activity"
      className="border-t border-ink-100 px-4 py-4 min-[420px]:px-5"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-verified ring-4 ring-verified-soft"
        />
        <h2
          id="embed-activity"
          className="text-xs font-bold tracking-[0.08em] text-brand-800 uppercase"
        >
          Recent momentum
        </h2>
      </div>

      <ul className="mt-3 space-y-2.5">
        {visible.map((item, index) => (
          <li
            key={`${item.type}-${item.createdAt}-${item.candidateName ?? item.targetTitle ?? "drive"}-${index}`}
            className="flex items-start justify-between gap-3"
          >
            <p className="min-w-0 text-xs leading-relaxed text-ink-700">
              {activityMessage(item)}
            </p>
            <time
              dateTime={item.createdAt}
              className="shrink-0 pt-px text-[0.6875rem] text-ink-500"
            >
              {formatActivityDate(item.createdAt)}
            </time>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-500">
        Contributor identities and receipt details stay private.
      </p>
    </section>
  );
}

function DriveFooter({ snapshot }: { snapshot: PublicEmbedDriveSnapshot }) {
  const href = `/c/${encodeURIComponent(snapshot.coalition.slug)}`;

  return (
    <footer className="border-t border-ink-100 bg-ink-50 px-4 py-4 min-[420px]:px-5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-900 active:translate-y-px"
      >
        View drive &amp; contribute
        <ExternalArrowIcon />
      </a>
      <p className="mt-2.5 text-center text-[0.6875rem] leading-relaxed text-ink-500">
        Contributions happen through candidates&rsquo; official processors.
        Capital Ark never handles funds.
      </p>
    </footer>
  );
}

function activityMessage(item: PublicEmbedDriveActivity) {
  const candidate = item.candidateName ?? item.targetTitle;

  if (item.type === "PLEDGE_CONFIRMED") {
    return (
      <>
        A supporter added{" "}
        <span className="font-semibold text-ink-900 tabular-nums">
          {item.amountCents !== null
            ? `a receipt-backed ${formatCentsShort(item.amountCents)} contribution`
            : "a receipt-backed contribution"}
        </span>
        {candidate ? ` for ${candidate}` : ""}.
      </>
    );
  }

  if (item.type === "GOAL_REACHED") {
    return <>{candidate ? `${candidate} reached its goal.` : "A fundraising goal was reached."}</>;
  }

  if (item.type === "TARGET_CREATED") {
    return <>{candidate ? `${candidate} joined the drive.` : "A candidate joined the drive."}</>;
  }

  return <>The community drive was updated.</>;
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return ACTIVITY_DATE.format(date);
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
      <path d="M10 2.5a4 4 0 100 8 4 4 0 000-8zM3.5 16a5.5 5.5 0 0111 0v.5h-11V16z" />
      <path d="M14.75 6.25a2.75 2.75 0 012.75 2.75c0 1.09-.64 2.03-1.56 2.47A6.94 6.94 0 0118.5 16v.5h-2V16a6.47 6.47 0 00-1.85-4.54 5.46 5.46 0 001.1-5.11 2.8 2.8 0 00-1-.1z" />
    </svg>
  );
}

function ExternalArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M11 3a1 1 0 100 2h2.586l-7.293 7.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
    </svg>
  );
}
