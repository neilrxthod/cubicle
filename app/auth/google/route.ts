import { type NextRequest } from "next/server";
import { startGoogleOAuth } from "@/lib/auth/google-oauth-start";
import { allowRate, clientKey, tooMany } from "@/lib/security/rate-limit";

/**
 * Start Google sign-in, or finish it when Google returns a code.
 * Hides *.supabase.co when GOOGLE_OAUTH_CLIENT_ID/SECRET are set.
 */
export async function GET(request: NextRequest) {
  if (!allowRate(clientKey(request, "google-oauth"), 20, 60_000)) {
    return tooMany();
  }
  const params = request.nextUrl.searchParams;
  if (params.get("code") || params.get("error") || params.get("state")) {
    const { completeGoogleOAuth } = await import("@/lib/auth/google-oauth");
    return completeGoogleOAuth(request);
  }
  return startGoogleOAuth(request);
}
