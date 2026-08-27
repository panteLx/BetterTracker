import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as { version: string };

// HSTS is only meaningful once TLS is terminated in front of the app, so it is
// sent only when the configured public URL is https.
const isHttps = (process.env.BETTER_AUTH_URL || "").startsWith("https://");

// `next dev` compiles with eval-based HMR, so the script policy is only
// tightened for production builds.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  // next/font self-hosts its faces, so no external font host is needed.
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  // Required by Next.js' inline bootstrap and the pre-paint accent script in
  // app/layout.tsx; both are compile-time constants, never user input.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(isHttps
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: version,
    COMMIT_SHA: process.env.COMMIT_SHA ?? "",
  },
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  reactCompiler: false,
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    qualities: [75],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

export default withNextIntl(nextConfig);
