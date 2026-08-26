import { cn } from "@/lib/utils";

const GIF_SRC = "/icons/bloub-default-cycle.gif";
const SIZE = 80;

/** Minimum time the post-auth Bloub beat stays on screen. */
export const POST_AUTH_LOADING_MS = 200;
export const GOOGLE_AUTH_LOADING_MS = 4000;

const SPLASH_KEY = "cubicle_post_auth_splash";

export function waitAtLeast(
  startedAt?: number,
  minMs = POST_AUTH_LOADING_MS,
) {
  const left =
    startedAt == null
      ? postAuthSplashRemainingMs()
      : minMs - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    setTimeout(resolve, left);
  });
}

export function markPostAuthSplash(startedAt = Date.now()) {
  try {
    sessionStorage.setItem(SPLASH_KEY, String(startedAt));
  } catch {
    // ignore private-mode / disabled storage
  }
}

export function postAuthSplashRemainingMs() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(SPLASH_KEY);
    if (!raw) return 0;
    const left = POST_AUTH_LOADING_MS - (Date.now() - Number(raw));
    if (left <= 0) {
      sessionStorage.removeItem(SPLASH_KEY);
      return 0;
    }
    return left;
  } catch {
    return 0;
  }
}

export function clearPostAuthSplash() {
  try {
    sessionStorage.removeItem(SPLASH_KEY);
  } catch {
    // ignore
  }
}

/**
 * Full-screen post-auth loading beat — animated Bloub instead of
 * spinner + "Loading Cubicle…" copy.
 */
export function BloubLoading({
  label = "Loading Cubicle",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex min-h-dvh w-full items-center justify-center bg-[#f6f6f7]",
        className,
      )}
    >
      {/* Animated GIF — next/image would freeze the cycle. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={GIF_SRC}
        alt=""
        width={SIZE}
        height={SIZE}
        draggable={false}
        className="pointer-events-none select-none object-contain"
        style={{ width: SIZE, height: SIZE }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
