"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { format, parseISO, addDays } from "date-fns"
import type { Booking, BookingPolicy, Cart, Period, SessionUser, SlotRestriction } from "@/lib/types"

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
  const canBookOpenSlots = !isPastDate && !isBeyondAdvanceWindow

  function setDate(next: string) {
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
    const next = format(addDays(parseISO(date), offsetDays), "yyyy-MM-dd")
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

  const contextLine =
    session.role !== "admin"
      ? `${maxAdvanceDays}-day window · through ${format(parseISO(lastBookableDate), "MMM d")}`
      : "Open slots to book · report issues from any cart"

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 border-b border-[var(--hairline)] pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            {isViewingToday ? "Today" : "Board"}
          </p>
          <h2 className="type-heading mt-1.5 leading-none text-neutral-950">
            {heading}
          </h2>
          <p className="mt-2 max-w-md text-[12.5px] font-normal leading-relaxed tracking-[-0.005em] text-neutral-400">
            {contextLine}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 self-start sm:self-end">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(-1)}
            className="flex size-9 items-center justify-center text-neutral-400 transition-colors duration-200 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10"
          >
            <ChevronLeft className="size-4" strokeWidth={1.25} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-9 items-center gap-2 px-2.5",
                  "text-[12px] font-medium tracking-[-0.01em] text-neutral-950",
                  "transition-colors duration-200",
                  "hover:text-neutral-600",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                )}
              >
                <CalendarIcon
                  className="size-3.5 text-neutral-400"
                  strokeWidth={1.25}
                />
                <span className="tabular-nums">
                  {format(parseISO(date), "MMM d, yyyy")}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden rounded-xl border-[var(--hairline-strong)] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              align="end"
            >
              <Calendar
                mode="single"
                selected={parseISO(date)}
                onSelect={(val) => val && setDate(format(val, "yyyy-MM-dd"))}
                disabled={(day) =>
                  isTeacherWindowEnforced &&
                  format(day, "yyyy-MM-dd") > lastBookableDate
                }
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => go(1)}
            disabled={isTeacherWindowEnforced && date >= lastBookableDate}
            className="flex size-9 items-center justify-center text-neutral-400 transition-colors duration-200 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" strokeWidth={1.25} />
          </button>

          <span
            aria-hidden
            className="mx-1.5 hidden h-4 w-px bg-[var(--hairline-strong)] sm:block"
          />

          <button
            type="button"
            onClick={() => setDate(today)}
            disabled={isViewingToday}
            className={cn(
              "h-9 px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
              isViewingToday
                ? "cursor-default text-neutral-300"
                : "text-neutral-950 hover:text-neutral-500",
            )}
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <span className="size-1.5 rounded-[1px] border border-neutral-300 bg-white" />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <span className="size-1.5 rounded-[1px] bg-neutral-950" />
          Yours
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <span className="size-1.5 rounded-[1px] bg-neutral-200" />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <Lock className="size-2.5 text-neutral-400" strokeWidth={1.5} />
          Restricted
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <Wrench className="size-2.5 text-neutral-400" strokeWidth={1.5} />
          Maintenance
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[54rem]">
            <div
              className="grid bg-neutral-950"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div className="flex items-center px-4 py-3.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
                Cart
              </div>
              {PERIODS.map((p) => (
                <div
                  key={p}
                  className="flex items-center justify-center border-l border-white/[0.08] px-2 py-3.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45"
                >
                  {p}
                </div>
              ))}
            </div>

            {carts.length === 0 ? (
              <div className="px-4 py-16 text-center">
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
                      "flex items-center justify-between gap-2 border-r border-[var(--hairline)] px-3.5 py-3",
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
                        "text-neutral-300 transition-colors duration-150",
                        "hover:bg-neutral-100 hover:text-neutral-950",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                        "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      <AlertTriangle className="size-3.5" strokeWidth={1.25} />
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
                            isPastDate
                              ? "Past date — cannot book"
                              : "Outside booking window"
                          }
                          className={cn(
                            cellBase,
                            "items-center justify-center bg-white text-neutral-200",
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
