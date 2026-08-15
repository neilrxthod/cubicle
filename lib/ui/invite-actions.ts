import { cn } from "@/lib/utils";

/**
 * Shared Accept / Decline control polish.
 * Soft lift + color shift on hover; brief press scale — no layout jump.
 */

/** Keep the in-button spinner on screen for local (sync) invite actions. */
const INVITE_ACTION_MIN_MS = 320;

export async function holdInviteBusy(startedAt: number): Promise<void> {
  const remaining = INVITE_ACTION_MIN_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, remaining));
}

const motion =
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

/** Secondary dismiss — outline / wash (Decline, Cancel request). */
export function inviteDeclineClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "border border-neutral-200/90 bg-white text-neutral-600",
    "shadow-[0_1px_0_rgba(0,0,0,0.02)]",
    "hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    "active:bg-neutral-100 active:shadow-none",
    "focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-1",
    motion,
    className,
  );
}

/** Primary confirm — flat red fill, no glow or gradient. */
export function inviteAcceptClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none shadow-none",
    "bg-red-600 text-white",
    "hover:bg-red-700",
    "active:bg-red-800",
    "focus-visible:ring-2 focus-visible:ring-red-600/25 focus-visible:ring-offset-1",
    motion,
    className,
  );
}

/** @deprecated Same as inviteAcceptClassName — kept so older call sites stay clean. */
export function inviteAcceptEmphasizedClassName(className?: string) {
  return inviteAcceptClassName(className);
}

/** Compact capsules on a booking slot — white, no color fill. */
export function inviteChipDeclineClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-white text-neutral-600 ring-1 ring-black/[0.08]",
    "hover:bg-neutral-50 hover:text-neutral-950",
    "active:bg-neutral-100",
    "focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
    motion,
    className,
  );
}

export function inviteChipAcceptClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none shadow-none",
    "bg-red-600 text-white ring-1 ring-red-600",
    "hover:bg-red-700 hover:ring-red-700",
    "active:bg-red-800",
    "focus-visible:ring-2 focus-visible:ring-red-600/30 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
    motion,
    className,
  );
}
