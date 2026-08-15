import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Browser (client components) Supabase client.
 * Uses the public publishable / anon key — safe to expose when RLS is enabled.
 *
 * Singleton is required so Realtime stays on one websocket across the app
 * (bookings, issues, carts, etc. all share the same live channel).
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Add them to .env.local.",
    );
  }

  browserClient = createBrowserClient(url, publicKey);
  return browserClient;
}
