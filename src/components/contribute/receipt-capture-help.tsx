/**
 * Small, native disclosure for people who have never captured a receipt.
 *
 * A <details> element works with touch, keyboard, and screen readers without
 * introducing another popover or focus trap inside the contribution modal.
 */
export function ReceiptCaptureHelp() {
  return (
    <details className="group rounded-lg bg-white ring-1 ring-inset ring-ink-200">
      <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 text-xs font-semibold text-brand-700 outline-none hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
        <span>Need help capturing a receipt?</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>

      <div className="border-t border-ink-100 px-3 pt-2.5 pb-3 text-xs leading-relaxed text-ink-600">
        <ul className="space-y-1.5">
          <li>
            <strong className="text-ink-800">iPhone:</strong> press the Side
            and Volume Up buttons together, then tap the preview to crop it.
          </li>
          <li>
            <strong className="text-ink-800">Android:</strong> press Power and
            Volume Down together, then use the screenshot preview to crop.
          </li>
          <li>
            <strong className="text-ink-800">Windows:</strong> press Windows +
            Shift + S, then drag around the receipt and save the image.
          </li>
          <li>
            <strong className="text-ink-800">Mac:</strong> press Shift +
            Command + 4, then drag around the receipt. It saves to your desktop.
          </li>
          <li>
            <strong className="text-ink-800">Email receipt:</strong> open the
            confirmation email and screenshot just the receipt section.
          </li>
        </ul>

        <p className="mt-2.5 border-t border-ink-100 pt-2.5">
          Keep the committee or recipient, amount, date, and completed status
          visible. Crop or cover your address, email, phone number, card digits,
          and unrelated messages before uploading.
        </p>
      </div>
    </details>
  );
}
