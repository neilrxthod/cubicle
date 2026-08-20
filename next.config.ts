import type { NextConfig } from "next";

function contentSecurityPolicy() {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  let supabaseHosts = "";
  try {
    if (supabase) {
      const host = new URL(supabase).host;
      supabaseHosts = ` ${supabase} wss://${host}`;
    }
  } catch {
    supabaseHosts = "";
  }
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
      : "'self' 'unsafe-inline' 'wasm-unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self'${supabaseHosts} https://*.supabase.co wss://*.supabase.co`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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
  reactCompiler: true,
  compress: true,
  serverExternalPackages: ["nodemailer"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["motion", "@base-ui/react", "lucide-react"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/llms.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
        ],
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
