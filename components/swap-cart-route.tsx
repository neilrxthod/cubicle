"use client"

import { cn } from "@/lib/utils"

type CartSide = {
  /** Cart display name, e.g. "Cart 3" */
  cartName: string
  /** Secondary line — teacher, class, or "Your cart" */
  detail?: string
  /** Small eyebrow above the name */
  eyebrow: string
}

/**
 * Visual from → to strip for cart swaps.
 * Makes exchange / handoff obvious at a glance.
 */
export function SwapCartRoute({
  from,
  to,
  /** exchange shows ⇄; handoff shows → */
  mode = "exchange",
  meta,
  className,
  size = "md",
}: {
  from: CartSide
  to: CartSide
  mode?: "exchange" | "handoff"
  /** e.g. "P3 · Mon, Mar 3" */
  meta?: string
  className?: string
  size?: "sm" | "md"
}) {
  const compact = size === "sm"

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "grid items-stretch gap-2",
          "grid-cols-[1fr_auto_1fr]",
        )}
      >
        <CartCard side={from} tone="from" compact={compact} />
        <div className="flex flex-col items-center justify-center px-0.5">
          <span
            aria-hidden
            className={cn(
              "flex items-center justify-center rounded-full border font-semibold tabular-nums text-neutral-600",
              compact
                ? "h-7 w-7 border-neutral-200 bg-white text-[13px]"
                : "h-9 w-9 border-neutral-200 bg-neutral-50 text-[15px]",
            )}
            title={mode === "exchange" ? "Exchange" : "Handoff"}
          >
            {mode === "exchange" ? "⇄" : "→"}
          </span>
        </div>
        <CartCard side={to} tone="to" compact={compact} />
      </div>
      {meta ? (
        <p
          className={cn(
            "mt-2 text-center text-neutral-500",
            compact ? "text-[11px]" : "text-[12px]",
          )}
        >
          {meta}
        </p>
      ) : null}
    </div>
  )
}

function CartCard({
  side,
  tone,
  compact,
}: {
  side: CartSide
  tone: "from" | "to"
  compact: boolean
}) {
  const isFrom = tone === "from"
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border text-left",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        isFrom
          ? "border-neutral-200 bg-white"
          : "border-emerald-200/80 bg-emerald-50/50",
      )}
    >
      <p
        className={cn(
          "font-medium uppercase tracking-[0.08em]",
          compact ? "text-[9.5px]" : "text-[10px]",
          isFrom ? "text-neutral-400" : "text-emerald-700/80",
        )}
      >
        {side.eyebrow}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate font-semibold tracking-tight text-neutral-950",
          compact ? "text-[12.5px]" : "text-[14px]",
        )}
      >
        {side.cartName}
      </p>
      {side.detail ? (
        <p
          className={cn(
            "mt-0.5 truncate text-neutral-500",
            compact ? "text-[10.5px]" : "text-[11.5px]",
          )}
        >
          {side.detail}
        </p>
      ) : null}
    </div>
  )
}
