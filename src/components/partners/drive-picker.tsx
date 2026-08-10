"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EmbeddableDriveSummary } from "@/lib/data/store-types";
import {
  buildDriveSearchIndex,
  searchDriveCatalog,
} from "@/lib/drive-picker";

export function DrivePicker({
  drives,
  value,
  onChange,
}: {
  drives: EmbeddableDriveSummary[];
  value: EmbeddableDriveSummary | null;
  onChange: (drive: EmbeddableDriveSummary) => void;
}) {
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const hintId = `${controlId}-hint`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchIndex = useMemo(() => buildDriveSearchIndex(drives), [drives]);
  const results = useMemo(
    () => searchDriveCatalog(searchIndex, query, value?.slug ?? ""),
    [query, searchIndex, value?.slug],
  );

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closePicker();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || results.items.length === 0) return;
    document
      .getElementById(optionId(listboxId, activeIndex))
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open, results.items.length]);

  function openPicker() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function closePicker({ restoreFocus = false } = {}) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function chooseDrive(drive: EmbeddableDriveSummary) {
    onChange(drive);
    closePicker({ restoreFocus: true });
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const lastIndex = results.items.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, lastIndex));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(lastIndex, 0));
    } else if (event.key === "Enter") {
      const activeDrive = results.items[activeIndex];
      if (!activeDrive) return;
      event.preventDefault();
      chooseDrive(activeDrive);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePicker({ restoreFocus: true });
    } else if (event.key === "Tab") {
      closePicker();
    }
  }

  if (drives.length === 1 && value) {
    return (
      <div className="space-y-1.5">
        <p id={labelId} className="text-sm font-semibold text-ink-800">
          Fundraising drive
        </p>
        <p id={hintId} className="text-xs text-ink-500">
          This is the public drive currently available to embed.
        </p>
        <div
          aria-labelledby={`${labelId} ${controlId}-single-name`}
          aria-describedby={hintId}
          className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-inset ring-ink-200"
        >
          <DriveMark />
          <DriveSummary
            drive={value}
            nameId={`${controlId}-single-name`}
            wrap
          />
          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
            Selected
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-1.5">
      <label
        id={labelId}
        htmlFor={controlId}
        className="block text-sm font-semibold text-ink-800"
      >
        Fundraising drive
      </label>
      <p id={hintId} className="text-xs text-ink-500">
        Search public drives by name, then choose one to embed.
      </p>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-describedby={hintId}
        aria-label={
          value
            ? `Fundraising drive: ${value.name}, ${value.targetCount.toLocaleString()} ${candidateLabel(value.targetCount)}`
            : `Fundraising drive: choose a public drive, ${drives.length.toLocaleString()} available`
        }
        onClick={() => (open ? closePicker() : openPicker())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          if (!open) openPicker();
        }}
        className="tap-target flex h-auto min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-inset ring-ink-200 transition hover:ring-ink-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
      >
        <DriveMark />
        {value ? (
          <DriveSummary drive={value} wrap />
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">
              Choose a public drive
            </span>
            <span className="mt-0.5 block text-xs text-ink-500">
              {drives.length.toLocaleString()} available
            </span>
          </span>
        )}
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="absolute -inset-x-3 top-full z-40 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-ink-200 sm:inset-x-0">
          <div className="sticky top-0 z-10 border-b border-ink-100 bg-white p-3">
            <div className="relative">
              <SearchIcon />
              <input
                ref={searchRef}
                role="combobox"
                aria-label="Search public drives"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={
                  results.items[activeIndex]
                    ? optionId(listboxId, activeIndex)
                    : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={`Search ${drives.length.toLocaleString()} public drives`}
                className="h-12 w-full rounded-xl bg-ink-50 pr-11 pl-10 text-base text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 focus:bg-white focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear drive search"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(0);
                    searchRef.current?.focus();
                  }}
                  className="tap-target absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-lg text-ink-500 hover:text-ink-900"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              ) : null}
            </div>
            <p className="mt-2 px-1 text-xs text-ink-500" aria-live="polite">
              {resultSummary(
                results.totalMatches,
                results.items.length,
                query,
              )}
            </p>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="Public fundraising drives"
            className={
              results.items.length > 0
                ? "max-h-[min(22rem,48vh)] overflow-y-auto p-2 overscroll-contain"
                : "hidden"
            }
          >
            {results.items.map((drive, index) => {
              const selected = drive.slug === value?.slug;
              const active = index === activeIndex;
              return (
                <button
                  key={drive.slug}
                  id={optionId(listboxId, index)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-setsize={results.totalMatches}
                  aria-posinset={index + 1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseDrive(drive)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? "bg-brand-50" : "hover:bg-ink-50"
                  }`}
                >
                  <DriveMark compact />
                  <DriveSummary drive={drive} wrap />
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      selected
                        ? "bg-brand-700 text-white"
                        : "text-transparent"
                    }`}
                  >
                    &#10003;
                  </span>
                </button>
              );
            })}
          </div>

          {results.items.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-ink-900">
                No drives match &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Try a shorter name or clear the search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveIndex(0);
                  searchRef.current?.focus();
                }}
                className="tap-target mt-3 inline-flex items-center font-semibold text-brand-700 underline underline-offset-2"
              >
                Clear search
              </button>
            </div>
          ) : null}

          {results.totalMatches > results.items.length ? (
            <p className="border-t border-ink-100 bg-ink-50 px-4 py-3 text-center text-xs leading-relaxed text-ink-600">
              Showing the first {results.items.length} matches. Keep typing to
              narrow the list.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DriveSummary({
  drive,
  nameId,
  wrap = false,
}: {
  drive: EmbeddableDriveSummary;
  nameId?: string;
  wrap?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        id={nameId}
        className={`block text-sm font-semibold text-ink-900 ${
          wrap ? "line-clamp-2 break-words" : "truncate"
        }`}
        title={drive.name}
      >
        {drive.name}
      </span>
      <span className="mt-0.5 block text-xs text-ink-500">
        {drive.targetCount.toLocaleString()} {candidateLabel(drive.targetCount)}
      </span>
    </span>
  );
}

function DriveMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ${
        compact ? "size-9" : "size-10"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path
          d="M5 5.5h14v10H8l-3 3v-13Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 9h7M8.5 12h4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`size-5 shrink-0 text-ink-500 transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-400"
    >
      <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function resultSummary(total: number, shown: number, query: string) {
  if (total === 0) return "No matching drives.";
  if (total > shown) return `${total.toLocaleString()} matches. Showing ${shown}.`;
  if (query) return `${total.toLocaleString()} ${total === 1 ? "drive" : "drives"} found.`;
  return `${total.toLocaleString()} public ${total === 1 ? "drive" : "drives"}.`;
}

function candidateLabel(count: number) {
  return count === 1 ? "candidate" : "candidates";
}

function optionId(listboxId: string, index: number) {
  return `${listboxId}-option-${index}`;
}
