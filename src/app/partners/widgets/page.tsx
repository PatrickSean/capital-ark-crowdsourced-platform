import type { Metadata } from "next";
import { DisclaimerFooter } from "@/components/compliance/disclaimer-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  PartnerWidgetBuilder,
  type PartnerWidgetDrive,
} from "@/components/partners/partner-widget-builder";
import { isDemoMode, store } from "@/lib/data";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner widget builder",
  description:
    "Create a responsive Capital Ark fundraising-drive embed for a partner website.",
  alternates: { canonical: "/partners/widgets" },
};

export default async function PartnerWidgetsPage() {
  const coalitions = await store.listCoalitions();
  const drives = (
    await Promise.all(
      coalitions.map(async (coalition): Promise<PartnerWidgetDrive | null> => {
        const targets = await store.listTargetsForCoalition(coalition.id);
        if (targets.length === 0) return null;

        return {
          name: coalition.name,
          slug: coalition.slug,
          targetCount: targets.length,
        };
      }),
    )
  ).filter((drive): drive is PartnerWidgetDrive => drive !== null);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <SiteHeader demoMode={isDemoMode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        <header className="mb-7 max-w-2xl sm:mb-9">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
              Partner tools
            </p>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Pilot
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-ink-900 sm:text-4xl">
            Embed a drive on your website
          </h1>
          <p className="mt-3 text-base leading-relaxed text-pretty text-ink-600 sm:text-lg">
            Choose a public drive, preview it, and copy a responsive embed.
            Optionally connect a company-owned Google Form without sending its
            responses through Capital Ark.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink-700">
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-ink-200">
              No account required
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-ink-200">
              Setup stays in your browser
            </span>
          </div>
        </header>

        <PartnerWidgetBuilder drives={drives} siteOrigin={siteUrl()} />
      </main>

      <DisclaimerFooter />
    </div>
  );
}
