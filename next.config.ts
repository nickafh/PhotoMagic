import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    viewTransition: true,
    // Increase body size limit for photo uploads
    proxyClientMaxBodySize: "1500mb",
    serverActions: {
      bodySizeLimit: "1500mb",
    },
  },
};

export default nextConfig;
