import { CALENDAR_SCOPE } from "@/lib/calendar/google-calendar";
import { markPendingCalendarConnect } from "@/lib/calendar/preferences";
import { GOOGLE_HOSTED_DOMAIN } from "@/lib/auth/school-domain";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Start Google OAuth again with Calendar write scope.
 * After callback, Settings will mark the connection active.
 */
export async function startGoogleCalendarConnect(): Promise<{
  ok: true;
} | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Google sign-in is not configured in this environment. Use demo mode or set Supabase env vars.",
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    markPendingCalendarConnect();

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings?calendar=connected")}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: CALENDAR_SCOPE,
        queryParams: {
          hd: GOOGLE_HOSTED_DOMAIN,
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start Google connect.",
    };
  }
}
