import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_ORIGIN } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified,
    changeFrequency: path === "/login" || path === "/about" ? "weekly" : "monthly",
    priority: path === "/about" ? 1 : path === "/login" ? 0.9 : 0.5,
  }));
}
