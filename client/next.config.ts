import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT use standalone — Vercel handles deployment natively
  poweredByHeader: false,
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};

export default nextConfig;
