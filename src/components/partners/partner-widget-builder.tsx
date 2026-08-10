"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import {
  GOOGLE_FORMS_RESPONDER_URL_HELP,
  normalizeGoogleFormsResponderUrl,
} from "@/lib/google-forms";
import {
  CAPITAL_ARK_IFRAME_SANDBOX,
  CAPITAL_ARK_EMBED_FALLBACK_HEIGHT,
  CAPITAL_ARK_EMBED_MAX_HEIGHT,
  CAPITAL_ARK_EMBED_MIN_HEIGHT,
  CAPITAL_ARK_EMBED_RESIZE_MESSAGE,
  CAPITAL_ARK_EMBED_RESIZE_REQUEST,
  GOOGLE_FORM_IFRAME_SANDBOX,
  PARTNER_WIDGET_LABEL_MAX_LENGTH,
  buildPartnerWidgetHtml,
} from "@/lib/partner-widget";

export interface PartnerWidgetDrive {
  name: string;
  slug: string;
  targetCount: number;
}

type CopyStatus = "idle" | "copied" | "error";

export function PartnerWidgetBuilder({
  drives,
  siteOrigin,
}: {
  drives: PartnerWidgetDrive[];
  siteOrigin: string;
}) {
  const controlPrefix = useId();
  const driveId = `${controlPrefix}-drive`;
  const organizationId = `${controlPrefix}-organization`;
  const formUrlId = `${controlPrefix}-form-url`;
  const markupId = `${controlPrefix}-markup`;
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const [selectedSlug, setSelectedSlug] = useState(drives[0]?.slug ?? "");
  const [organizationName, setOrganizationName] = useState("");
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [formUrlTouched, setFormUrlTouched] = useState(false);
  const [widgetCopyStatus, setWidgetCopyStatus] =
    useState<CopyStatus>("idle");
  const [emailCopyStatus, setEmailCopyStatus] = useState<CopyStatus>("idle");
  const [previewHeight, setPreviewHeight] = useState(
    CAPITAL_ARK_EMBED_FALLBACK_HEIGHT,
  );

  const selectedDrive =
    drives.find((drive) => drive.slug === selectedSlug) ?? drives[0] ?? null;
  const formUrlResult = normalizeGoogleFormsResponderUrl(googleFormUrl);
  const formRequested = googleFormUrl.trim().length > 0;
  const organizationLength = Array.from(organizationName).length;
  const organizationError =
    organizationLength > PARTNER_WIDGET_LABEL_MAX_LENGTH
      ? `Use ${PARTNER_WIDGET_LABEL_MAX_LENGTH} characters or fewer.`
      : formRequested && !organizationName.trim()
        ? "Add the organization that owns this Google Form."
        : null;
  const formUrlError = formUrlResult.ok ? null : formUrlResult.error;
  const canGenerate = Boolean(
    selectedDrive && !organizationError && !formUrlError,
  );
  const embedUrl = selectedDrive
    ? `${siteOrigin.replace(/\/+$/, "")}/embed/${encodeURIComponent(selectedDrive.slug)}`
    : "";
  const previewEmbedUrl = selectedDrive
    ? `/embed/${encodeURIComponent(selectedDrive.slug)}`
    : "";
  const driveShareUrl = selectedDrive
    ? `${siteOrigin.replace(/\/+$/, "")}/c/${encodeURIComponent(selectedDrive.slug)}`
    : "";
  const normalizedGoogleFormUrl = formUrlResult.ok
    ? formUrlResult.normalizedUrl
    : null;
  const snippet =
    canGenerate && selectedDrive
      ? buildPartnerWidgetHtml({
          embedUrl,
          driveName: selectedDrive.name,
          organizationName,
          googleFormUrl: normalizedGoogleFormUrl,
        })
      : "";

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;

    setPreviewHeight(CAPITAL_ARK_EMBED_FALLBACK_HEIGHT);

    function onResizeMessage(event: MessageEvent) {
      if (
        event.source !== frame?.contentWindow ||
        event.origin !== window.location.origin
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
    }

    window.addEventListener("message", onResizeMessage);
    const requestHeight = () =>
      frame.contentWindow?.postMessage(
        { type: CAPITAL_ARK_EMBED_RESIZE_REQUEST },
        window.location.origin,
      );
    frame.addEventListener("load", requestHeight);
    requestHeight();

    return () => {
      window.removeEventListener("message", onResizeMessage);
      frame.removeEventListener("load", requestHeight);
    };
  }, [selectedDrive?.slug]);

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
        await navigator.clipboard.writeText(value);
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
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <Card className="min-w-0 p-5 sm:p-7 lg:sticky lg:top-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Configure
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink-900">
              Build your widget
            </h2>
          </div>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
            Pilot
          </span>
        </div>

        <div className="mt-6 min-w-0 space-y-5">
          <Field
            htmlFor={driveId}
            label="Fundraising drive"
            hint="Choose one public drive to show on your website."
          >
            <select
              id={driveId}
              value={selectedDrive?.slug ?? ""}
              aria-describedby={`${driveId}-hint`}
              onChange={(event) => {
                setSelectedSlug(event.target.value);
                resetCopyStatus();
              }}
              className="h-12 w-full min-w-0 max-w-full rounded-xl bg-white px-3.5 text-base text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 focus:outline-none"
            >
              {drives.map((drive) => (
                <option key={drive.slug} value={drive.slug}>
                  {drive.name} ({drive.targetCount}{" "}
                  {drive.targetCount === 1 ? "candidate" : "candidates"})
                </option>
              ))}
            </select>
          </Field>

          <div className="border-t border-ink-100 pt-5">
            <p className="text-sm font-bold text-ink-900">
              Optional Google Form
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Add a separate, company-owned form for volunteer interest or
              follow-up. Do not use it to collect contribution payments or
              payment details.
            </p>
          </div>

          <Field
            htmlFor={organizationId}
            label="Organization name"
            hint={`Required only with a Google Form. ${organizationLength}/${PARTNER_WIDGET_LABEL_MAX_LENGTH} characters.`}
            error={organizationError}
          >
            <Input
              id={organizationId}
              value={organizationName}
              maxLength={PARTNER_WIDGET_LABEL_MAX_LENGTH}
              autoComplete="organization"
              placeholder="Example Community Association"
              invalid={Boolean(organizationError)}
              aria-describedby={`${organizationId}-hint${organizationError ? ` ${organizationId}-error` : ""}`}
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

          <details className="group rounded-2xl border border-ink-200 bg-white px-4 py-3">
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
                <span className="font-semibold text-ink-800">1. Create and publish.</span>{" "}
                <a
                  href="https://forms.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                >
                  Create a Google Form
                </a>{" "}
                and follow Google&rsquo;s{" "}
                <a
                  href="https://support.google.com/docs/answer/2839588?hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                >
                  publishing guide
                </a>
                .
              </li>
              <li>
                <span className="font-semibold text-ink-800">2. Link Responses to Sheets.</span>{" "}
                In the form&rsquo;s Responses tab, choose a destination using{" "}
                <a
                  href="https://support.google.com/docs/answer/2917686?hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                >
                  Google&rsquo;s response-storage steps
                </a>
                . Never make the response Sheet public.
              </li>
              <li>
                <span className="font-semibold text-ink-800">3. Explain consent.</span>{" "}
                State who receives the answers, why you collect them, and link
                your organization&rsquo;s privacy notice.
              </li>
              <li>
                <span className="font-semibold text-ink-800">4. Paste and test.</span>{" "}
                Copy the full responder URL ending in <code>/viewform</code>,
                paste it above, and test the finished widget privately before
                publishing.
              </li>
            </ol>
          </details>

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
        </div>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Live preview
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink-900">
              What visitors will see
            </h2>
          </div>

          <div className="grid gap-5 bg-ink-50/70 p-4 sm:p-6 xl:grid-cols-2">
            <section className="min-w-0" aria-labelledby={`${controlPrefix}-drive-preview`}>
              <h3
                id={`${controlPrefix}-drive-preview`}
                className="mb-2 text-xs font-semibold text-ink-600"
              >
                Capital Ark drive
              </h3>
              <iframe
                ref={previewFrameRef}
                src={previewEmbedUrl}
                title={`${selectedDrive?.name ?? "Capital Ark drive"} preview`}
                referrerPolicy="no-referrer"
                sandbox={CAPITAL_ARK_IFRAME_SANDBOX}
                height={previewHeight}
                style={{ height: previewHeight }}
                className="w-full rounded-2xl border-0 bg-white shadow-sm ring-1 ring-ink-200"
              />
            </section>

            {normalizedGoogleFormUrl && !organizationError ? (
              <section
                className="min-w-0"
                aria-labelledby={`${controlPrefix}-form-preview`}
              >
                <h3
                  id={`${controlPrefix}-form-preview`}
                  className="mb-2 text-xs font-semibold leading-relaxed text-ink-600"
                >
                  Responses go directly to {organizationName.trim()} through
                  Google. Capital Ark does not receive them.
                </h3>
                <iframe
                  src={normalizedGoogleFormUrl}
                  title={`${organizationName.trim()} follow-up form preview`}
                  referrerPolicy="no-referrer"
                  sandbox={GOOGLE_FORM_IFRAME_SANDBOX}
                  className="h-[640px] w-full rounded-2xl border-0 bg-white shadow-sm ring-1 ring-ink-200"
                />
              </section>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white p-6 text-center xl:min-h-[640px]">
                <div className="max-w-xs">
                  <p className="text-sm font-semibold text-ink-900">
                    Google Form is optional
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    Add an organization name and its exact responder URL to
                    preview a separate follow-up form.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <section
            aria-labelledby={`${controlPrefix}-email-heading`}
            className="mb-6 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100 ring-inset sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2
                  id={`${controlPrefix}-email-heading`}
                  className="text-sm font-bold text-ink-900"
                >
                  For email
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  Email inboxes cannot run this iframe. Link to the full drive
                  page instead.
                </p>
                <a
                  href={driveShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all text-xs font-semibold text-brand-800 underline underline-offset-2 hover:text-brand-950"
                >
                  {driveShareUrl}
                </a>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyValue(driveShareUrl, setEmailCopyStatus)}
                disabled={!driveShareUrl}
                className="shrink-0"
              >
                {emailCopyStatus === "copied" ? "Link copied" : "Copy link"}
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-4 text-xs font-medium text-ink-700"
            >
              {emailCopyStatus === "copied"
                ? "Drive link copied to your clipboard."
                : emailCopyStatus === "error"
                  ? "Copy failed. Select the link and copy it manually."
                  : ""}
            </p>
          </section>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                Install
              </p>
              <h2 className="mt-1 text-lg font-bold text-ink-900">
                Copy the responsive HTML
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-600">
                Paste this block into your website&rsquo;s custom HTML or embed
                area. Capital Ark and Google remain separate frames.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => copyValue(snippet, setWidgetCopyStatus)}
              disabled={!snippet}
              className="shrink-0"
            >
              {widgetCopyStatus === "copied" ? "Copied" : "Copy HTML"}
            </Button>
          </div>

          <label htmlFor={markupId} className="sr-only">
            Generated widget HTML
          </label>
          <textarea
            id={markupId}
            readOnly
            spellCheck={false}
            rows={18}
            value={
              snippet ||
              "Complete the valid fields above to generate the widget HTML."
            }
            className="mt-5 w-full resize-y rounded-2xl bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-100 shadow-inner focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            The tiny resize helper only adjusts the frame height. It makes no
            network request and sends no visitor or form data. The snippet has
            no login, organization account, or saved builder configuration.
          </p>
          <p
            role="status"
            aria-live="polite"
            className="mt-2 min-h-5 text-sm font-medium text-ink-700"
          >
            {widgetCopyStatus === "copied"
              ? "Widget HTML copied to your clipboard."
              : widgetCopyStatus === "error"
                ? "Copy failed. Select the code above and copy it manually."
                : ""}
          </p>
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
