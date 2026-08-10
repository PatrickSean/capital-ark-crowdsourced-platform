"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { DrivePicker } from "@/components/partners/drive-picker";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import type { EmbeddableDriveSummary } from "@/lib/data/store-types";
import {
  GOOGLE_FORMS_RESPONDER_URL_HELP,
  normalizeGoogleFormsResponderUrl,
} from "@/lib/google-forms";
import {
  CAPITAL_ARK_EMBED_MAX_HEIGHT,
  CAPITAL_ARK_EMBED_MIN_HEIGHT,
  CAPITAL_ARK_EMBED_RESIZE_MESSAGE,
  CAPITAL_ARK_EMBED_RESIZE_REQUEST,
  GOOGLE_FORM_IFRAME_SANDBOX,
  PARTNER_WIDGET_LABEL_MAX_LENGTH,
  buildPartnerWidgetHtml,
} from "@/lib/partner-widget";

export type PartnerWidgetDrive = EmbeddableDriveSummary;

type CopyStatus = "idle" | "copied" | "error";
type PreviewStatus = "loading" | "ready" | "error";
type PreviewMode = "drive" | "form";

const BUILDER_PREVIEW_FALLBACK_HEIGHT = 760;
const BUILDER_PREVIEW_TIMEOUT_MS = 10_000;

export function PartnerWidgetBuilder({
  drives,
  siteOrigin,
}: {
  drives: PartnerWidgetDrive[];
  siteOrigin: string;
}) {
  const controlPrefix = useId();
  const organizationId = `${controlPrefix}-organization`;
  const formUrlId = `${controlPrefix}-form-url`;
  const formToggleId = `${controlPrefix}-form-toggle`;
  const markupId = `${controlPrefix}-markup`;
  const previewPanelId = `${controlPrefix}-preview-panel`;
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const [selectedDrive, setSelectedDrive] =
    useState<EmbeddableDriveSummary | null>(() =>
      drives.length === 1 ? (drives[0] ?? null) : null,
    );
  const [includeGoogleForm, setIncludeGoogleForm] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationTouched, setOrganizationTouched] = useState(false);
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [formUrlTouched, setFormUrlTouched] = useState(false);
  const [widgetCopyStatus, setWidgetCopyStatus] =
    useState<CopyStatus>("idle");
  const [emailCopyStatus, setEmailCopyStatus] = useState<CopyStatus>("idle");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("drive");
  const [previewStatus, setPreviewStatus] =
    useState<PreviewStatus>("loading");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewEmbedUrl, setPreviewEmbedUrl] = useState("");
  const [previewHeight, setPreviewHeight] = useState(
    BUILDER_PREVIEW_FALLBACK_HEIGHT,
  );

  const formUrlResult = normalizeGoogleFormsResponderUrl(googleFormUrl);
  const organizationLength = Array.from(organizationName).length;
  const organizationError =
    includeGoogleForm && organizationLength > PARTNER_WIDGET_LABEL_MAX_LENGTH
      ? `Use ${PARTNER_WIDGET_LABEL_MAX_LENGTH} characters or fewer.`
      : includeGoogleForm && !organizationName.trim()
        ? "Add the organization that owns this Google Form."
        : null;
  const formUrlError = !includeGoogleForm
    ? null
    : !googleFormUrl.trim()
      ? "Add the published Google Forms responder URL."
      : formUrlResult.ok
        ? null
        : formUrlResult.error;
  const canGenerate = Boolean(
    selectedDrive && !organizationError && !formUrlError,
  );
  const embedUrl = selectedDrive
    ? `${siteOrigin.replace(/\/+$/, "")}/embed/${encodeURIComponent(selectedDrive.slug)}`
    : "";
  const driveShareUrl = selectedDrive
    ? `${siteOrigin.replace(/\/+$/, "")}/c/${encodeURIComponent(selectedDrive.slug)}`
    : "";
  const normalizedGoogleFormUrl = includeGoogleForm && formUrlResult.ok
    ? formUrlResult.normalizedUrl
    : null;
  const formPreviewReady = Boolean(
    normalizedGoogleFormUrl && !organizationError && !formUrlError,
  );
  const effectivePreviewMode: PreviewMode =
    previewMode === "form" && formPreviewReady ? "form" : "drive";
  const snippet =
    canGenerate && selectedDrive
      ? buildPartnerWidgetHtml({
          embedUrl,
          driveName: selectedDrive.name,
          organizationName: includeGoogleForm ? organizationName : "",
          googleFormUrl: normalizedGoogleFormUrl,
        })
      : "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPreviewEmbedUrl(embedUrl);

      if (window.matchMedia("(min-width: 1024px)").matches) {
        setPreviewExpanded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [embedUrl]);

  useEffect(() => {
    if (
      !previewExpanded ||
      effectivePreviewMode !== "drive" ||
      !previewEmbedUrl
    ) {
      return;
    }

    const frame = previewFrameRef.current;
    if (!frame) return;

    const expectedOrigin = new URL(previewEmbedUrl).origin;
    setPreviewHeight(BUILDER_PREVIEW_FALLBACK_HEIGHT);
    setPreviewStatus("loading");
    const failureTimer = window.setTimeout(() => {
      setPreviewStatus((current) =>
        current === "ready" ? current : "error",
      );
    }, BUILDER_PREVIEW_TIMEOUT_MS);

    function onResizeMessage(event: MessageEvent) {
      if (
        event.source !== frame?.contentWindow ||
        event.origin !== expectedOrigin
      ) {
        return;
      }

      const data = event.data as { type?: unknown; height?: unknown } | null;
      if (!data || data.type !== CAPITAL_ARK_EMBED_RESIZE_MESSAGE) return;

      const height = Math.ceil(Number(data.height));
      if (
        !Number.isFinite(height) ||
        height < CAPITAL_ARK_EMBED_MIN_HEIGHT ||
        height > CAPITAL_ARK_EMBED_MAX_HEIGHT
      ) {
        return;
      }

      setPreviewHeight(height);
      setPreviewStatus("ready");
      window.clearTimeout(failureTimer);
    }

    window.addEventListener("message", onResizeMessage);
    const requestHeight = () =>
      frame.contentWindow?.postMessage(
        { type: CAPITAL_ARK_EMBED_RESIZE_REQUEST },
        expectedOrigin,
    );
    frame.addEventListener("load", requestHeight);
    requestHeight();
    const requestTimers = [250, 1_000].map((delay) =>
      window.setTimeout(requestHeight, delay),
    );

    return () => {
      window.clearTimeout(failureTimer);
      requestTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("message", onResizeMessage);
      frame.removeEventListener("load", requestHeight);
    };
  }, [
    effectivePreviewMode,
    previewAttempt,
    previewEmbedUrl,
    previewExpanded,
  ]);

  function resetCopyStatus() {
    if (widgetCopyStatus !== "idle") setWidgetCopyStatus("idle");
    if (emailCopyStatus !== "idle") setEmailCopyStatus("idle");
  }

  async function copyValue(
    value: string,
    setStatus: (status: CopyStatus) => void,
  ) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          copyWithTextarea(value);
        }
      } else {
        copyWithTextarea(value);
      }
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  if (drives.length === 0) {
    return (
      <Card className="p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">
          No public drives are ready to embed
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
          Publish a drive with at least one active candidate, then return here
          to generate its widget.
        </p>
        <Link
          href="/start"
          className="tap-target mt-5 inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Start a drive
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5 sm:p-7 lg:sticky lg:top-24">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
          Configure
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-ink-900">
          Build your widget
        </h2>

        <div className="mt-6 min-w-0 space-y-5">
          <DrivePicker
            drives={drives}
            value={selectedDrive}
            onChange={(drive) => {
              setSelectedDrive(drive);
              resetCopyStatus();
            }}
          />

          <div className="border-t border-ink-100 pt-5">
            <label
              htmlFor={formToggleId}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 transition hover:border-brand-300"
            >
              <input
                id={formToggleId}
                type="checkbox"
                checked={includeGoogleForm}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIncludeGoogleForm(checked);
                  setOrganizationTouched(false);
                  setFormUrlTouched(false);
                  if (!checked) setPreviewMode("drive");
                  resetCopyStatus();
                }}
                className="mt-0.5 size-5 shrink-0 accent-brand-700"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink-900">
                  Collect emails in my Google Form
                  <span className="ml-1 font-medium text-ink-500">
                    (optional)
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                  Responses go directly to your Google account. Capital Ark
                  never receives them.
                </span>
              </span>
            </label>

            {includeGoogleForm && (
              <div className="mt-5 space-y-5 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100 ring-inset">
                <Field
                  htmlFor={organizationId}
                  label="Organization name"
                  hint={`${organizationLength}/${PARTNER_WIDGET_LABEL_MAX_LENGTH} characters.`}
                  error={organizationTouched ? organizationError : null}
                >
                  <Input
                    id={organizationId}
                    value={organizationName}
                    maxLength={PARTNER_WIDGET_LABEL_MAX_LENGTH}
                    autoComplete="organization"
                    placeholder="Example Community Association"
                    invalid={Boolean(organizationTouched && organizationError)}
                    aria-describedby={`${organizationId}-hint${organizationTouched && organizationError ? ` ${organizationId}-error` : ""}`}
                    onBlur={() => setOrganizationTouched(true)}
                    onChange={(event) => {
                      setOrganizationName(event.target.value);
                      resetCopyStatus();
                    }}
                  />
                </Field>

                <Field
                  htmlFor={formUrlId}
                  label="Google Forms responder URL"
                  hint={GOOGLE_FORMS_RESPONDER_URL_HELP}
                  error={formUrlTouched ? formUrlError : null}
                >
                  <Input
                    id={formUrlId}
                    type="url"
                    inputMode="url"
                    value={googleFormUrl}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    invalid={Boolean(formUrlTouched && formUrlError)}
                    aria-describedby={`${formUrlId}-hint${formUrlTouched && formUrlError ? ` ${formUrlId}-error` : ""}`}
                    onBlur={() => setFormUrlTouched(true)}
                    onChange={(event) => {
                      setGoogleFormUrl(event.target.value);
                      resetCopyStatus();
                    }}
                  />
                </Field>

                <details className="group rounded-xl border border-ink-200 bg-white px-4 py-2.5">
                  <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-800 marker:hidden">
                    How to connect a Google Sheet
                    <span
                      aria-hidden="true"
                      className="text-lg leading-none text-ink-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <ol className="mt-3 space-y-3 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-600">
                    <li>
                      <span className="font-semibold text-ink-800">
                        1. Create and publish.
                      </span>{" "}
                      <a
                        href="https://forms.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                      >
                        Create a Google Form
                      </a>{" "}
                      and publish it for responders.
                    </li>
                    <li>
                      <span className="font-semibold text-ink-800">
                        2. Link Responses to Sheets.
                      </span>{" "}
                      Choose a destination in the form&rsquo;s Responses tab using{" "}
                      <a
                        href="https://support.google.com/docs/answer/2917686?hl=en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                      >
                        Google&rsquo;s instructions
                      </a>
                      . Keep the response Sheet private.
                    </li>
                    <li>
                      <span className="font-semibold text-ink-800">
                        3. Paste and test.
                      </span>{" "}
                      Paste the published URL ending in <code>/viewform</code>,
                      then test the finished widget before publishing.
                    </li>
                  </ol>
                </details>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100 ring-inset">
            <p className="text-sm font-semibold text-ink-900">
              Private by design
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              This builder has no Save button. Your selections stay in this
              browser tab and are not submitted to Capital Ark. In the finished
              widget, form responses go from each visitor&rsquo;s browser
              directly to Google.
            </p>
          </div>

          <div className="border-t border-ink-100 pt-5">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Ready to install
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button
                type="button"
                onClick={() => copyValue(snippet, setWidgetCopyStatus)}
                disabled={!snippet}
                className="w-full"
              >
                {widgetCopyStatus === "copied"
                  ? "Embed code copied"
                  : "Copy embed code"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyValue(driveShareUrl, setEmailCopyStatus)}
                disabled={!driveShareUrl}
                className="w-full"
              >
                {emailCopyStatus === "copied"
                  ? "Drive link copied"
                  : "Copy drive link"}
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              Paste the embed code into a Custom HTML block. For email, use
              the drive link instead.
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-5 text-sm font-medium text-ink-700"
            >
              {widgetCopyStatus === "copied"
                ? "Copied. Paste it into your site or send it to your web team."
                : widgetCopyStatus === "error"
                  ? "Copy failed. Open Advanced code and copy it manually."
                  : emailCopyStatus === "copied"
                    ? "Drive link copied to your clipboard."
                    : emailCopyStatus === "error"
                      ? "Copy failed. Open the drive link and copy it manually."
                      : ""}
            </p>
          </div>
        </div>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                Live preview
              </p>
              <h2 className="mt-1 text-lg font-bold text-ink-900">
                What visitors will see
              </h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              aria-expanded={previewExpanded}
              aria-controls={previewPanelId}
              onClick={() => setPreviewExpanded((current) => !current)}
              className="shrink-0"
            >
              {previewExpanded ? "Hide preview" : "Show preview"}
            </Button>
          </div>

          {previewExpanded ? (
            <div id={previewPanelId} className="bg-ink-50/70 p-4 sm:p-6">
              {formPreviewReady && (
                <div
                  role="group"
                  aria-label="Choose preview"
                  className="mx-auto mb-4 flex w-fit rounded-xl bg-white p-1 ring-1 ring-ink-200"
                >
                  <button
                    type="button"
                    aria-pressed={previewMode === "drive"}
                    onClick={() => setPreviewMode("drive")}
                    className={`tap-target rounded-lg px-4 text-sm font-semibold transition ${
                      previewMode === "drive"
                        ? "bg-brand-700 text-white"
                        : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    Drive widget
                  </button>
                  <button
                    type="button"
                    aria-pressed={previewMode === "form"}
                    onClick={() => setPreviewMode("form")}
                    className={`tap-target rounded-lg px-4 text-sm font-semibold transition ${
                      previewMode === "form"
                        ? "bg-brand-700 text-white"
                        : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    Signup form
                  </button>
                </div>
              )}

              {effectivePreviewMode === "form" ? (
                <section
                  className="mx-auto min-w-0 max-w-[720px]"
                  aria-labelledby={`${controlPrefix}-form-preview`}
                >
                  <h3
                    id={`${controlPrefix}-form-preview`}
                    className="mb-3 text-sm font-semibold leading-relaxed text-ink-700"
                  >
                    Responses go directly to {organizationName.trim()} through
                    Google. Capital Ark does not receive them.
                  </h3>
                  <iframe
                    src={normalizedGoogleFormUrl ?? undefined}
                    title={`${organizationName.trim()} follow-up form preview`}
                    referrerPolicy="no-referrer"
                    sandbox={GOOGLE_FORM_IFRAME_SANDBOX}
                    className="h-[720px] w-full rounded-2xl border-0 bg-white shadow-sm ring-1 ring-ink-200"
                  />
                </section>
              ) : selectedDrive ? (
                <section
                  className="mx-auto min-w-0 max-w-[720px]"
                  aria-labelledby={`${controlPrefix}-drive-preview`}
                >
                  <h3 id={`${controlPrefix}-drive-preview`} className="sr-only">
                    Capital Ark drive preview
                  </h3>
                  <div
                    className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200"
                    style={{
                      height:
                        previewStatus === "error" ? 360 : previewHeight,
                    }}
                  >
                    {previewStatus !== "ready" && (
                      <div
                        aria-live="polite"
                        className="absolute inset-0 z-10 flex items-center justify-center bg-white p-6 text-center"
                      >
                        {previewStatus === "error" ? (
                          <div className="max-w-sm">
                            <span
                              aria-hidden="true"
                              className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-800"
                            >
                              !
                            </span>
                            <p className="mt-3 text-base font-bold text-ink-900">
                              Preview unavailable in this browser
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-ink-600">
                              The embed code is still ready. Retry here or open
                              the preview directly.
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                              <Button
                                type="button"
                                onClick={() =>
                                  setPreviewAttempt((attempt) => attempt + 1)
                                }
                              >
                                Retry preview
                              </Button>
                              <a
                                href={previewEmbedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tap-target inline-flex items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 ring-1 ring-ink-300 hover:bg-ink-50"
                              >
                                Open preview
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full max-w-sm">
                            <span className="mx-auto block size-9 animate-pulse rounded-xl bg-brand-100" />
                            <p className="mt-3 text-sm font-semibold text-ink-800">
                              Loading secure preview&hellip;
                            </p>
                            <div className="mx-auto mt-4 h-2 w-40 animate-pulse rounded-full bg-ink-100" />
                          </div>
                        )}
                      </div>
                    )}
                    {previewEmbedUrl ? (
                      <iframe
                        key={`${previewEmbedUrl}-${previewAttempt}`}
                        ref={previewFrameRef}
                        src={previewEmbedUrl}
                        title={`${selectedDrive?.name ?? "Capital Ark drive"} preview`}
                        referrerPolicy="no-referrer"
                        tabIndex={previewStatus === "ready" ? 0 : -1}
                        aria-hidden={previewStatus === "ready" ? undefined : true}
                        height={previewHeight}
                        style={{ height: previewHeight }}
                        className={`w-full border-0 bg-white transition-opacity duration-200 ${
                          previewStatus === "ready" ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    ) : null}
                  </div>
                </section>
              ) : (
                <div className="mx-auto flex min-h-72 max-w-[720px] items-center justify-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-ink-200">
                  <div className="max-w-sm">
                    <span
                      aria-hidden="true"
                      className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-800"
                    >
                      <svg viewBox="0 0 24 24" className="size-6" fill="none">
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
                    <p className="mt-4 text-base font-bold text-ink-900">
                      Choose a drive to preview
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">
                      Search the public catalog, select a drive, and its live
                      widget will appear here.
                    </p>
                  </div>
                </div>
              )}

              {formPreviewReady && (
                <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-ink-600">
                  The finished embed places the drive and form side by side
                  when space allows, and stacks them on phones.
                </p>
              )}
            </div>
          ) : (
            <div
              id={previewPanelId}
              className="flex items-center justify-between gap-4 bg-ink-50/70 px-5 py-4 sm:px-6"
            >
              <p className="text-sm text-ink-600">
                Open the preview to check the widget before publishing.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <details className="group">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-1 text-sm font-semibold text-ink-800 marker:hidden">
              Advanced: view generated code
              <span
                aria-hidden="true"
                className="text-lg leading-none text-ink-500 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-4 border-t border-ink-100 pt-4">
              <p className="text-xs leading-relaxed text-ink-600">
                Use this when your CMS cannot paste from the Copy button or
                your web team wants to inspect the complete snippet.
              </p>
              <label htmlFor={markupId} className="sr-only">
                Generated widget HTML
              </label>
              <textarea
                id={markupId}
                readOnly
                spellCheck={false}
                rows={10}
                value={
                  snippet ||
                  "Complete the valid fields above to generate the widget HTML."
                }
                className="mt-4 w-full resize-y rounded-2xl bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-100 shadow-inner focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                The resize helper sends only the frame height. If your site has
                a Content Security Policy, allow <code>frame-src</code> from{" "}
                <code>{siteOrigin.replace(/\/+$/, "")}</code>
                {includeGoogleForm ? " and https://docs.google.com" : ""}.
              </p>
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}

function copyWithTextarea(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command was rejected.");
}
