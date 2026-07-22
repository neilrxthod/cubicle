import type { User } from "@supabase/supabase-js";

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
      return trimmed;
    }
  }

  return undefined;
}
