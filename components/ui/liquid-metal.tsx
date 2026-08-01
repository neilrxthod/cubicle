"use client"

import {
  forwardRef,
  memo,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react"
import { LiquidMetal as LiquidMetalShader } from "@paper-design/shaders-react"
import { cn } from "@/lib/utils"

// ============================================================================
// LiquidMetal — shader rim
// ============================================================================

export interface LiquidMetalProps {
  colorBack?: string
  colorTint?: string
  speed?: number
  repetition?: number
  distortion?: number
  scale?: number
  className?: string
  style?: CSSProperties
}

export const LiquidMetal = memo(function LiquidMetal({
  colorBack = "#7a7d84",
  colorTint = "#f4f4f5",
  speed = 0.28,
  repetition = 4,
  distortion = 0.1,
  scale = 1,
  className,
  style,
}: LiquidMetalProps) {
  return (
    <div
      className={cn("absolute inset-0 z-0 overflow-hidden", className)}
      style={style}
    >
      <LiquidMetalShader
        colorBack={colorBack}
        colorTint={colorTint}
        speed={speed}
        repetition={repetition}
        distortion={distortion}
        softness={0.1}
        shiftRed={0.18}
        shiftBlue={-0.18}
        angle={40}
        shape="none"
        scale={scale}
        fit="cover"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
})

LiquidMetal.displayName = "LiquidMetal"

// ============================================================================
// LiquidMetalButton — compact corporate control
// ============================================================================

export interface LiquidMetalButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  icon?: ReactNode
  trailing?: ReactNode
  borderWidth?: number
  metalConfig?: Omit<LiquidMetalProps, "className" | "style">
}

/**
 * Small, minimal liquid-metal button for product toolbars.
 * Default look: cool steel rim, white body, h-8 density.
 */
export const LiquidMetalButton = forwardRef<
  HTMLButtonElement,
  LiquidMetalButtonProps
>(function LiquidMetalButton(
  {
    children,
    icon,
    trailing,
    borderWidth = 1.25,
    metalConfig,
    className,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "group relative inline-flex cursor-pointer border-none bg-transparent p-0 outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-neutral-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas,#f4f4f5)]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-lg",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.03)]",
          "group-data-[state=open]:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.06)]",
        )}
        style={{ padding: borderWidth }}
      >
        <LiquidMetal
          colorBack={metalConfig?.colorBack ?? "#6b6e75"}
          colorTint={metalConfig?.colorTint ?? "#f5f5f6"}
          speed={metalConfig?.speed ?? 0.3}
          repetition={metalConfig?.repetition ?? 4}
          distortion={metalConfig?.distortion ?? 0.1}
          scale={metalConfig?.scale ?? 1}
          className="absolute inset-0 z-0 rounded-lg"
        />

        <div
          className={cn(
            "relative z-10 flex h-7 items-center gap-1.5 rounded-[7px] bg-white px-2.5",
            "group-data-[state=open]:bg-neutral-50",
          )}
        >
          {icon ? (
            <span className="inline-flex shrink-0 text-neutral-500 [&_svg]:size-3.5">
              {icon}
            </span>
          ) : null}

          <span className="text-[12.5px] font-medium leading-none tracking-[-0.015em] text-neutral-800">
            {children}
          </span>

          {trailing ? (
            <span
              className={cn(
                "inline-flex shrink-0 text-neutral-400",
                "group-data-[state=open]:text-neutral-600",
                "group-data-[state=open]:[&_svg.chevron]:rotate-180",
                "[&_svg]:size-3",
              )}
            >
              {trailing}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
})

LiquidMetalButton.displayName = "LiquidMetalButton"

export default LiquidMetalButton
