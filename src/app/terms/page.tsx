import type { Metadata } from "next";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/data";
import { SiteHeader } from "@/components/layout/site-header";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Terms for using Capital Ark's non-custodial, crowdsourced fundraising-tracking software.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
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
          Terms of use
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
          These terms describe the boundaries of Capital Ark&rsquo;s software.
          Using the site means you agree to use it lawfully and to provide
          accurate information when you submit a contribution receipt.
        </p>

        <Card className="mt-6 p-5 sm:p-6">
          <div className="space-y-6">
            <Term title="Capital Ark is tracking software">
              Capital Ark does not solicit, process, hold, escrow, or forward
              contributions. A contribution is made on the recipient
              committee&rsquo;s independent processor. Listing a person is not an
              endorsement, and Capital Ark is not an agent of a candidate,
              campaign, committee, coalition, or processor.
            </Term>
            <Term title="Crowdsourced figures are not official totals">
              Progress comes from contributor-submitted receipts that pass an
              automated consistency check. It is not reconciled with committee
              records and must not be presented as an official campaign-finance
              report, committee balance, or guarantee that a processor accepted
              funds.
            </Term>
            <Term title="Contributor responsibilities">
              You are responsible for meeting citizenship, source-of-funds,
              age, contribution-limit, lobbyist, contractor, and other rules
              that apply to you and the recipient. Use your own information and
              submit a receipt only for a contribution you actually made. The
              committee and its processor make the final eligibility and
              acceptance decision.
            </Term>
            <Term title="Organizer and content responsibilities">
              Community-created drives are labeled as unverified unless and
              until Capital Ark independently reviews them. Organizers must
              review and provide accurate candidate, committee, office,
              jurisdiction, goal, and processor information and must not imply
              campaign authorization. Do not use Capital Ark to impersonate a
              committee, misdirect supporters, evade campaign-finance rules,
              scrape private data, disrupt the service, or publish unlawful
              content.
            </Term>
            <Term title="Sharing through third-party apps">
              Share buttons can open an independent app, such as WhatsApp, with
              a draft message. You choose the recipient and send the message
              yourself. Capital Ark does not join your groups, read your chats,
              or automatically publish receipt images or personal contribution
              details to them.
            </Term>
            <Term title="Embedded drives and organization forms">
              A public drive may be embedded on another website using Capital
              Ark&rsquo;s provided frame. The host must not hide required context,
              misstate crowdsourced progress as an official committee total,
              or imply that Capital Ark endorses the host. An organization may
              place its own Google or CRM signup form beside the drive, but it
              must identify itself as the recipient, provide accurate consent
              and privacy information, secure access to submissions, and honor
              applicable unsubscribe and deletion obligations. Capital Ark does
              not receive entries submitted directly to that separate form.
            </Term>
            <Term title="No legal, tax, or accounting advice">
              Explanations on this site are operational safeguards, not advice.
              Laws and indexed limits can change. Contributors, organizers, and
              committees should consult qualified counsel for their own facts.
            </Term>
            <Term title="Availability and changes">
              Features, candidate links, and third-party processors may change
              or become unavailable. Capital Ark may correct data, pause a
              drive, restrict misuse, or update these terms and the service to
              protect users and maintain legal or technical integrity.
            </Term>
          </div>
        </Card>
      </main>
      <DisclaimerFooter />
    </div>
  );
}

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{children}</p>
    </section>
  );
}
