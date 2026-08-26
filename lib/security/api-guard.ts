import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSchoolEmail, normalizeEmail } from "@/lib/auth/school-domain";

type StaffActor = {
  id: string;
  email: string;
  role: "teacher" | "admin";
};

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Per-isolate burst limiter. Complements platform WAF; not a global quota. */
export function allowRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

export function clientKey(request: Request, extra = ""): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return extra ? `${extra}:${ip}` : ip;
}

/** Browser same-origin fetch sends Origin. Reject cross-site POSTs. */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}

export function forbidden(message = "Forbidden.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorized(message = "Sign in required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function tooMany() {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429 },
  );
}

/**
 * Signed-in school staff whose email is still on the allowlist.
 * Role comes from the allowlist, not a client-writable profile column.
 */
export async function requireAllowlistedStaff(): Promise<
  { ok: true; actor: StaffActor } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    return { ok: false, response: unauthorized() };
  }

  const email = normalizeEmail(user.email);
  if (!isSchoolEmail(email)) {
    return { ok: false, response: forbidden("School account required.") };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Access control is not configured." },
        { status: 503 },
      ),
    };
  }

  const { data: allowed, error: allowError } = await admin
    .from("allowed_emails")
    .select("email, role")
    .eq("email", email)
    .maybeSingle();

  if (allowError) {
    console.error("[api-guard] allowlist lookup failed:", allowError.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not verify access." },
        { status: 503 },
      ),
    };
  }

  if (!allowed || (allowed.role !== "admin" && allowed.role !== "teacher")) {
    return { ok: false, response: forbidden("Access revoked.") };
  }

  return {
    ok: true,
    actor: { id: user.id, email, role: allowed.role },
  };
}

export async function requireSchoolAdmin(): Promise<
  { ok: true; actor: StaffActor } | { ok: false; response: NextResponse }
> {
  const staff = await requireAllowlistedStaff();
  if (!staff.ok) return staff;
  if (staff.actor.role !== "admin") {
    return { ok: false, response: forbidden("Admin only.") };
  }
  return staff;
}
