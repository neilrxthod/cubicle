import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Public pages are crawlable. The authenticated schedule stays private.
 * BIMI assets must stay fetchable for mailbox providers.
 */
export default function robots(): MetadataRoute.Robots {
  const publicAllow = [
    "/login",
    "/about",
    "/legal",
    "/legal/",
    "/llms.txt",
    "/sitemap.xml",
    "/.well-known/bimi/",
    "/opengraph-image",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicAllow,
        disallow: ["/"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "ClaudeBot",
          "anthropic-ai",
          "PerplexityBot",
          "Applebot-Extended",
          "CCBot",
          "Bytespider",
        ],
        allow: publicAllow,
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
