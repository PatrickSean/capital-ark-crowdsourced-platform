"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * One component, two presentations: a centred dialog on desktop and a
 * bottom sheet on mobile, where a thumb can actually reach the controls.
 *
 * Handles the accessibility work a modal needs and is easy to forget: focus
 * moves in on open and back to the trigger on close, Tab is trapped, Escape
 * dismisses, and the page behind is locked and hidden from screen readers.
 */
export function ModalSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** False while a network call is in flight, so we don't strand the user. */
  dismissible?: boolean;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Lock the background without the layout shift that removing the
    // scrollbar would otherwise cause.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    // Focus the panel itself, synchronously. On the panel (rather than the
    // first button) so screen readers announce the dialog's name before its
    // controls; synchronously so there is never a window where focus sits on
    // a now-inert background, which would also let Tab escape the trap.
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Focus somehow left the dialog (browser chrome, a stray programmatic
      // blur): pull it straight back rather than letting the user wander into
      // an inert background mid-contribution.
      if (!active || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      // The panel itself holds focus on open, so treat it as the boundary for
      // a backwards Tab.
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade bg-ink-950/50 backdrop-blur-[2px]"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        aria-describedby={description ? "modal-sheet-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col bg-white shadow-lift outline-none",
          "animate-sheet-up rounded-t-3xl",
          "sm:max-w-md sm:animate-rise sm:rounded-3xl",
        )}
      >
        {/* Grab handle: the affordance that tells a mobile user this is
            dismissible by dragging, matching platform convention. */}
        <div className="flex shrink-0 justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-ink-300" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-2 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-ink-900">
              {title}
            </h2>
            {description && (
              <p
                id="modal-sheet-description"
                className="mt-1 text-sm text-ink-600"
              >
                {description}
              </p>
            )}
          </div>

          {dismissible && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="tap-target -mt-1 -mr-2 flex items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-ink-100 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
