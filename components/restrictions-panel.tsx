"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
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

/**
 * Admin restrictions — lock/unlock cart periods.
 * Bookings are shown read-only (manage them under Reservations).
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
        title: category === "ap_exam" ? "AP locked" : "Locked",
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
          title: "Could not unlock",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Unlocked" })
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
      toast({ title: "Cleared" })
      refresh()
    } finally {
      setPendingKey(null)
    }
  }

  async function lockFullDay(category: RestrictionCategory) {
    setPendingKey(`day:${category}`)
    try {
      const res = await batchRestrictSlots(
        carts.map((c) => c.id),
        activeDate,
        activeDate,
        PERIODS,
        "restrict",
        {
          category,
          reason:
            category === "ap_exam"
              ? "Reserved for AP exam bookings."
              : `School day lock · ${format(parseISO(activeDate), "MMM d")}`,
        },
      )
      if (!res.ok) {
        toast({
          title: "Could not lock day",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      const data = res.data
      toast({
        title: category === "ap_exam" ? "AP day locked" : "Day locked",
        description: `${data?.restrictedCount ?? 0} locked${
          data?.skippedBookedCount ? ` · ${data.skippedBookedCount} skipped` : ""
        }`,
      })
      refresh()
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => go(-1)}
              className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-900"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-900 hover:border-neutral-300"
                >
                  <CalendarIcon className="size-3.5 text-neutral-400" strokeWidth={1.5} />
                  {format(parseISO(activeDate), "EEE, MMM d")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
              className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-900"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => setActiveDate(format(new Date(), "yyyy-MM-dd"))}
              className="h-9 rounded-lg bg-neutral-950 px-3 text-[12px] font-medium text-white hover:opacity-90"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[10rem] flex-1 sm:flex-none sm:w-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter carts…"
                className="h-9 rounded-lg border-neutral-200 pl-8 pr-8 text-[13px]"
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

            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] text-neutral-600">
              <Switch
                checked={lockedOnly}
                onCheckedChange={setLockedOnly}
                id="locked-only"
              />
              Locked only
            </label>

            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 text-[12.5px]"
              onClick={() => setBatchOpen(true)}
            >
              Batch tools
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] tabular-nums text-neutral-400">
            <span className="text-neutral-600">{openCount}</span> open
            <span className="mx-1.5 text-neutral-300">·</span>
            <span className="text-neutral-600">{bookedCount}</span> booked
            <span className="mx-1.5 text-neutral-300">·</span>
            <span className="text-slate-700">{generalLocks}</span> locked
            <span className="mx-1.5 text-neutral-300">·</span>
            <span className="text-amber-700">{apCount}</span> AP
          </p>

          <div className="flex flex-wrap gap-1.5">
            <ToolBtn
              disabled={!!pendingKey || carts.length === 0}
              loading={pendingKey === "day:general"}
              onClick={() => void lockFullDay("general")}
            >
              <Lock className="size-3" />
              Lock day
            </ToolBtn>
            <ToolBtn
              disabled={!!pendingKey || carts.length === 0}
              loading={pendingKey === "day:ap_exam"}
              onClick={() => void lockFullDay("ap_exam")}
              tone="amber"
            >
              <Shield className="size-3" />
              AP day
            </ToolBtn>
            <ToolBtn
              disabled={!!pendingKey || dayLocks.length === 0}
              loading={pendingKey === "clear-day"}
              onClick={() => void clearDayLocks()}
              tone="muted"
            >
              <Unlock className="size-3" />
              Clear locks
            </ToolBtn>
          </div>
        </div>

        <p className="text-[11.5px] text-neutral-400">
          Lock open cells. Booked slots: use Reservations.
        </p>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[48rem]">
            <div
              className="grid border-b border-neutral-800 bg-neutral-950"
              style={{
                gridTemplateColumns: "minmax(8.5rem, 1fr) repeat(5, minmax(0, 1fr))",
              }}
            >
              <div className="type-label flex items-center px-4 py-2.5 text-white/65">
                Cart
              </div>
              {PERIODS.map((p) => (
                <div
                  key={p}
                  className="type-label flex items-center justify-center border-l border-white/10 px-2 py-2.5 text-white/65"
                >
                  {p}
                </div>
              ))}
            </div>

            {visibleCarts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[13px] font-medium text-neutral-800">
                  No carts
                </p>
                <p className="mt-1 text-[12.5px] text-neutral-400">
                  {query.trim()
                    ? `No match for “${query.trim()}”.`
                    : "Turn off Locked only."}
                </p>
              </div>
            ) : (
              visibleCarts.map((cart) => {
                const maintenance = cart.status === "maintenance"
                return (
                  <div
                    key={cart.id}
                    className={cn(
                      "grid border-b border-neutral-100 last:border-b-0",
                      maintenance && "bg-amber-50/30",
                    )}
                    style={{
                      gridTemplateColumns:
                        "minmax(8.5rem, 1fr) repeat(5, minmax(0, 1fr))",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2 border-r border-neutral-100 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-neutral-950">
                          {cart.name}
                        </p>
                        {maintenance ? (
                          <p className="text-[11px] text-amber-700">Maintenance</p>
                        ) : cart.location ? (
                          <p className="truncate text-[11px] text-neutral-400">
                            {cart.location}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {PERIODS.map((period) => {
                      const key = `${cart.id}:${period}`
                      const restriction = restrictedMap.get(key)
                      const booking = bookingMap.get(key)
                      const busy = pendingKey === key

                      return (
                        <div
                          key={period}
                          className="flex min-h-12 items-center justify-center border-l border-neutral-100 p-1.5"
                        >
                          <SlotCell
                            cart={cart}
                            period={period}
                            date={activeDate}
                            maintenance={maintenance}
                            booking={booking}
                            restriction={restriction}
                            busy={busy}
                            onLock={(cat, reason) =>
                              void lockSlot(cart.id, period, cat, reason)
                            }
                            onUnlock={() => void unlockSlot(cart.id, period)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-neutral-500">
        <Legend swatch="border border-dashed border-neutral-200 bg-white" label="Open · click to lock" />
        <Legend swatch="bg-neutral-100" label="Booked (view only)" />
        <Legend swatch="bg-slate-100" label="Locked" />
        <Legend swatch="bg-amber-100" label="AP exam" />
        <Legend swatch="bg-amber-50" label="Maintenance" />
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

/* ─── Slot cell (restriction only — no booking cancel) ─── */

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
        title="Cart under maintenance"
        className="flex h-10 w-full items-center justify-center rounded-md bg-amber-50 text-amber-700"
      >
        <Wrench className="size-3.5" strokeWidth={1.5} />
      </div>
    )
  }

  if (booking) {
    return (
      <div
        title={`${booking.teacherName}${booking.className ? ` · ${booking.className}` : ""} — manage under Reservations`}
        className="flex h-10 w-full flex-col items-center justify-center rounded-md bg-neutral-100 px-1 text-center"
      >
        <span className="truncate max-w-full text-[10.5px] font-medium text-neutral-700">
          Booked
        </span>
        <span className="truncate max-w-full text-[9.5px] text-neutral-400">
          {booking.teacherName.split(" ").pop()}
        </span>
      </div>
    )
  }

  if (restriction) {
    const isAp = restriction.category === "ap_exam"
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            title={
              restriction.reason ||
              (isAp ? "AP exam lock" : "Locked")
            }
            className={cn(
              "flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50",
              isAp
                ? "bg-amber-50 text-amber-800 hover:bg-amber-100/80"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200/70",
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                {isAp ? (
                  <Shield className="size-3" strokeWidth={1.75} />
                ) : (
                  <Lock className="size-3" strokeWidth={1.75} />
                )}
                <span>{isAp ? "AP" : "Lock"}</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 rounded-xl border-neutral-200 p-0" align="center">
          <div className="border-b border-neutral-100 px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {isAp ? "AP exam lock" : "Locked slot"}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-neutral-950">
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
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-950 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Unlock className="size-3.5" />
              Unlock slot
            </button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Open slot — lock
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
          className="group flex h-10 w-full items-center justify-center rounded-md border border-dashed border-neutral-200 text-neutral-400 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
          title={`Lock ${cart.name} ${period}`}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-0 transition-opacity group-hover:opacity-100">
              Lock
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl border-neutral-200 p-0" align="center">
        <div className="border-b border-neutral-100 px-3.5 py-3">
          <p className="text-[13px] font-semibold text-neutral-950">
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
                "flex h-8 items-center justify-center gap-1 rounded-md border text-[11.5px] font-medium",
                category === "general"
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <Lock className="size-3" />
              General
            </button>
            <button
              type="button"
              onClick={() => setCategory("ap_exam")}
              className={cn(
                "flex h-8 items-center justify-center gap-1 rounded-md border text-[11.5px] font-medium",
                category === "ap_exam"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <Shield className="size-3" />
              AP exam
            </button>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Note (optional)"
            className="h-8 rounded-md text-[12.5px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onLock(category, reason.trim() || undefined)
              setOpen(false)
            }}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50",
              category === "ap_exam"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-neutral-950 hover:opacity-90",
            )}
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

  useEffect(() => {
    if (!open) return
    setDateRange({ from: parseISO(activeDate), to: parseISO(activeDate) })
    setMaxAdvance(String(bookingPolicy.maxAdvanceDays ?? 14))
  }, [open, activeDate, bookingPolicy.maxAdvanceDays])

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
    if (!Number.isInteger(n) || n < 0 || n > 120) {
      toast({
        title: "Invalid window",
        description: "Use a whole number from 0–120 days.",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      const res = await updateBookingPolicy(n)
      if (!res.ok) {
        toast({
          title: "Could not save",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Window updated",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-neutral-100 px-5 py-4 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            Batch tools
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Lock or release many slots. Booked ones are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-neutral-100 px-3 pt-2">
          {(
            [
              { id: "batch" as const, label: "Batch locks" },
              { id: "policy" as const, label: "Booking window" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-medium",
                tab === t.id
                  ? "bg-neutral-100 text-neutral-950"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "policy" ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-[12.5px] text-neutral-500">
              How far ahead teachers can book.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={120}
                value={maxAdvance}
                onChange={(e) => setMaxAdvance(e.target.value)}
                className="h-9 w-20 rounded-lg text-center text-[13px]"
              />
              <span className="text-[13px] text-neutral-600">days ahead</span>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="h-9 rounded-lg"
                disabled={busy}
                onClick={() => void savePolicy()}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("general")}
                className={cn(
                  "h-8 rounded-md border text-[12px] font-medium",
                  category === "general"
                    ? "border-neutral-900 bg-neutral-950 text-white"
                    : "border-neutral-200 text-neutral-600",
                )}
              >
                General lock
              </button>
              <button
                type="button"
                onClick={() => setCategory("ap_exam")}
                className={cn(
                  "h-8 rounded-md border text-[12px] font-medium",
                  category === "ap_exam"
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-neutral-200 text-neutral-600",
                )}
              >
                AP exam lock
              </button>
            </div>

            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Note (optional)"
              className="h-9 rounded-lg text-[13px]"
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-neutral-700">
                  Carts ({selectedCartIds.size})
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    onClick={() =>
                      setSelectedCartIds(new Set(carts.map((c) => c.id)))
                    }
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    onClick={() => setSelectedCartIds(new Set())}
                  >
                    None
                  </button>
                </div>
              </div>
              <Input
                value={cartQuery}
                onChange={(e) => setCartQuery(e.target.value)}
                placeholder="Search carts…"
                className="mb-1.5 h-8 rounded-md text-[12.5px]"
              />
              <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-neutral-200 p-1">
                {filteredCarts.map((cart) => {
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
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]",
                        on ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50",
                      )}
                    >
                      <Checkbox checked={on} className="size-3.5" />
                      {cart.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-neutral-700">
                Date range
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-neutral-200 px-3 text-left text-[12.5px] text-neutral-800"
                  >
                    <CalendarIcon className="size-3.5 text-neutral-400" />
                    {dateRange?.from
                      ? dateRange.to
                        ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                        : format(dateRange.from, "MMM d, yyyy")
                      : "Select dates"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
              <label className="mt-2 flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-[12.5px]">
                Skip weekends
                <Switch checked={weekdaysOnly} onCheckedChange={setWeekdaysOnly} />
              </label>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-neutral-700">
                  Periods
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    onClick={() => setSelectedPeriods(new Set(PERIODS))}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    onClick={() => setSelectedPeriods(new Set())}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
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
                        "h-8 rounded-md border text-[12px] font-semibold",
                        on
                          ? "border-neutral-900 bg-neutral-950 text-white"
                          : "border-neutral-200 text-neutral-500",
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 text-[12px]">
              <Row label="Slots in scope" value={String(keySet.size)} />
              <Row label="Already booked" value={String(bookedHits)} />
              <Row label="Already locked" value={String(alreadyLocked)} />
              <div className="mt-1.5 border-t border-neutral-200 pt-1.5">
                <Row label="New locks" value={String(newLocks)} strong />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1 rounded-lg"
                disabled={!canApply}
                onClick={() => void apply("available")}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
                Release
              </Button>
              <Button
                type="button"
                className={cn(
                  "h-9 flex-1 rounded-lg",
                  category === "ap_exam" && "bg-amber-600 hover:bg-amber-700",
                )}
                disabled={!canApply}
                onClick={() => void apply("restrict")}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Lock className="size-3.5" />
                )}
                Apply locks
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ToolBtn({
  children,
  onClick,
  disabled,
  loading,
  tone = "default",
}: {
  children: React.ReactNode
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
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors disabled:opacity-40",
        tone === "amber" &&
          "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
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

function Legend({
  swatch,
  label,
}: {
  swatch: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", swatch)} />
      {label}
    </span>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-neutral-500">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "font-semibold text-neutral-900" : "font-medium text-neutral-700",
        )}
      >
        {value}
      </span>
    </div>
  )
}
