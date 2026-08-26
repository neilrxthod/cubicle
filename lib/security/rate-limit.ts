import { NextResponse } from "next/server";

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

export function tooMany() {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429 },
  );
}
