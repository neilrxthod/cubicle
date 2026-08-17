import { NextResponse, type NextRequest } from "next/server";
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

function isGoogleAccountsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "accounts.google.com" ||
    host.endsWith(".google.com") ||
    host.endsWith(".googleusercontent.com")
  );
}

/**
 * Point Google's OAuth redirect_uri at this app so the account picker
 * shows mycubicle.app instead of <ref>.supabase.co.
 */
export function rewriteGoogleRedirectUri(
  location: string,
  publicOrigin: string,
  projectOrigin: string,
): string {
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    return location;
  }

  if (isGoogleAccountsHost(url.hostname)) {
    const redirectUri = url.searchParams.get("redirect_uri");
    if (!redirectUri) return url.toString();
    try {
      const callback = new URL(redirectUri);
      const project = new URL(projectOrigin);
      const isProjectCallback =
        callback.hostname.toLowerCase() === project.hostname.toLowerCase() &&
        callback.pathname.includes("/auth/v1/callback");
      const alreadyProxied = callback.pathname.startsWith(
        SUPABASE_SAME_ORIGIN_PROXY_PREFIX,
      );
      if (isProjectCallback && !alreadyProxied) {
        url.searchParams.set(
          "redirect_uri",
          `${publicOrigin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${callback.pathname}${callback.search}`,
        );
      }
    } catch {
      return url.toString();
    }
    return url.toString();
  }

  try {
    const project = new URL(projectOrigin);
    if (url.hostname.toLowerCase() === project.hostname.toLowerCase()) {
      return `${publicOrigin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // keep original
  }

  return location;
}

function rewriteSetCookie(value: string): string {
  return value.replace(/;\s*domain=[^;]*/gi, "");
}

/**
 * Forward /__supabase/* to the Supabase project and hide supabase.co from
 * Google's account chooser by swapping redirect_uri onto this origin.
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
