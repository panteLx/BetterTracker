import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  allowedDevOrigins: ["192.168.100.13"],
  images: {
    qualities: [75],
  },
};

export default nextConfig;
