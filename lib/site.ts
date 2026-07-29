/**
 * Canonical production site + known hostnames.
 *
 * Live Vercel production today: mycubicle.app
 * Customer domain (attach in Vercel → Domains): mycubicle.com
 */

export const SITE_HOSTS = [
  "mycubicle.app",
  "www.mycubicle.app",
  "mycubicle.com",
  "www.mycubicle.com",
] as const;

/** Primary public URL (metadata, calendar links, docs). */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim() ||
  "https://mycubicle.app";

export const SITE_DOMAIN = SITE_ORIGIN.replace(/^https?:\/\//, "").replace(
  /^www\./,
  "",
);

export function isProductionHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host.endsWith(".vercel.app")) return true;
  return (SITE_HOSTS as readonly string[]).includes(host);
}
