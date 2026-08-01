import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as { version: string };

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
};

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

export default withNextIntl(nextConfig);
