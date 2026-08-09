import type { Metadata, Viewport } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";
import {
  homeSocialCardPath,
  openGraphImageDescriptor,
  twitterImageDescriptor,
} from "@/lib/social-cards";
import "./globals.css";

const homeSocialImageUrl = absoluteUrl(homeSocialCardPath());
const homeSocialImageAlt =
  "Capital Ark — set a goal, share one link, and track community fundraising progress";

export const metadata: Metadata = {
  applicationName: "Capital Ark",
  category: "technology",
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Capital Ark — Collective fundraising, clearly tracked",
    template: "%s · Capital Ark",
  },
  description:
    "Capital Ark is non-partisan software that lets groups set a fundraising goal, share one link, and watch progress build. Contributions are made directly on the candidate's own official processor. We never handle funds.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Capital Ark",
    url: siteUrl(),
    title: "Capital Ark — Collective fundraising, clearly tracked",
    description:
      "One coalition link, official campaign processors, and transparent crowdsourced progress. Capital Ark never handles contributions.",
    images: [
      openGraphImageDescriptor(homeSocialImageUrl, homeSocialImageAlt),
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Capital Ark — Collective fundraising, clearly tracked",
    description:
      "One coalition link, official campaign processors, and transparent crowdsourced progress.",
    images: [twitterImageDescriptor(homeSocialImageUrl, homeSocialImageAlt)],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1E6851",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
