import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Server (Server Components, Server Actions, Route Handlers) Supabase client.
 * Reads/writes auth cookies via next/headers.
 */
export async function createClient() {
  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Add them to .env.local.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can fail in Server Components (read-only cookies).
          // Middleware or a Server Action should refresh the session instead.
        }
      },
    },
  });
}
