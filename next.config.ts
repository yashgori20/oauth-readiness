import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Guides are read from disk at runtime, so make sure Vercel bundles them with every route.
  outputFileTracingIncludes: {
    "/**": ["./guides/**/*.json"],
  },
};

export default nextConfig;
