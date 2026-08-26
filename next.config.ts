import type { NextConfig } from "next";

// No CSP here on purpose: the app depends on Google's own sign-in redirect
// and R2-hosted portrait images on a domain that can change, and a wrong
// CSP would silently break either without an easy way to catch it before
// deploy. These four are safe, standalone hardening with no such coupling.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
