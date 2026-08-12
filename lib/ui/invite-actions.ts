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

/** Primary confirm — solid dark (Accept exchange / handoff, board accept). */
export function inviteAcceptClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-neutral-950 text-white",
    "shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
    "hover:bg-neutral-800 hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)]",
    "active:bg-neutral-900 active:shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
    "focus-visible:ring-2 focus-visible:ring-neutral-900/25 focus-visible:ring-offset-1",
    motion,
    className,
  );
}

/** Primary confirm — solid red (share invite cards). */
export function inviteAcceptEmphasizedClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-red-600 text-white",
    "shadow-[0_1px_2px_rgba(220,38,38,0.25)]",
    "hover:bg-red-700 hover:shadow-[0_4px_12px_rgba(220,38,38,0.28)]",
    "active:bg-red-800 active:shadow-[0_1px_2px_rgba(220,38,38,0.2)]",
    "focus-visible:ring-2 focus-visible:ring-red-600/30 focus-visible:ring-offset-1",
    motion,
    className,
  );
}

/**
 * Compact chips on a dark/colored booking slot (daily board).
 * Soft frosted surface; Decline stays quieter, Accept slightly stronger.
 */
export function inviteChipDeclineClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-white/90 text-neutral-600 ring-1 ring-black/10 backdrop-blur-[2px]",
    "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
    "hover:bg-white hover:text-neutral-950 hover:ring-black/15",
    "hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
    "active:bg-neutral-100 active:shadow-none",
    "focus-visible:ring-2 focus-visible:ring-white/80",
    motion,
    className,
  );
}

export function inviteChipAcceptClassName(className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium outline-none",
    "bg-white text-neutral-950 ring-1 ring-black/10",
    "shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
    "hover:bg-neutral-950 hover:text-white hover:ring-neutral-950",
    "hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]",
    "active:bg-neutral-900 active:text-white active:shadow-none",
    "focus-visible:ring-2 focus-visible:ring-white/80",
    motion,
    className,
  );
}
