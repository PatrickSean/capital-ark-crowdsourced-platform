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
              If you return and confirm, Capital Ark stores the amount you say
              you contributed, the required attestation version, and the time.
              The recipient committee&rsquo;s processor—not Capital Ark—collects
              and processes your payment information.
            </p>
          </PolicySection>

          <PolicySection title="Receipts and accounts">
            <p>
              Receipt upload and account claiming are available only when the
              secure account-and-storage service is enabled. Receipt OCR runs
              in your browser. If you choose to attach a receipt, its private
              storage key is associated with your pledge; receipts are never
              public. If you claim an account, the authentication provider may
              store your email address and session information.
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
