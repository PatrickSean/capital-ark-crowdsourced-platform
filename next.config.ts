import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://cdn.jsdelivr.net",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

// The public embed is a deliberately smaller surface than the application:
// it renders only allowlisted public drive data and links back to Capital Ark.
// It may be framed by HTTPS partner sites, but it cannot submit forms or load
// third-party frames. The host's own Google/CRM form remains a separate iframe,
// so subscriber details never pass through this origin.
const embedContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  `frame-ancestors https:${isDevelopment ? " http://localhost:* http://127.0.0.1:*" : ""}`,
  "manifest-src 'none'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const commonSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const applicationDocumentHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  { key: "X-Frame-Options", value: "DENY" },
];

const widgetBuilderContentSecurityPolicy = contentSecurityPolicy.replace(
  "frame-src https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com https://docs.google.com",
);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: commonSecurityHeaders,
      },
      {
        source: "/",
        headers: applicationDocumentHeaders,
      },
      {
        source: "/:path((?!embed(?:/|$)).*)",
        headers: applicationDocumentHeaders,
      },
      {
        source: "/partners/widgets",
        headers: [
          {
            key: "Content-Security-Policy",
            value: widgetBuilderContentSecurityPolicy,
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: embedContentSecurityPolicy,
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
