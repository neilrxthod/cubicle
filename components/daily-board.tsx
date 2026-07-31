"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { format, parseISO, addDays } from "date-fns"
import type { Booking, BookingPolicy, Cart, Period, SessionUser, SlotRestriction } from "@/lib/types"
import {
  getSkHoliday,
  getSkHolidayDatesAround,
  isSkHoliday,
  skipSkHolidays,
} from "@/lib/calendar/sk-holidays"

const BookDialog = dynamic(() => import("./book-dialog").then((mod) => mod.BookDialog), {
  ssr: false,
})
const IssueDialog = dynamic(() => import("./issue-dialog").then((mod) => mod.IssueDialog), {
  ssr: false,
})
const SwapRequestDialog = dynamic(
  () => import("./swap-request-dialog").then((mod) => mod.SwapRequestDialog),
  { ssr: false }
)
const ManageBookingDialog = dynamic(
  () => import("./manage-booking-dialog").then((mod) => mod.ManageBookingDialog),
  { ssr: false }
)

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Wrench, AlertTriangle, Lock } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePlatformStore } from "@/lib/data/platform-store"
import { isVerifiedStaff } from "@/lib/staff/employment"
import { VerifiedBadge } from "@/components/verified-badge"


const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

const GRID_COLS = "minmax(10rem, 1.15fr) repeat(5, minmax(0, 1fr))"

const cellBase =
  "flex min-h-12 min-w-0 border-l border-[var(--hairline)] transition-colors duration-150 ease-out"

export function DailyBoard({
  session,
  carts,
  bookings,
  slotRestrictions,
  bookingPolicy,
  date,
}: {
  session: SessionUser
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
  date: string
}) {
  const router = useRouter()
  const platform = usePlatformStore()
  const verifiedByTeacherId = (() => {
    const map = new Map<string, boolean>()
    for (const user of platform.users) {
      map.set(user.id, isVerifiedStaff(user))
    }
    return map
  })()

  const [bookDialog, setBookDialog] = useState<{ cart: Cart; period: Period } | null>(null)
  const [issueDialog, setIssueDialog] = useState<Cart | null>(null)
  const [swapDialog, setSwapDialog] = useState<Booking | null>(null)
  const [manageDialog, setManageDialog] = useState<Booking | null>(null)

  const bookingsForDate = bookings.filter((b) => b.date === date)
  const bookingMap = new Map<string, Booking>()
  for (const b of bookingsForDate) bookingMap.set(`${b.cartId}:${b.period}`, b)
  const restrictionMap = new Map<string, SlotRestriction>()
  for (const restriction of slotRestrictions) {
    if (restriction.date === date) {
      restrictionMap.set(`${restriction.cartId}:${restriction.period}`, restriction)
    }
  }

  const today = format(new Date(), "yyyy-MM-dd")
  const maxAdvanceDays = Math.max(0, bookingPolicy.maxAdvanceDays ?? 14)
  const lastBookableDate = format(addDays(new Date(), maxAdvanceDays), "yyyy-MM-dd")
  const isTeacherWindowEnforced = session.role !== "admin"
  const isBeyondAdvanceWindow = isTeacherWindowEnforced && date > lastBookableDate
  const isPastDate = isTeacherWindowEnforced && date < today
  const isHolidayDate = isSkHoliday(date)
  const canBookOpenSlots = !isPastDate && !isBeyondAdvanceWindow && !isHolidayDate

  const skHolidayDates = useMemo(
    () => getSkHolidayDatesAround(parseISO(date), 2),
    [date],
  )
  const boardHoliday = getSkHoliday(date)

  function setDate(next: string) {
    const holiday = getSkHoliday(next)
    if (holiday) {
      toast({
        title: holiday.name,
        description:
          "Statutory holiday (Regina, SK). Cart booking is unavailable.",
        variant: "destructive",
      })
      return
    }
    if (isTeacherWindowEnforced && next > lastBookableDate) {
      toast({
        title: "Outside booking window",
        description: `Max ${maxAdvanceDays} day${maxAdvanceDays === 1 ? "" : "s"} ahead.`,
        variant: "destructive",
      })
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set("date", next)
    router.push(url.pathname + url.search, { scroll: false })
  }

  function go(offsetDays: number) {
    const dir = offsetDays >= 0 ? 1 : -1
    let next = format(addDays(parseISO(date), offsetDays), "yyyy-MM-dd")
    if (isSkHoliday(next)) {
      next = skipSkHolidays(date, dir, (ymd) =>
        isTeacherWindowEnforced ? ymd > lastBookableDate : false,
      )
    }
    setDate(next)
  }

  function onCellClick(cart: Cart, period: Period) {
    if (cart.status === "maintenance") return

    const existing = bookingMap.get(`${cart.id}:${period}`)
    if (existing) {
      if (existing.teacherId === session.id || session.role === "admin") {
        setManageDialog(existing)
        return
      }
      setSwapDialog(existing)
      return
    }

    const holiday = getSkHoliday(date)
    if (holiday) {
      toast({
        title: holiday.name,
        description: "Statutory holiday (Regina, SK). Cart booking is unavailable.",
        variant: "destructive",
      })
      return
    }

    if (isTeacherWindowEnforced && date > lastBookableDate) {
      toast({
        title: "Outside booking window",
        description: `Max ${maxAdvanceDays} day${maxAdvanceDays === 1 ? "" : "s"} ahead.`,
        variant: "destructive",
      })
      return
    }
    if (isTeacherWindowEnforced && date < today) {
      toast({
        title: "Past date",
        description: "Cannot book past dates.",
        variant: "destructive",
      })
      return
    }
    const restriction = restrictionMap.get(`${cart.id}:${period}`)
    if (restriction && session.role !== "admin") {
      toast({
        title: restriction.category === "ap_exam" ? "AP exam" : "Restricted",
        description:
          restriction.category === "ap_exam"
            ? "Reserved for AP exams."
            : restriction.reason ?? "Locked by admin.",
        variant: "destructive",
      })
      return
    }
    setBookDialog({ cart, period })
  }

  const heading = format(parseISO(date), "EEEE, MMM d")
  const isViewingToday = date === today
  const managedCart = manageDialog
    ? carts.find((c) => c.id === manageDialog.cartId)
    : undefined

  const navBtn = cn(
    "flex size-8 items-center justify-center rounded-md",
    "text-neutral-500 transition-colors",
    "hover:bg-neutral-100 hover:text-neutral-950",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
    "disabled:pointer-events-none disabled:opacity-30",
  )

  const legendItem =
    "inline-flex items-center gap-1.5 text-[11px] text-neutral-500"

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
      {/* ── Toolbar: date identity + day controls ── */}
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
          {session.role !== "admin" && date >= today ? (
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Booking window through{" "}
              {format(parseISO(lastBookableDate), "MMM d")}
            </p>
          ) : null}
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
                <span>{format(parseISO(date), "MMM d, yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden rounded-lg border border-neutral-200 p-0 shadow-md"
              align="end"
            >
              <Calendar
                mode="single"
                selected={parseISO(date)}
                onSelect={(val) => {
                  if (!val) return
                  setDate(format(val, "yyyy-MM-dd"))
                }}
                modifiers={{
                  holiday: skHolidayDates,
                }}
                modifiersClassNames={{
                  holiday:
                    "bg-neutral-100 text-neutral-400 opacity-100 hover:bg-neutral-100 hover:text-neutral-400",
                }}
                disabled={(day) => {
                  if (isSkHoliday(day)) return true
                  if (
                    isTeacherWindowEnforced &&
                    format(day, "yyyy-MM-dd") > lastBookableDate
                  ) {
                    return true
                  }
                  return false
                }}
                components={{
                  DayContent: ({ date: dayDate, activeModifiers }) => {
                    const holiday = getSkHoliday(dayDate)
                    if (holiday || activeModifiers.holiday) {
                      return (
                        <span
                          className="relative flex h-8 w-8 items-center justify-center"
                          title={
                            holiday
                              ? `${holiday.name} — unavailable`
                              : "Statutory holiday — unavailable"
                          }
                        >
                          <span className="text-[12px] tabular-nums text-neutral-400">
                            {format(dayDate, "d")}
                          </span>
                          <span
                            aria-hidden
                            className="absolute bottom-1 left-1/2 size-0.5 -translate-x-1/2 rounded-full bg-neutral-400"
                          />
                        </span>
                      )
                    }
                    return (
                      <span className="flex h-8 w-8 items-center justify-center text-[12px] tabular-nums">
                        {format(dayDate, "d")}
                      </span>
                    )
                  },
                }}
              />
              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span
                    aria-hidden
                    className="relative flex size-5 items-center justify-center rounded-sm bg-neutral-100"
                  >
                    <span className="text-[9px] tabular-nums text-neutral-400">
                      1
                    </span>
                    <span className="absolute bottom-0.5 left-1/2 size-0.5 -translate-x-1/2 rounded-full bg-neutral-400" />
                  </span>
                  <span>Holiday</span>
                </div>
                <p className="text-[10.5px] text-neutral-400">
                  Regina, SK · booking closed
                </p>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => go(1)}
            disabled={isTeacherWindowEnforced && date >= lastBookableDate}
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
                onClick={() => setDate(today)}
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

      {boardHoliday ? (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-neutral-900">
              {boardHoliday.name}
            </p>
            <p className="text-[11.5px] text-neutral-500">
              Statutory holiday · Regina, SK · cart booking unavailable
            </p>
          </div>
          <span className="shrink-0 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">
            Closed
          </span>
        </div>
      ) : null}

      {/* ── Legend strip: aligned with toolbar padding ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--hairline)] bg-neutral-50/80 px-4 py-2 sm:px-5">
        <span className={legendItem}>
          <span className="size-2 shrink-0 rounded-[1px] border border-neutral-300 bg-white" />
          Open
        </span>
        <span className={legendItem}>
          <span className="size-2 shrink-0 rounded-[1px] bg-neutral-950" />
          Yours
        </span>
        <span className={legendItem}>
          <span className="size-2 shrink-0 rounded-[1px] bg-neutral-200" />
          Booked
        </span>
        <span className={legendItem}>
          <Lock className="size-2.5 shrink-0 text-neutral-400" strokeWidth={1.5} />
          Restricted
        </span>
        <span className={legendItem}>
          <Wrench className="size-2.5 shrink-0 text-neutral-400" strokeWidth={1.5} />
          Maintenance
        </span>
      </div>

      {/* ── Period grid ── */}
      <div className="overflow-x-auto">
        <div className="min-w-[54rem]">
          <div
            className="grid bg-neutral-950"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div className="flex items-center px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45 sm:px-5">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center border-l border-white/[0.08] px-2 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45"
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
                Ask an admin to add laptop carts.
              </p>
            </div>
          ) : null}

            {carts.map((cart) => {
              const isMaintenanceRow = cart.status === "maintenance"
              return (
                <div
                  key={cart.id}
                  className={cn(
                    "group/row grid border-b border-[var(--hairline)] last:border-b-0",
                    isMaintenanceRow ? "bg-neutral-50/80" : "bg-white",
                  )}
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 border-r border-[var(--hairline)] px-4 py-3 sm:px-5",
                      isMaintenanceRow && "opacity-70",
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
                    <button
                      type="button"
                      aria-label={`Report issue on ${cart.name}`}
                      title="Report issue"
                      onClick={() => setIssueDialog(cart)}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        "text-red-600 transition-colors duration-150",
                        "hover:bg-red-50 hover:text-red-700",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/25",
                      )}
                    >
                      <AlertTriangle className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>

                  {PERIODS.map((period) => {
                    const booking = bookingMap.get(`${cart.id}:${period}`)
                    const restriction = restrictionMap.get(`${cart.id}:${period}`)
                    const isMine = booking?.teacherId === session.id
                    const isMaintenance = cart.status === "maintenance"
                    const isRestricted = !!restriction
                    const restrictionTitle =
                      restriction?.category === "ap_exam"
                        ? "AP exam slot"
                        : restriction?.reason || "Restricted by admin"

                    if (isMaintenance) {
                      return (
                        <div
                          key={period}
                          title="Cart under maintenance — unavailable"
                          className={cn(
                            cellBase,
                            "items-center justify-center bg-neutral-50 text-neutral-300",
                          )}
                        >
                          <Wrench className="size-3.5" strokeWidth={1.25} />
                        </div>
                      )
                    }

                    if (booking && isMine) {
                      const primaryLabel = booking.className?.trim() || "Yours"
                      const verified = verifiedByTeacherId.get(booking.teacherId)
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => onCellClick(cart, period)}
                          title={`${primaryLabel} — click to manage or cancel`}
                          className={cn(
                            cellBase,
                            "items-center gap-1.5 border-l-neutral-900 bg-neutral-950 px-2 text-left text-white sm:px-2.5",
                            "hover:bg-neutral-800",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25",
                          )}
                        >
                          <span className="truncate text-[12px] font-medium leading-tight tracking-[-0.015em]">
                            {primaryLabel}
                          </span>
                          {verified ? (
                            <VerifiedBadge
                              size="xs"
                              className="shrink-0 text-white/70"
                              title="Verified permanent staff"
                            />
                          ) : null}
                        </button>
                      )
                    }

                    if (booking) {
                      const primaryLabel =
                        booking.className?.trim() || booking.teacherName
                      const verified = verifiedByTeacherId.get(booking.teacherId)
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => onCellClick(cart, period)}
                          title={`${primaryLabel} · ${booking.teacherName}${verified ? " · verified permanent" : ""} — click to request swap`}
                          className={cn(
                            cellBase,
                            "flex-col justify-center gap-0.5 bg-neutral-50/90 px-2.5 text-left",
                            "hover:bg-neutral-100",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/10",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="truncate text-[12px] font-medium leading-tight tracking-[-0.015em] text-neutral-900">
                              {primaryLabel}
                            </span>
                            {verified ? (
                              <VerifiedBadge size="xs" className="shrink-0" />
                            ) : null}
                          </span>
                          <span className="truncate text-[10.5px] leading-tight tracking-[-0.01em] text-neutral-400">
                            {booking.teacherName}
                          </span>
                        </button>
                      )
                    }

                    if (isRestricted && session.role !== "admin") {
                      return (
                        <div
                          key={period}
                          title={restrictionTitle}
                          className={cn(
                            cellBase,
                            "flex-col items-center justify-center gap-1 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.03)_3px,rgba(0,0,0,0.03)_4px)] text-neutral-400",
                          )}
                        >
                          <Lock className="size-3" strokeWidth={1.25} />
                          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                            {restriction?.category === "ap_exam" ? "AP" : "Locked"}
                          </span>
                        </div>
                      )
                    }

                    if (isRestricted && session.role === "admin") {
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => onCellClick(cart, period)}
                          title={`${restrictionTitle} — admins can still book`}
                          className={cn(
                            cellBase,
                            "flex-col items-center justify-center gap-1",
                            "bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.03)_3px,rgba(0,0,0,0.03)_4px)]",
                            "text-neutral-500",
                            "hover:bg-neutral-100 hover:text-neutral-950",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/10",
                          )}
                        >
                          <Lock className="size-3" strokeWidth={1.25} />
                          <span className="text-[9px] font-medium uppercase tracking-[0.14em]">
                            Admin
                          </span>
                        </button>
                      )
                    }

                    if (!canBookOpenSlots) {
                      return (
                        <div
                          key={period}
                          title={
                            isHolidayDate
                              ? boardHoliday
                                ? `${boardHoliday.name} — booking unavailable`
                                : "Holiday — booking unavailable"
                              : isPastDate
                                ? "Past date — cannot book"
                                : "Outside booking window"
                          }
                          className={cn(
                            cellBase,
                            "items-center justify-center bg-white text-neutral-200",
                            isHolidayDate && "bg-neutral-50",
                          )}
                        >
                          <span className="text-[11px] font-light">—</span>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => onCellClick(cart, period)}
                        className={cn(
                          cellBase,
                          "group/cell items-center justify-center bg-white",
                          "hover:bg-neutral-950",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/15",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-[0.16em]",
                            "text-neutral-300 transition-colors duration-150",
                            "group-hover/cell:text-white",
                          )}
                        >
                          Book
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
      </div>

      {bookDialog && (
        <BookDialog
          cart={bookDialog.cart}
          period={bookDialog.period}
          date={date}
          onClose={() => setBookDialog(null)}
        />
      )}
      {issueDialog && (
        <IssueDialog cart={issueDialog} onClose={() => setIssueDialog(null)} />
      )}
      {swapDialog && (
        <SwapRequestDialog booking={swapDialog} onClose={() => setSwapDialog(null)} />
      )}
      {manageDialog && (
        <ManageBookingDialog
          booking={manageDialog}
          cart={managedCart}
          onClose={() => setManageDialog(null)}
        />
      )}
    </section>
  )
}
