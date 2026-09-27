import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // lib/works.ts reads these at request time; tracing can't see fs reads by
  // computed path, so list them for every route that renders a work.
  outputFileTracingIncludes: {
    "/": ["./data/works/**/*.json"],
    "/read/*": ["./data/works/**/*.json"],
    "/archive": ["./data/works/**/*.json"],
    "/archive/*/*": ["./data/works/**/*.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
