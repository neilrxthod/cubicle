"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { AnimatePresence, motion } from "motion/react"
import { Calendar as CalendarIcon, ChevronDown, Plus } from "lucide-react"

import { batchRestrictSlots } from "@/lib/actions"
import type { Cart, Period, RestrictionCategory } from "@/lib/types"
import { PERIODS, RESTRICTION_TYPES } from "@/lib/types"
import {
  fadeUpVariants,
  fadeVariants,
  motionSafe,
  transitionFast,
} from "@/lib/motion/platform"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import {
  Calendar,
  calendarPopoverClassName,
} from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

const TYPE_CHIP: Record<RestrictionCategory, { on: string; off: string }> = {
  general: {
    on: "border-neutral-950 bg-neutral-950 text-white",
    off: "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800",
  },
  ap_exam: {
    on: "border-violet-600 bg-violet-600 text-white",
    off: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
  },
  testing: {
    on: "border-sky-600 bg-sky-600 text-white",
    off: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
  },
  holiday: {
    on: "border-rose-600 bg-rose-600 text-white",
    off: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
  },
  event: {
    on: "border-amber-600 bg-amber-600 text-white",
    off: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100",
  },
  pd: {
    on: "border-teal-600 bg-teal-600 text-white",
    off: "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:bg-teal-100",
  },
  other: {
    on: "border-stone-600 bg-stone-600 text-white",
    off: "border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:bg-stone-100",
  },
}

function Col({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Field className={cn("min-w-0 gap-1.5", className)}>
      <FieldLabel
        htmlFor={htmlFor}
        className="text-[11px] font-medium tracking-[-0.01em] text-neutral-500"
      >
        {label}
      </FieldLabel>
      {children}
    </Field>
  )
}

const SCOPE_CHIP = {
  day: {
    thumb: "bg-indigo-600",
    off: "text-indigo-700 hover:text-indigo-950",
  },
  range: {
    thumb: "bg-orange-600",
    off: "text-orange-700 hover:text-orange-950",
  },
} as const

function CapsuleSlider({
  value,
  onChange,
}: {
  value: "day" | "range"
  onChange: (id: "day" | "range") => void
}) {
  const options = [
    { id: "day" as const, label: "Day" },
    { id: "range" as const, label: "Range" },
  ]
  return (
    <div
      role="tablist"
      aria-label="When"
      className="relative grid h-8 grid-cols-2 rounded-full bg-neutral-100 p-[3px]"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full",
          "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          value === "range" ? "translate-x-full" : "translate-x-0",
          SCOPE_CHIP[value].thumb,
        )}
      />
      {options.map((opt) => {
        const on = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative z-[1] inline-flex items-center justify-center rounded-full",
              "text-[12.5px] font-medium tracking-[-0.01em]",
              "select-none [-webkit-tap-highlight-color:transparent]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
              on ? "text-white" : SCOPE_CHIP[opt.id].off,
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function BoardBlockDialog({
  open,
  onOpenChange,
  carts,
  activeDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  carts: Cart[]
  activeDate: string
}) {
  const router = useRouter()
  const activeCarts = useMemo(
    () => carts.filter((cart) => cart.status !== "maintenance"),
    [carts],
  )

  const [scope, setScope] = useState<"day" | "range">("day")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const day = parseLocalYmd(activeDate)
    return { from: day, to: day }
  })
  const [selectedPeriods, setSelectedPeriods] = useState<Set<Period>>(
    () => new Set(PERIODS),
  )
  const [category, setCategory] = useState<RestrictionCategory>("general")
  const [reason, setReason] = useState("")
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [busy, setBusy] = useState<"restrict" | "available" | null>(null)

  function resetFromDate(ymd: string) {
    const day = parseLocalYmd(ymd)
    setScope("day")
    setDateRange({ from: day, to: day })
    setSelectedPeriods(new Set(PERIODS))
    setCategory("general")
    setReason("")
    setWeekdaysOnly(true)
  }

  function handleOpenChange(next: boolean) {
    if (next) resetFromDate(activeDate)
    onOpenChange(next)
  }

  const start = dateRange?.from ?? parseLocalYmd(activeDate)
  const end = scope === "day" ? start : (dateRange?.to ?? start)
  const startYmd = start ? format(start, "yyyy-MM-dd") : ""
  const endYmd = end ? format(end, "yyyy-MM-dd") : ""

  const dateSummary = start
    ? scope === "range" && end && startYmd !== endYmd
      ? `${format(start, "MMM d")} – ${format(end, "MMM d")}`
      : format(start, "EEE, MMM d")
    : "Select dates"

  const canApply =
    !busy &&
    activeCarts.length > 0 &&
    selectedPeriods.size > 0 &&
    Boolean(start)

  async function apply(action: "restrict" | "available") {
    if (!start || !canApply) return
    setBusy(action)
    try {
      const res = await batchRestrictSlots(
        activeCarts.map((cart) => cart.id),
        startYmd,
        endYmd || startYmd,
        Array.from(selectedPeriods),
        action,
        {
          category,
          reason: reason.trim() || undefined,
          weekdaysOnly: scope === "range" ? weekdaysOnly : false,
        },
      )
      if (!res.ok) {
        toast({
          title: action === "restrict" ? "Could not lock" : "Could not unlock",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: action === "restrict" ? "Bookings blocked" : "Locks released",
        description:
          action === "restrict"
            ? `${res.data?.restrictedCount ?? 0} locked · ${res.data?.skippedBookedCount ?? 0} booked skipped`
            : `${res.data?.restrictedCount ?? 0} unlocked`,
      })
      router.refresh()
      onOpenChange(false)
    } finally {
      setBusy(null)
    }
  }

  function togglePeriod(period: Period) {
    const next = new Set(selectedPeriods)
    if (next.has(period)) next.delete(period)
    else next.add(period)
    setSelectedPeriods(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-[min(calc(100vw-1.5rem),44rem)] gap-0 overflow-x-hidden overflow-y-auto p-0",
          "rounded-xl border border-neutral-200 bg-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.08)] sm:max-w-[44rem]",
        )}
      >
        <DialogHeader className="gap-1 px-5 pt-5 pr-12 pb-4 text-left">
          <DialogTitle className="text-[16px] font-medium tracking-[-0.02em] text-neutral-950">
            Block bookings
          </DialogTitle>
          <DialogDescription className="text-[12.5px] tabular-nums text-neutral-500">
            {dateSummary}
            <span className="text-neutral-300"> · </span>
            Booked slots stay
          </DialogDescription>
        </DialogHeader>

        <div className="border-t border-neutral-200 px-5 py-4">
          <FieldGroup className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Col label="When">
              <CapsuleSlider
                value={scope}
                onChange={(next) => {
                  setScope(next)
                  if (next === "day") {
                    const day = parseLocalYmd(activeDate)
                    setDateRange({ from: day, to: day })
                  }
                }}
              />
            </Col>

            <Col label="Date">
              <div className="flex min-h-8 flex-col gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Choose date"
                      className={cn(
                        "inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5",
                        "text-left text-[13px] tabular-nums tracking-[-0.01em] text-neutral-950",
                        "transition-colors duration-150 ease-out",
                        "hover:border-neutral-300 hover:bg-neutral-50",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                        "data-[state=open]:[&_svg.chevron]:rotate-180",
                      )}
                    >
                      <CalendarIcon
                        className="size-3.5 shrink-0 text-neutral-400"
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 truncate">
                        {dateSummary}
                      </span>
                      <ChevronDown
                        className="chevron size-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        strokeWidth={1.75}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={calendarPopoverClassName}
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={12}
                    avoidCollisions
                  >
                    {scope === "range" ? (
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        defaultMonth={start}
                        numberOfMonths={1}
                      />
                    ) : (
                      <Calendar
                        mode="single"
                        selected={start}
                        onSelect={(day) => {
                          if (!day) return
                          setDateRange({ from: day, to: day })
                        }}
                        defaultMonth={start}
                      />
                    )}
                  </PopoverContent>
                </Popover>
                <AnimatePresence initial={false}>
                  {scope === "range" ? (
                    <motion.label
                      key="weekends"
                      variants={fadeUpVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={motionSafe(transitionFast)}
                      className="flex h-8 cursor-pointer items-center justify-between gap-2"
                    >
                      <span className="text-[12.5px] text-neutral-500">
                        Skip weekends
                      </span>
                      <Switch
                        checked={weekdaysOnly}
                        onCheckedChange={setWeekdaysOnly}
                        className={cn(
                          "h-[22px] w-[38px] shrink-0 shadow-none",
                          "data-[state=checked]:bg-neutral-950 data-[state=unchecked]:bg-neutral-200",
                          "[&_[data-slot=switch-thumb]]:size-[18px] [&_[data-slot=switch-thumb]]:shadow-none",
                          "data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-[16px]",
                          "data-[state=unchecked]:[&_[data-slot=switch-thumb]]:translate-x-[2px]",
                        )}
                      />
                    </motion.label>
                  ) : null}
                </AnimatePresence>
              </div>
            </Col>

            <Col label="Periods">
              <div
                className="grid w-full grid-cols-5 gap-1.5"
                role="group"
                aria-label="Periods"
              >
                {PERIODS.map((period) => {
                  const on = selectedPeriods.has(period)
                  return (
                    <button
                      key={period}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePeriod(period)}
                      className={cn(
                        "group/period relative flex h-7 min-w-0 items-center justify-center rounded-full",
                        "border border-dashed text-[12.5px] tabular-nums tracking-[-0.01em]",
                        "transition-[background-color,border-color,color] duration-200 ease-out",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                        on
                          ? "border-solid border-neutral-950 bg-neutral-950 font-medium text-white"
                          : "border-neutral-400 bg-transparent font-normal text-neutral-500 hover:border-neutral-950",
                      )}
                    >
                      <span
                        className={cn(
                          "transition-opacity duration-150 ease-out",
                          !on && "group-hover/period:opacity-0",
                        )}
                      >
                        {period}
                      </span>
                      <Plus
                        aria-hidden
                        strokeWidth={2.25}
                        className={cn(
                          "pointer-events-none absolute size-3 text-neutral-950",
                          "transition-opacity duration-150 ease-out",
                          on
                            ? "opacity-0"
                            : "opacity-0 group-hover/period:opacity-100",
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </Col>

            <Col label="Type">
              <div
                className="flex min-h-[3.75rem] flex-wrap content-start gap-1"
                role="radiogroup"
                aria-label="Type"
              >
                {RESTRICTION_TYPES.map((opt) => {
                  const on = category === opt.id
                  const chip = TYPE_CHIP[opt.id]
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setCategory(opt.id)
                        if (opt.id !== "other") setReason("")
                      }}
                      className={cn(
                        "inline-flex h-7 items-center rounded-full border px-2.5",
                        "text-[12px] font-medium tracking-[-0.01em]",
                        "select-none [-webkit-tap-highlight-color:transparent]",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                        on ? chip.on : chip.off,
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </Col>

            <AnimatePresence initial={false}>
              {category === "other" ? (
                <motion.div
                  key="note"
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={motionSafe(transitionFast)}
                  className="min-w-0 sm:col-span-2"
                >
                  <Col label="Note" htmlFor="block-reason">
                    <Input
                      id="block-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Optional"
                      className={cn(
                        "h-8 rounded-md border-neutral-200 bg-white px-2.5 shadow-none",
                        "text-[13px] tracking-[-0.01em] placeholder:text-neutral-400",
                        "focus-visible:ring-1 focus-visible:ring-black/15",
                      )}
                    />
                  </Col>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </FieldGroup>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 sm:space-x-0">
          <button
            type="button"
            disabled={!canApply}
            aria-busy={busy === "available"}
            onClick={() => void apply("available")}
            className={cn(
              "inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-full px-5",
              "border border-neutral-300 bg-white",
              "text-[13px] font-medium tracking-[-0.01em] text-neutral-600 outline-none",
              "transition-colors duration-150 ease-out",
              "hover:bg-neutral-200",
              "focus-visible:ring-1 focus-visible:ring-black/15",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {busy === "available" ? (
              <Spinner className="size-3.5" />
            ) : (
              "Release"
            )}
          </button>
          <button
            type="button"
            disabled={!canApply}
            aria-busy={busy === "restrict"}
            onClick={() => void apply("restrict")}
            className={cn(
              "inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-full px-5",
              "bg-neutral-950 text-[13px] font-medium tracking-[-0.01em] text-white outline-none",
              "transition-colors duration-150 ease-out",
              "hover:bg-neutral-800",
              "focus-visible:ring-1 focus-visible:ring-black/15",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {busy === "restrict" ? (
              <Spinner className="size-3.5 text-white" />
            ) : (
              "Block"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
