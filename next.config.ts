import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  reactCompiler: false,
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    qualities: [75],
  },
};

export default nextConfig;
