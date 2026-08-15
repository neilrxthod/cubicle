/** Project URL from env (no trailing slash). */
export function getSupabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || undefined;
}

/**
 * Public client key. Dashboard now issues `sb_publishable_…`
 * (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); the legacy JWT anon key
 * (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) still works.
 */
export function getSupabasePublicKey(): string | undefined {
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) return publishable;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return anon || undefined;
}

/** True when public Supabase env vars are present (project is configured). */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

/**
 * @deprecated Use `isRemotePlatformEnabled` from `@/lib/data/durability`.
 * Keys present ≠ platform data should hit that project (local is isolated).
 */
export function hasRemoteBackend(): boolean {
  return isSupabaseConfigured();
}
