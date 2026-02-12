import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization
  reactCompiler: true,
  experimental: {
    viewTransition: true,
    // Increase body size limit for photo uploads
    proxyClientMaxBodySize: "300mb",
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
};

export default nextConfig;
