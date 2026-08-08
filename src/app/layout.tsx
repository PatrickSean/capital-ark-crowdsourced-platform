import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Capital Ark — Track your coalition's fundraising",
    template: "%s · Capital Ark",
  },
  description:
    "Capital Ark is non-partisan software that lets groups set a fundraising goal, share one link, and watch progress build. Contributions are made directly on the candidate's own official processor. We never handle funds.",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
