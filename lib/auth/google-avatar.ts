import type { User } from "@supabase/supabase-js";

/**
 * True only for googleusercontent.com and its subdomains (e.g. lh3.…).
 * Avoids substring checks that match spoofed hosts like evilgoogleusercontent.com.
 */
function isGoogleUserContentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")
  );
}

/**
 * Google serves tiny default avatars (often s96). Bump size so faces look
 * sharp on retina boards / header chips without re-uploading.
 */
function upgradeGoogleAvatarUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return url;
    }
    // lh3.googleusercontent.com/...=s96-c  or  .../s96-c/...
    if (!isGoogleUserContentHost(parsed.hostname)) {
      return url;
    }
    let path = parsed.pathname;
    path = path.replace(/=s\d+(-c)?/i, "=s512-c");
    path = path.replace(/\/s\d+(-c)?\//i, "/s512-c/");
    // Query-style size params used by some Google CDN variants
    if (parsed.searchParams.has("sz")) {
      parsed.searchParams.set("sz", "512");
    }
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Google / OAuth avatar can land in several metadata fields.
 * Prefer the first non-empty http(s) URL we find.
 */
export function extractOAuthAvatarUrl(
  user: User | null | undefined,
): string | undefined {
  if (!user) return undefined;

  const candidates: unknown[] = [
    user.user_metadata?.avatar_url,
    user.user_metadata?.picture,
    user.user_metadata?.avatar,
    ...(user.identities ?? []).flatMap((identity) => {
      const data = identity.identity_data ?? {};
      return [data.avatar_url, data.picture, data.avatar];
    }),
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return upgradeGoogleAvatarUrl(trimmed);
    }
  }

  return undefined;
}
