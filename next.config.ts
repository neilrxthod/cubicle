import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS only effective over HTTPS (Vercel production).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** Real Supabase project origin — used only server-side for rewrites. */
const supabaseOrigin =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "").trim() || "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // BIMI inspectors and mailbox providers fetch these over HTTPS.
        source: "/.well-known/bimi/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
  /**
   * Proxy Supabase through this app so OAuth authorize never puts
   * `*.supabase.co` in the staff browser address bar.
   * Client navigates to `/__supabase/auth/v1/authorize…`; Next fetches upstream.
   */
  async rewrites() {
    if (!supabaseOrigin) return [];
    return [
      {
        source: "/__supabase/:path*",
        destination: `${supabaseOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
