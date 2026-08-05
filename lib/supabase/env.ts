/** True when public Supabase env vars are present (project is configured). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/**
 * @deprecated Use `isRemotePlatformEnabled` from `@/lib/data/durability`.
 * Keys present ≠ platform data should hit that project (local is isolated).
 */
export function hasRemoteBackend(): boolean {
  return isSupabaseConfigured();
}
