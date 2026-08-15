import { cn } from "@/lib/utils";

/**
 * Shared Accept / Decline control polish.
 * Soft lift + color shift on hover; brief press scale — no layout jump.
 */
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

/** Primary confirm — solid dark, no color wash. */
export function inviteAcceptClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-neutral-950 text-white",
    "hover:bg-neutral-800",
    "active:bg-neutral-900",
    "focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-1",
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
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-neutral-950 text-white ring-1 ring-neutral-950",
    "hover:bg-neutral-800 hover:ring-neutral-800",
    "active:bg-neutral-900",
    "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
    motion,
    className,
  );
}
