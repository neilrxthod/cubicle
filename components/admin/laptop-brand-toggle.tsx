"use client"

import { useId } from "react"
import { motion } from "motion/react"
import {
  LAPTOP_BRANDS,
  laptopBrandLabel,
  type LaptopBrand,
} from "@/lib/types"
import { cn } from "@/lib/utils"

/** Official Dell circle wordmark — inline so production never depends on /brands/*.svg. */
export function DellLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 300"
      className={className}
      aria-hidden
      focusable="false"
    >
      <g transform="translate(-318.33375,-439.74274)">
        <g transform="matrix(4.579965,0,0,-4.579965,468.34291,456.8459)">
          <path
            fill="#007db8"
            d="m 0,0 c -8.01,0 -15.264,-3.249 -20.516,-8.505 -5.254,-5.244 -8.501,-12.502 -8.501,-20.516 0,-8.008 3.247,-15.261 8.501,-20.507 5.252,-5.249 12.506,-8.504 20.516,-8.504 8.012,0 15.27,3.255 20.514,8.504 5.252,5.246 8.492,12.499 8.492,20.507 0,8.014 -3.24,15.272 -8.492,20.516 C 15.27,-3.249 8.012,0 0,0 m 0,3.516 c 17.965,0 32.531,-14.568 32.531,-32.537 0,-17.963 -14.566,-32.529 -32.531,-32.529 -17.963,0 -32.535,14.566 -32.535,32.529 0,17.969 14.572,32.537 32.535,32.537"
          />
        </g>
        <g transform="matrix(4.579965,0,0,-4.579965,397.87238,588.54693)">
          <path
            fill="#007db8"
            d="m 0,0 c 0,1.896 -1.258,2.973 -3.039,2.973 l -1.09,0 0,-5.948 1.059,0 C -1.414,-2.975 0,-2.075 0,0 M 19.389,-2.14 11.359,-8.463 4.02,-2.685 C 2.961,-5.229 0.402,-6.996 -2.545,-6.996 l -6.281,0 0,13.992 6.281,0 c 3.293,0 5.666,-2.094 6.563,-4.325 l 7.341,5.772 2.719,-2.14 -6.728,-5.288 1.293,-1.012 6.726,5.285 2.723,-2.134 -6.727,-5.294 1.291,-1.014 6.733,5.295 0,4.855 4.881,0 0,-9.908 4.869,0 0,-4.101 -9.75,0 0,4.873 z m 15.933,-0.774 4.867,0 0,-4.099 -9.753,0 0,14.009 4.886,0 0,-9.91 z"
          />
        </g>
      </g>
    </svg>
  )
}

/** Official Chrome / Chromebook four-color mark (2022 geometry). */
export function ChromebookLogo({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "")
  const red = `cb-red-${uid}`
  const yellow = `cb-yellow-${uid}`
  const green = `cb-green-${uid}`

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={red}
          x1="3.2173"
          y1="15"
          x2="44.7812"
          y2="15"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#d93025" />
          <stop offset="1" stopColor="#ea4335" />
        </linearGradient>
        <linearGradient
          id={yellow}
          x1="20.7219"
          y1="47.6791"
          x2="41.5039"
          y2="11.6837"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#fcc934" />
          <stop offset="1" stopColor="#fbbc04" />
        </linearGradient>
        <linearGradient
          id={green}
          x1="26.5981"
          y1="46.5015"
          x2="5.8161"
          y2="10.506"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1e8e3e" />
          <stop offset="1" stopColor="#34a853" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="23.9947" r="12" fill="#fff" />
      <path
        d="M24 12h20.7812A23.9939 23.9939 0 0 0 3.2173 12.0029L13.6079 30l.0093-.0024A11.9852 11.9852 0 0 1 24 12Z"
        fill={`url(#${red})`}
      />
      <path
        d="M34.3913 30.0029 24.0007 48A23.994 23.994 0 0 0 44.78 12.0031H23.9989l-.0025.0093A11.985 11.985 0 0 1 34.3913 30.0029Z"
        fill={`url(#${yellow})`}
      />
      <path
        d="M13.6086 30.0031 3.218 12.006A23.994 23.994 0 0 0 24.0025 48L34.3931 30.0029l-.0067-.0068a11.9852 11.9852 0 0 1-20.7778.007Z"
        fill={`url(#${green})`}
      />
      <circle cx="24" cy="24" r="9.5" fill="#1a73e8" />
    </svg>
  )
}

export function LaptopBrandLogo({
  brand,
  className,
}: {
  brand: LaptopBrand
  className?: string
}) {
  return brand === "dell" ? (
    <DellLogo className={className} />
  ) : (
    <ChromebookLogo className={className} />
  )
}

/** Compact brand mark for inventory cards and the daily board. */
export function CartBrandMark({
  brand,
  className,
  logoClassName,
}: {
  brand?: LaptopBrand | null
  className?: string
  logoClassName?: string
}) {
  if (!brand) return null
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      title={laptopBrandLabel(brand)}
    >
      <LaptopBrandLogo brand={brand} className={cn("size-4", logoClassName)} />
      <span className="sr-only">{laptopBrandLabel(brand)}</span>
    </span>
  )
}

/**
 * Corporate two-option slider — Dell / Chromebook with official marks.
 * Matches the inventory dialog and the issue-severity segmented track.
 */
export function LaptopBrandToggle({
  value,
  onChange,
  disabled,
}: {
  value: LaptopBrand
  onChange: (next: LaptopBrand) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
        Laptop type
      </span>
      <div
        role="radiogroup"
        aria-label="Laptop type"
        className={cn(
          "relative grid grid-cols-2 gap-0.5 rounded-full p-1",
          "border border-neutral-200/80 bg-neutral-100/90",
        )}
      >
        {LAPTOP_BRANDS.map((brand) => {
          const selected = value === brand
          return (
            <button
              key={brand}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(brand)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault()
                  onChange(brand === "dell" ? "chromebook" : "dell")
                }
              }}
              className={cn(
                "relative flex h-10 items-center justify-center gap-2 rounded-full px-2",
                "text-[12.5px] font-medium tracking-[-0.015em]",
                "outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                "disabled:pointer-events-none disabled:opacity-50",
                selected ? "text-neutral-950" : "text-neutral-400",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="cart-laptop-brand-thumb"
                  className={cn(
                    "absolute inset-0 z-0 rounded-full bg-white",
                    "shadow-[0_1px_2px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)]",
                  )}
                  transition={{
                    type: "spring",
                    stiffness: 440,
                    damping: 36,
                    mass: 0.65,
                  }}
                />
              ) : null}
              <LaptopBrandLogo
                brand={brand}
                className={cn(
                  "relative z-[1] size-6 shrink-0",
                  selected ? "opacity-100" : "opacity-55",
                )}
              />
              <span className="relative z-[1]">{laptopBrandLabel(brand)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
