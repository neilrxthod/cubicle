/** True when public Supabase env vars are present (project is configured). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/**
 * True when the app is expected to talk only to Postgres (not browser seed).
 * Prefer importing from `@/lib/data/durability` for full production rules.
 */
export function hasRemoteBackend(): boolean {
  return isSupabaseConfigured();
}
