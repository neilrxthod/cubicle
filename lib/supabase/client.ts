import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser (client components) Supabase client.
 * Uses the public anon key — safe to expose when RLS is enabled.
 *
 * Singleton is required so Realtime stays on one websocket across the app
 * (bookings, issues, carts, etc. all share the same live channel).
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.",
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
