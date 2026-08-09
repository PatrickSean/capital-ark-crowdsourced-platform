import type { Metadata } from "next";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/data";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Capital Ark collects, why it is used, and what the platform never receives.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  await connection();

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12"
      >
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
          Last updated August 9, 2026
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          Privacy
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
          Capital Ark collects only the information needed to connect a
          supporter&rsquo;s action with a coalition&rsquo;s crowdsourced progress.
          We never receive card numbers, bank details, or campaign-processor
          credentials.
        </p>

        <div className="mt-6 space-y-4">
          <PolicySection title="Information collected">
            <p>
              When you only read a public page, Capital Ark does not ask for a
              name or account. When you choose to contribute, the site creates
              an opaque visitor identifier in a secure cookie and records the
              candidate, intended amount, tracking code, time, browser user
              agent, and a salted one-way hash of the network address used for
              abuse prevention.
            </p>
            <p>
              When you create a drive, Capital Ark stores the drive description,
              candidate and committee details, goals, official processor links,
              and an opaque organizer identifier so the submission can be
              attributed and moderated. Community-created drives are labeled
              separately from information independently reviewed by Capital Ark.
            </p>
            <p>
              If you return and verify a contribution, Capital Ark stores the
              receipt-backed amount, required attestation version, review
              result, and time.
              The recipient committee&rsquo;s processor—not Capital Ark—collects
              and processes your payment information.
            </p>
          </PolicySection>

          <PolicySection title="Receipts and accounts">
            <p>
              To add a contribution to public progress, you must upload one
              PNG, JPEG, or WebP image of the completed contribution receipt
              and consent to a one-time automated consistency check. Crop the
              image to the receipt and hide donor names, addresses, email
              addresses, and card digits, while leaving the recipient,
              processor, amount, completed status, and date visible.
            </p>
            <p>
              Capital Ark sends the screenshot to OpenAI only after that
              consent. If the visible receipt details cannot be confidently
              matched, the contribution is not added; you can crop a clearer
              image or try another receipt. There is no receipt-free
              self-reporting path.
            </p>
            <p>
              Capital Ark does not save the raw screenshot on the AI-checking
              path. It stores limited derived information: the model used,
              controlled review reasons, extracted amount and date, recipient
              and processor match flags, and a keyed image digest that prevents
              one screenshot from backing multiple contributions. The public
              site shows only a general evidence label, never those receipt
              details.
            </p>
            <p>
              AI requests use the OpenAI Responses API with application-state
              storage disabled. OpenAI may still retain abuse-monitoring logs,
              including submitted content, for up to 30 days unless Capital
              Ark&rsquo;s API organization has Zero Data Retention. An AI-checked
              match is not conclusive proof that a committee accepted a
              contribution.
            </p>
            <p>
              If you later claim an account, the authentication provider may
              store your email address and session information. Account details
              are kept separate from public receipt activity.
            </p>
          </PolicySection>

          <PolicySection title="How information is used and shared">
            <p>
              Information is used to generate tagged processor links, maintain
              crowdsourced totals, let you finish an interrupted confirmation,
              protect the service from abuse, and preserve the attestation
              record. Capital Ark does not sell personal information.
            </p>
            <p>
              Infrastructure providers may process limited data to host the
              application, database, authentication, or private storage. When
              you open a donation page, you leave Capital Ark and the campaign
              processor&rsquo;s own privacy policy applies.
            </p>
            <p>
              OpenAI acts as an infrastructure provider only when you submit a
              receipt for checking. Capital Ark does not use receipt
              images to generate political messaging, target supporters, or
              train its own models.
            </p>
            <p>
              A WhatsApp share button opens WhatsApp with a draft containing
              public drive information. Capital Ark does not receive your chat
              list, choose a group, or send the message for you.
            </p>
          </PolicySection>

          <PolicySection title="Retention and your choices">
            <p>
              Unresolved contribution intents expire after 72 hours. Confirmed
              records are retained while needed to operate the public totals,
              prevent duplicate reporting, and maintain an audit trail. You
              can delete the Capital Ark visitor cookie in your browser; doing
              so may prevent the site from reopening an unfinished pledge.
            </p>
          </PolicySection>
        </div>
      </main>
      <DisclaimerFooter />
    </div>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-700">
        {children}
      </div>
    </Card>
  );
}
