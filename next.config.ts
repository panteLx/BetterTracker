import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  allowedDevOrigins: ["*"],
  images: {
    qualities: [75],
  },
};

export default nextConfig;
