import { NextResponse, type NextRequest } from "next/server";
import { rewriteGoogleRedirectUri } from "@/lib/auth/oauth-google-url";
import { SUPABASE_SAME_ORIGIN_PROXY_PREFIX } from "@/lib/auth/oauth-proxy";

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "").trim();
  return raw || null;
}

export {
  isBrowserSafeOAuthRedirect,
  rewriteGoogleRedirectUri,
} from "@/lib/auth/oauth-google-url";

function rewriteSetCookie(value: string): string {
  return value.replace(/;\s*domain=[^;]*/gi, "");
}

/**
 * Forward /__supabase/* to the Supabase project (authorize hop).
 * Location headers to the project host are rewritten onto this origin so
 * the browser never visits *.supabase.co.
 */
export async function proxySupabaseAuth(
  request: NextRequest,
): Promise<NextResponse> {
  const project = supabaseOrigin();
  if (!project) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const prefix = SUPABASE_SAME_ORIGIN_PROXY_PREFIX;
  const path = request.nextUrl.pathname.startsWith(prefix)
    ? request.nextUrl.pathname.slice(prefix.length) || "/"
    : request.nextUrl.pathname;

  const dest = new URL(path + request.nextUrl.search, `${project}/`);
  const publicOrigin = request.nextUrl.origin;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(dest, init);
  } catch {
    return NextResponse.json(
      { error: "Could not reach sign-in." },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (name === "transfer-encoding" || name === "content-encoding") return;
    if (name === "set-cookie") return;
    if (name === "location") {
      out.set("location", rewriteGoogleRedirectUri(value, publicOrigin, project));
      return;
    }
    out.set(key, value);
  });

  const cookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  for (const cookie of cookies) {
    out.append("set-cookie", rewriteSetCookie(cookie));
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
