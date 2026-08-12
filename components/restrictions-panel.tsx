"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  addDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
} from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Search,
  Shield,
  Unlock,
  Wrench,
  X,
} from "lucide-react"

import {
  batchRestrictSlots,
  toggleSlotRestriction,
  updateBookingPolicy,
} from "@/lib/actions"
import type {
  Booking,
  BookingPolicy,
  Cart,
  Period,
  RestrictionCategory,
  SlotRestriction,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  calendarPopoverClassName,
} from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"

const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

/** Same fluid grid rhythm as Schedule DailyBoard. */
const cellBase =
  "flex min-h-11 min-w-0 border-l border-[var(--hairline)] transition-colors duration-150 ease-out sm:min-h-12"

/**
 * Admin restrictions board — DailyBoard UI language, lock/unlock actions.
 * Bookings are read-only (manage under Reservations).
 */
export function RestrictionsPanel({
  carts,
  bookings,
  slotRestrictions,
  bookingPolicy,
}: {
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
}) {
  const router = useRouter()
  const [activeDate, setActiveDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [query, setQuery] = useState("")
  const [lockedOnly, setLockedOnly] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)

  const restrictedMap = useMemo(() => {
    const map = new Map<string, SlotRestriction>()
    for (const r of slotRestrictions) {
      if (r.date === activeDate) map.set(`${r.cartId}:${r.period}`, r)
    }
    return map
  }, [slotRestrictions, activeDate])

  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>()
    for (const b of bookings) {
      if (b.date === activeDate) map.set(`${b.cartId}:${b.period}`, b)
    }
    return map
  }, [bookings, activeDate])

  const dayLocks = useMemo(
    () => slotRestrictions.filter((r) => r.date === activeDate),
    [slotRestrictions, activeDate],
  )
  const apCount = dayLocks.filter((r) => r.category === "ap_exam").length
  const generalLocks = dayLocks.length - apCount
  const bookedCount = bookingMap.size
  const total = carts.length * PERIODS.length
  const openCount = Math.max(0, total - bookedCount - dayLocks.length)

  const visibleCarts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return carts.filter((cart) => {
      if (q && !cart.name.toLowerCase().includes(q)) return false
      if (lockedOnly) {
        return PERIODS.some((p) => restrictedMap.has(`${cart.id}:${p}`))
      }
      return true
    })
  }, [carts, query, lockedOnly, restrictedMap])

  function go(offset: number) {
    setActiveDate(format(addDays(parseISO(activeDate), offset), "yyyy-MM-dd"))
  }

  function refresh() {
    router.refresh()
  }

  async function lockSlot(
    cartId: string,
    period: Period,
    category: RestrictionCategory,
    reason?: string,
  ) {
    const key = `${cartId}:${period}`
    setPendingKey(key)
    try {
      // toggle removes if present — ensure we set by remove then add when updating
      const existing = restrictedMap.get(key)
      if (existing) {
        await toggleSlotRestriction(cartId, activeDate, period)
      }
      const res = await toggleSlotRestriction(cartId, activeDate, period, {
        category,
        reason,
      })
      if (!res.ok) {
        toast({
          title: "Could not lock slot",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: category === "ap_exam" ? "AP exam lock set" : "Slot locked",
        description: `${period} · ${format(parseISO(activeDate), "MMM d")}`,
      })
      refresh()
    } finally {
      setPendingKey(null)
    }
  }

  async function unlockSlot(cartId: string, period: Period) {
    const key = `${cartId}:${period}`
    setPendingKey(key)
    try {
      const res = await toggleSlotRestriction(cartId, activeDate, period)
      if (!res.ok) {
        toast({
          title: "Could not unlock slot",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Slot unlocked" })
      refresh()
    } finally {
      setPendingKey(null)
    }
  }

  async function clearDayLocks() {
    setPendingKey("clear-day")
    try {
      const res = await batchRestrictSlots(
        carts.map((c) => c.id),
        activeDate,
        activeDate,
        PERIODS,
        "available",
      )
      if (!res.ok) {
        toast({
          title: "Could not clear locks",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Day locks cleared" })
      refresh()
    } finally {
      setPendingKey(null)
    }
  }

  const heading = format(parseISO(activeDate), "EEEE, MMM d")
  const isViewingToday = activeDate === format(new Date(), "yyyy-MM-dd")

  const navBtn = cn(
    "flex size-8 items-center justify-center rounded-md",
    "text-neutral-500 transition-colors",
    "hover:bg-neutral-100 hover:text-neutral-950",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
    "disabled:pointer-events-none disabled:opacity-30",
  )

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
      {/* Toolbar — same pattern as Schedule DailyBoard */}
      <div className="flex flex-col gap-3 border-b border-[var(--hairline)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="truncate text-[15px] font-medium tracking-[-0.015em] text-neutral-950 sm:text-[16px]">
              {heading}
            </h2>
            {isViewingToday ? (
              <span className="text-[12px] text-neutral-400">Today</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] tabular-nums text-neutral-400">
            <span className="text-neutral-600">{openCount}</span> open
            <span className="mx-1.5 text-neutral-300">·</span>
            <span className="text-neutral-600">{bookedCount}</span> booked
            <span className="mx-1.5 text-neutral-300">·</span>
            <span className="text-neutral-600">{generalLocks + apCount}</span>{" "}
            locked
            {apCount > 0 ? (
              <>
                <span className="mx-1.5 text-neutral-300">·</span>
                <span className="text-neutral-600">{apCount}</span> AP
              </>
            ) : null}
          </p>
        </div>

        <div
          role="group"
          aria-label="Change board date"
          className="flex shrink-0 items-center gap-0.5 self-start sm:self-center"
        >
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(-1)}
            className={navBtn}
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Choose date"
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5",
                  "text-[13px] tabular-nums text-neutral-700",
                  "transition-colors hover:bg-neutral-100 hover:text-neutral-950",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                )}
              >
                <CalendarIcon
                  className="size-3.5 shrink-0 text-neutral-400"
                  strokeWidth={1.5}
                />
                <span>{format(parseISO(activeDate), "MMM d, yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={calendarPopoverClassName}
              align="end"
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
              avoidCollisions
            >
              <Calendar
                mode="single"
                selected={parseISO(activeDate)}
                onSelect={(d) => d && setActiveDate(format(d, "yyyy-MM-dd"))}
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => go(1)}
            className={navBtn}
          >
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </button>

          {!isViewingToday ? (
            <>
              <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-neutral-200"
              />
              <button
                type="button"
                onClick={() =>
                  setActiveDate(format(new Date(), "yyyy-MM-dd"))
                }
                className={cn(
                  "h-8 rounded-md px-2.5 text-[12px] font-medium text-neutral-600",
                  "transition-colors hover:bg-neutral-100 hover:text-neutral-950",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                )}
              >
                Today
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Admin actions strip */}
      <div className="flex flex-col gap-2.5 border-b border-[var(--hairline)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] max-w-xs flex-1 sm:flex-none sm:w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter carts…"
              className="h-8 rounded-md border-neutral-200 bg-white pl-8 pr-8 text-[13px] shadow-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                aria-label="Clear"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-1 text-[12px] text-neutral-600">
            <Switch
              checked={lockedOnly}
              onCheckedChange={setLockedOnly}
              id="locked-only"
            />
            Locked only
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ToolBtn
            disabled={!!pendingKey || dayLocks.length === 0}
            loading={pendingKey === "clear-day"}
            onClick={() => void clearDayLocks()}
            tone="muted"
          >
            <Unlock className="size-3" strokeWidth={1.5} />
            Clear
          </ToolBtn>
          <button
            type="button"
            onClick={() => setBatchOpen(true)}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-neutral-600",
              "transition-colors hover:bg-neutral-100 hover:text-neutral-950",
            )}
          >
            Batch tools
          </button>
        </div>
      </div>

      {/* Period grid — fluid; scrolls only on tight viewports */}
      <div className="board-scroll">
        <div className="board-track">
          <div className="board-cols grid bg-neutral-950">
            <div className="board-sticky-label flex items-center bg-neutral-950 px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45 sm:px-5 sm:py-3">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center border-l border-white/[0.08] px-1.5 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45 sm:px-2 sm:py-3"
              >
                {p}
              </div>
            ))}
          </div>

          {carts.length === 0 ? (
            <div className="px-4 py-16 text-center sm:px-5">
              <p className="text-[13px] font-light tracking-[-0.01em] text-neutral-400">
                No carts are set up yet.
              </p>
              <p className="mt-1 text-[12px] text-neutral-300">
                Add laptop carts under Inventory.
              </p>
            </div>
          ) : visibleCarts.length === 0 ? (
            <div className="px-4 py-16 text-center sm:px-5">
              <p className="text-[13px] font-light tracking-[-0.01em] text-neutral-400">
                No carts match this filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setLockedOnly(false)
                }}
                className="mt-2 text-[12px] font-medium text-neutral-600 hover:text-neutral-950"
              >
                Clear filters
              </button>
            </div>
          ) : (
            visibleCarts.map((cart) => {
              const isMaintenanceRow = cart.status === "maintenance"
              return (
                <div
                  key={cart.id}
                  className={cn(
                    "board-cols group/row grid border-b border-[var(--hairline)] last:border-b-0",
                    isMaintenanceRow ? "bg-neutral-50/80" : "bg-white",
                  )}
                >
                  <div
                    className={cn(
                      "board-sticky-label flex items-center gap-2 border-r border-[var(--hairline)] px-3 py-2.5 sm:px-5 sm:py-3",
                      isMaintenanceRow
                        ? "bg-neutral-50/95 opacity-70"
                        : "bg-white",
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium tracking-[-0.02em] text-neutral-950">
                        {cart.name}
                      </span>
                      {isMaintenanceRow ? (
                        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                          Maintenance
                        </span>
                      ) : cart.location ? (
                        <span className="mt-0.5 block truncate text-[11px] tracking-[-0.01em] text-neutral-400">
                          {cart.location}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {PERIODS.map((period) => {
                    const key = `${cart.id}:${period}`
                    return (
                      <SlotCell
                        key={period}
                        cart={cart}
                        period={period}
                        date={activeDate}
                        maintenance={isMaintenanceRow}
                        booking={bookingMap.get(key)}
                        restriction={restrictedMap.get(key)}
                        busy={pendingKey === key}
                        onLock={(cat, reason) =>
                          void lockSlot(cart.id, period, cat, reason)
                        }
                        onUnlock={() => void unlockSlot(cart.id, period)}
                      />
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>

      <BatchToolsDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        carts={carts}
        bookings={bookings}
        slotRestrictions={slotRestrictions}
        bookingPolicy={bookingPolicy}
        activeDate={activeDate}
      />
    </section>
  )
}

/* ─── Slot cell — DailyBoard cell chrome, lock actions ─── */

function SlotCell({
  cart,
  period,
  date,
  maintenance,
  booking,
  restriction,
  busy,
  onLock,
  onUnlock,
}: {
  cart: Cart
  period: Period
  date: string
  maintenance: boolean
  booking?: Booking
  restriction?: SlotRestriction
  busy: boolean
  onLock: (category: RestrictionCategory, reason?: string) => void
  onUnlock: () => void
}) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<RestrictionCategory>("general")
  const [reason, setReason] = useState("")

  if (maintenance) {
    return (
      <div
        title="Cart paused — not bookable"
        className={cn(
          cellBase,
          "items-center justify-center bg-neutral-50 text-neutral-300",
        )}
      >
        <Wrench className="size-3.5" strokeWidth={1.25} />
      </div>
    )
  }

  if (booking) {
    const primaryLabel =
      booking.className?.trim() || booking.teacherName
    return (
      <div
        title={`${primaryLabel} · ${booking.teacherName} — manage under Reservations`}
        className={cn(
          cellBase,
          "flex-col justify-center gap-0.5 bg-neutral-50/90 px-2.5 text-left",
        )}
      >
        <span className="truncate text-[12px] font-medium leading-tight tracking-[-0.015em] text-neutral-900">
          {primaryLabel}
        </span>
        <span className="truncate text-[10.5px] leading-tight tracking-[-0.01em] text-neutral-400">
          {booking.teacherName}
        </span>
      </div>
    )
  }

  if (restriction) {
    const isAp = restriction.category === "ap_exam"
    const restrictionTitle =
      restriction.reason ||
      (isAp ? "AP exam slot" : "Restricted by admin")
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            title={`${restrictionTitle} — click to unlock`}
            className={cn(
              cellBase,
              "w-full flex-col items-center justify-center gap-1",
              "bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.03)_3px,rgba(0,0,0,0.03)_4px)]",
              "text-neutral-500",
              "hover:bg-neutral-100 hover:text-neutral-950",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/10",
              "disabled:opacity-50",
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                {isAp ? (
                  <Shield className="size-3" strokeWidth={1.25} />
                ) : (
                  <Lock className="size-3" strokeWidth={1.25} />
                )}
                <span className="text-[9px] font-medium uppercase tracking-[0.14em]">
                  {isAp ? "AP" : "Locked"}
                </span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-60 overflow-hidden rounded-lg border border-neutral-200 p-0 shadow-md"
          align="center"
        >
          <div className="border-b border-neutral-100 px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
              {isAp ? "AP exam" : "Locked"}
            </p>
            <p className="mt-0.5 text-[13px] font-medium tracking-[-0.015em] text-neutral-950">
              {cart.name} · {period}
            </p>
            {restriction.reason ? (
              <p className="mt-1.5 text-[12px] text-neutral-500">
                {restriction.reason}
              </p>
            ) : null}
          </div>
          <div className="p-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onUnlock()
                setOpen(false)
              }}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-neutral-950 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Unlock className="size-3.5" strokeWidth={1.5} />
              Unlock
            </button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCategory("general")
          setReason("")
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          title={`Lock ${cart.name} ${period}`}
          className={cn(
            cellBase,
            "group/cell w-full items-center justify-center bg-white",
            "hover:bg-neutral-950",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/15",
            "disabled:opacity-50",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin text-neutral-400" />
          ) : (
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.16em]",
                "text-neutral-300 transition-colors duration-150",
                "group-hover/cell:text-white",
              )}
            >
              Lock
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 overflow-hidden rounded-lg border border-neutral-200 p-0 shadow-md"
        align="center"
      >
        <div className="border-b border-neutral-100 px-3.5 py-3">
          <p className="text-[13px] font-medium tracking-[-0.015em] text-neutral-950">
            Lock {period}
          </p>
          <p className="mt-0.5 text-[12px] text-neutral-400">
            {cart.name} · {format(parseISO(date), "MMM d")}
          </p>
        </div>
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("general")}
              className={cn(
                "flex h-8 items-center justify-center gap-1 rounded-md border text-[12px] font-medium",
                category === "general"
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <Lock className="size-3" strokeWidth={1.5} />
              General
            </button>
            <button
              type="button"
              onClick={() => setCategory("ap_exam")}
              className={cn(
                "flex h-8 items-center justify-center gap-1 rounded-md border text-[12px] font-medium",
                category === "ap_exam"
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <Shield className="size-3" strokeWidth={1.5} />
              AP exam
            </button>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Note (optional)"
            className="h-8 rounded-md border-neutral-200 text-[12.5px] shadow-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onLock(category, reason.trim() || undefined)
              setOpen(false)
            }}
            className="flex h-8 w-full items-center justify-center rounded-md bg-neutral-950 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Apply lock
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Batch tools dialog ─── */

function BatchToolsDialog({
  open,
  onOpenChange,
  carts,
  bookings,
  slotRestrictions,
  bookingPolicy,
  activeDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
  activeDate: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"policy" | "batch">("batch")
  const [selectedCartIds, setSelectedCartIds] = useState<Set<string>>(
    () => new Set(carts.map((c) => c.id)),
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: parseISO(activeDate),
    to: parseISO(activeDate),
  }))
  const [selectedPeriods, setSelectedPeriods] = useState<Set<Period>>(
    () => new Set(PERIODS),
  )
  const [category, setCategory] = useState<RestrictionCategory>("general")
  const [reason, setReason] = useState("")
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [cartQuery, setCartQuery] = useState("")
  const [maxAdvance, setMaxAdvance] = useState(
    String(bookingPolicy.maxAdvanceDays ?? 14),
  )
  const [busy, setBusy] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      setDateRange({ from: parseISO(activeDate), to: parseISO(activeDate) })
      setMaxAdvance(String(bookingPolicy.maxAdvanceDays ?? 14))
      setSelectedCartIds(new Set(carts.map((c) => c.id)))
      setSelectedPeriods(new Set(PERIODS))
      setCategory("general")
      setReason("")
      setWeekdaysOnly(true)
      setCartQuery("")
      setTab("batch")
    }
    onOpenChange(next)
  }

  const selectedDates = useMemo(() => {
    if (!dateRange?.from) return [] as string[]
    const from = startOfDay(dateRange.from)
    const to = startOfDay(dateRange.to ?? dateRange.from)
    return eachDayOfInterval({ start: from, end: to })
      .filter((d) => {
        if (!weekdaysOnly) return true
        const day = d.getDay()
        return day !== 0 && day !== 6
      })
      .map((d) => format(d, "yyyy-MM-dd"))
  }, [dateRange, weekdaysOnly])

  const keySet = useMemo(() => {
    const keys = new Set<string>()
    for (const cartId of selectedCartIds) {
      for (const date of selectedDates) {
        for (const period of selectedPeriods) {
          keys.add(`${cartId}:${date}:${period}`)
        }
      }
    }
    return keys
  }, [selectedCartIds, selectedDates, selectedPeriods])

  const bookedHits = bookings.filter((b) =>
    keySet.has(`${b.cartId}:${b.date}:${b.period}`),
  ).length
  const alreadyLocked = slotRestrictions.filter((r) =>
    keySet.has(`${r.cartId}:${r.date}:${r.period}`),
  ).length
  const newLocks = Math.max(0, keySet.size - bookedHits - alreadyLocked)

  const canApply =
    !busy &&
    selectedCartIds.size > 0 &&
    selectedPeriods.size > 0 &&
    selectedDates.length > 0

  async function apply(action: "restrict" | "available") {
    if (!dateRange?.from || !canApply) return
    setBusy(true)
    try {
      const res = await batchRestrictSlots(
        Array.from(selectedCartIds),
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to ?? dateRange.from, "yyyy-MM-dd"),
        Array.from(selectedPeriods),
        action,
        {
          category,
          reason: reason.trim() || undefined,
          weekdaysOnly,
        },
      )
      if (!res.ok) {
        toast({
          title: "Batch failed",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: action === "restrict" ? "Locks applied" : "Locks released",
        description:
          action === "restrict"
            ? `${res.data?.restrictedCount ?? 0} locked · ${res.data?.skippedBookedCount ?? 0} booked skipped`
            : undefined,
      })
      router.refresh()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  async function savePolicy() {
    const n = Number(maxAdvance)
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      toast({
        title: "Invalid window",
        description: "Use a whole number from 1–60 days.",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      const res = await updateBookingPolicy({ maxAdvanceDays: n })
      if (!res.ok) {
        toast({
          title: "Could not save booking window",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Booking window updated",
        description: `${n} day${n === 1 ? "" : "s"} ahead`,
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const filteredCarts = carts.filter((c) =>
    c.name.toLowerCase().includes(cartQuery.trim().toLowerCase()),
  )

  const dateSummary = dateRange?.from
    ? dateRange.to &&
      format(dateRange.from, "yyyy-MM-dd") !==
        format(dateRange.to, "yyyy-MM-dd")
      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
      : format(dateRange.from, "MMM d, yyyy")
    : "Select dates"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border border-black/[0.08] bg-white p-0",
          "rounded-[20px] shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_16px_70px_-12px_rgba(0,0,0,0.2)]",
          "sm:max-w-[56rem]",
        )}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-3.5 sm:px-6">
          <DialogHeader className="min-w-0 gap-0 space-y-0 text-left">
            <DialogTitle className="text-[14px] font-medium tracking-[-0.02em] text-neutral-950">
              Batch tools
            </DialogTitle>
            <DialogDescription className="sr-only">
              Lock or release many cart periods. Booked slots are never
              overwritten.
            </DialogDescription>
          </DialogHeader>

          <div
            className="inline-flex shrink-0 rounded-lg bg-neutral-100/90 p-0.5"
            role="tablist"
            aria-label="Mode"
          >
            {(
              [
                { id: "batch" as const, label: "Locks" },
                { id: "policy" as const, label: "Window" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-7 rounded-md px-3 text-[12px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-150",
                  tab === t.id
                    ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "policy" ? (
          <div className="px-5 py-8 sm:px-8">
            <div className="mx-auto flex max-w-lg flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium tracking-[-0.015em] text-neutral-950">
                  Booking window
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                  How many days ahead teachers can reserve carts.
                </p>
                <div className="mt-5 flex items-baseline gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={maxAdvance}
                    onChange={(e) => setMaxAdvance(e.target.value)}
                    className="h-10 w-[4.5rem] rounded-lg border-neutral-200 text-center text-[15px] font-medium tabular-nums tracking-tight shadow-none focus-visible:ring-neutral-900/10"
                  />
                  <span className="text-[13px] text-neutral-500">days</span>
                </div>
              </div>
              <Button
                type="button"
                className="h-9 shrink-0 rounded-lg px-4 text-[13px] font-medium"
                disabled={busy}
                onClick={() => void savePolicy()}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Workspace: 3 equal panes, hairline dividers */}
            <div className="grid min-h-[20rem] sm:grid-cols-[1fr_1px_1fr_1px_1.15fr]">
              {/* Scope */}
              <div className="flex flex-col px-5 py-5 sm:px-6">
                <PaneLabel>Scope</PaneLabel>
                <div className="mt-4 space-y-5">
                  <div>
                    <FieldLabel>Lock type</FieldLabel>
                    <div className="mt-2 flex rounded-lg border border-neutral-200 p-0.5">
                      {(
                        [
                          {
                            id: "general" as const,
                            label: "General",
                            icon: Lock,
                          },
                          {
                            id: "ap_exam" as const,
                            label: "AP exam",
                            icon: Shield,
                          },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon
                        const active = category === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCategory(opt.id)}
                            className={cn(
                              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium tracking-[-0.01em] transition-colors",
                              active
                                ? "bg-neutral-950 text-white"
                                : "text-neutral-500 hover:text-neutral-900",
                            )}
                          >
                            <Icon className="size-3.5" strokeWidth={1.5} />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Dates</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "mt-2 flex h-9 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-left",
                            "text-[13px] tracking-[-0.01em] text-neutral-900",
                            "transition-colors hover:border-neutral-300",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                          )}
                        >
                          <CalendarIcon
                            className="size-3.5 shrink-0 text-neutral-400"
                            strokeWidth={1.5}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {dateSummary}
                          </span>
                          <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                            {selectedDates.length}d
                          </span>
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
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={1}
                        />
                      </PopoverContent>
                    </Popover>
                    <label className="mt-3 flex cursor-pointer items-center justify-between gap-3">
                      <span className="text-[13px] text-neutral-600">
                        Skip weekends
                      </span>
                      <Switch
                        checked={weekdaysOnly}
                        onCheckedChange={setWeekdaysOnly}
                      />
                    </label>
                  </div>

                  <div>
                    <FieldLabel>Note</FieldLabel>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Optional"
                      className="mt-2 h-9 rounded-lg border-neutral-200 text-[13px] shadow-none placeholder:text-neutral-400 focus-visible:ring-neutral-900/10"
                    />
                  </div>
                </div>
              </div>

              <div
                aria-hidden
                className="hidden bg-black/[0.06] sm:block"
              />

              {/* Periods */}
              <div className="flex flex-col border-t border-black/[0.06] px-5 py-5 sm:border-t-0 sm:px-6">
                <div className="flex items-center justify-between">
                  <PaneLabel>Periods</PaneLabel>
                  <div className="flex items-center gap-2.5">
                    <TextLink
                      onClick={() => setSelectedPeriods(new Set(PERIODS))}
                    >
                      All
                    </TextLink>
                    <TextLink onClick={() => setSelectedPeriods(new Set())}>
                      Clear
                    </TextLink>
                  </div>
                </div>
                <div className="mt-4 flex flex-1 flex-col gap-1">
                  {PERIODS.map((p) => {
                    const on = selectedPeriods.has(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const next = new Set(selectedPeriods)
                          if (on) next.delete(p)
                          else next.add(p)
                          setSelectedPeriods(next)
                        }}
                        className={cn(
                          "group flex h-9 items-center justify-between rounded-lg px-2.5 text-left transition-colors",
                          on
                            ? "bg-neutral-950 text-white"
                            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
                        )}
                      >
                        <span className="text-[13px] font-medium tracking-[-0.01em]">
                          {p}
                        </span>
                        <span
                          className={cn(
                            "size-3.5 rounded-[4px] border transition-colors",
                            on
                              ? "border-white bg-white"
                              : "border-neutral-300 group-hover:border-neutral-400",
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div
                aria-hidden
                className="hidden bg-black/[0.06] sm:block"
              />

              {/* Carts */}
              <div className="flex min-h-0 flex-col border-t border-black/[0.06] px-5 py-5 sm:border-t-0 sm:px-6">
                <div className="flex items-center justify-between">
                  <PaneLabel>Carts</PaneLabel>
                  <div className="flex items-center gap-2.5">
                    <TextLink
                      onClick={() =>
                        setSelectedCartIds(new Set(carts.map((c) => c.id)))
                      }
                    >
                      All
                    </TextLink>
                    <TextLink onClick={() => setSelectedCartIds(new Set())}>
                      Clear
                    </TextLink>
                  </div>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={cartQuery}
                    onChange={(e) => setCartQuery(e.target.value)}
                    placeholder="Filter…"
                    className="h-8 rounded-lg border-neutral-200 bg-transparent pl-8 text-[13px] shadow-none placeholder:text-neutral-400 focus-visible:ring-neutral-900/10"
                  />
                </div>
                <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                  {filteredCarts.length === 0 ? (
                    <p className="py-8 text-center text-[12.5px] text-neutral-400">
                      No matches
                    </p>
                  ) : (
                    filteredCarts.map((cart) => {
                      const on = selectedCartIds.has(cart.id)
                      return (
                        <button
                          key={cart.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedCartIds)
                            if (on) next.delete(cart.id)
                            else next.add(cart.id)
                            setSelectedCartIds(next)
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                            on
                              ? "bg-neutral-50"
                              : "hover:bg-neutral-50/80",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                              on
                                ? "border-neutral-950 bg-neutral-950"
                                : "border-neutral-300",
                            )}
                          >
                            {on ? (
                              <svg
                                viewBox="0 0 10 10"
                                className="size-2 text-white"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M2 5.2 4.1 7.2 8 2.8"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[13px] tracking-[-0.01em]",
                              on
                                ? "font-medium text-neutral-950"
                                : "text-neutral-600",
                            )}
                          >
                            {cart.name}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                <p className="mt-3 text-[11.5px] tabular-nums text-neutral-400">
                  {selectedCartIds.size} selected
                </p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex flex-col gap-3 border-t border-black/[0.06] bg-neutral-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[12.5px] tabular-nums tracking-[-0.01em] text-neutral-500">
                <span className="font-medium text-neutral-900">
                  {newLocks}
                </span>{" "}
                new
                <span className="mx-1.5 text-neutral-300">·</span>
                <span className="font-medium text-neutral-900">
                  {bookedHits}
                </span>{" "}
                booked skip
                <span className="mx-1.5 text-neutral-300">·</span>
                <span className="font-medium text-neutral-900">
                  {keySet.size}
                </span>{" "}
                total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                  disabled={!canApply}
                  onClick={() => void apply("available")}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Release
                </Button>
                <Button
                  type="button"
                  className="h-8 rounded-lg px-3.5 text-[12.5px] font-medium"
                  disabled={!canApply}
                  onClick={() => void apply("restrict")}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Apply locks
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaneLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-[-0.01em] text-neutral-400">
      {children}
    </p>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-medium tracking-[-0.01em] text-neutral-700">
      {children}
    </p>
  )
}

function TextLink({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11.5px] font-medium tracking-[-0.01em] text-neutral-400 transition-colors hover:text-neutral-950"
    >
      {children}
    </button>
  )
}

function ToolBtn({
  children,
  onClick,
  disabled,
  loading,
  tone = "default",
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  tone?: "default" | "amber" | "muted"
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-40",
        tone === "amber" &&
          "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
        tone === "muted" &&
          "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
        tone === "default" &&
          "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
      )}
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : null}
      {children}
    </button>
  )
}


