import { type NextRequest } from "next/server";
import {
  completeGoogleOAuth,
  startGoogleOAuth,
} from "@/lib/auth/google-oauth";

/**
 * Start Google sign-in, or finish it when Google returns a code.
 * Hides *.supabase.co when GOOGLE_OAUTH_CLIENT_ID/SECRET are set.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("code") || params.get("error") || params.get("state")) {
    return completeGoogleOAuth(request);
  }
  return startGoogleOAuth(request);
}
