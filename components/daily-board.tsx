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
      // Own booking or admin: open manage/cancel. Other teachers: request swap.
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
  const managedCart = manageDialog
    ? carts.find((c) => c.id === manageDialog.cartId)
    : undefined

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--hairline-strong)] bg-white p-3.5 shadow-[var(--shadow-surface)] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.25rem]">
            {heading}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-neutral-400">
            {session.role !== "admin"
              ? `${maxAdvanceDays}-day window · through ${format(parseISO(lastBookableDate), "MMM d")}`
              : "Open slots to book · ⚠ to report"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(-1)}
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-950"
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.5} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12.5px] font-medium text-neutral-950 hover:border-neutral-300"
              >
                <CalendarIcon className="size-3.5 text-neutral-400" strokeWidth={1.5} />
                {format(parseISO(date), "MMM d, yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={parseISO(date)}
                onSelect={(val) => val && setDate(format(val, "yyyy-MM-dd"))}
                disabled={(day) => isTeacherWindowEnforced && format(day, "yyyy-MM-dd") > lastBookableDate}
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => go(1)}
            disabled={isTeacherWindowEnforced && date >= lastBookableDate}
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="h-8 rounded-lg bg-neutral-950 px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-0.5 text-[11px] text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm border border-neutral-200 bg-white" />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-neutral-950" />
          Yours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-neutral-200" />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-2.5 text-slate-400" strokeWidth={2} />
          Restricted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wrench className="size-2.5 text-amber-600" strokeWidth={2} />
          Maintenance
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
          <div
            className="grid border-b border-neutral-800 bg-neutral-950"
            style={{ gridTemplateColumns: "minmax(9rem, 1fr) repeat(5, minmax(0, 1fr))" }}
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

          {carts.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-neutral-500">
              No carts are set up yet. Ask an admin to add laptop carts.
            </div>
          ) : null}

          {carts.map((cart) => {
            const isMaintenanceRow = cart.status === "maintenance"
            return (
            <div
              key={cart.id}
              className={cn(
                "grid border-b last:border-b-0",
                isMaintenanceRow
                  ? "border-amber-200/70 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white"
                  : "border-neutral-100 bg-white",
              )}
              style={{ gridTemplateColumns: "minmax(9rem, 1fr) repeat(5, minmax(0, 1fr))" }}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 border-r px-3 py-2.5",
                  isMaintenanceRow ? "border-amber-200/70" : "border-neutral-100",
                )}
              >
                <div className="min-w-0">
                  <span className="type-body-strong block truncate">{cart.name}</span>
                  {isMaintenanceRow ? (
                    <span className="type-label mt-0.5 block text-amber-700">
                      Maintenance
                    </span>
                  ) : cart.location ? (
                    <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
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
                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isMaintenanceRow
                      ? "text-amber-600 hover:bg-amber-100/80 hover:text-amber-800"
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-950",
                  )}
                >
                  <AlertTriangle className="size-3.5" strokeWidth={1.5} />
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
                        "flex min-h-11 items-center justify-center",
                        "border-l border-amber-200/70",
                        "bg-gradient-to-br from-amber-50/90 via-amber-50/45 to-white",
                        "text-amber-600",
                      )}
                    >
                      <Wrench className="size-3.5" strokeWidth={1.5} />
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
                      className="flex min-h-11 min-w-0 items-center gap-1 border-l border-neutral-800 bg-neutral-950 px-2 text-left text-white transition-colors hover:bg-neutral-800"
                    >
                      <span className="truncate text-[11.5px] font-semibold leading-tight">
                        {primaryLabel}
                      </span>
                      {verified ? (
                        <VerifiedBadge
                          size="xs"
                          className="shrink-0 text-sky-400"
                          title="Verified permanent staff"
                        />
                      ) : null}
                    </button>
                  )
                }

                if (booking) {
                  const primaryLabel = booking.className?.trim() || booking.teacherName
                  const verified = verifiedByTeacherId.get(booking.teacherId)
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      title={`${primaryLabel} · ${booking.teacherName}${verified ? " · verified permanent" : ""} — click to request swap`}
                      className="flex min-h-11 min-w-0 flex-col justify-center border-l border-neutral-100 bg-neutral-50 px-2 text-left transition-colors hover:bg-neutral-100"
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate text-[11.5px] font-medium leading-tight text-neutral-900">
                          {primaryLabel}
                        </span>
                        {verified ? (
                          <VerifiedBadge size="xs" className="shrink-0" />
                        ) : null}
                      </span>
                      <span className="truncate text-[10px] leading-tight text-neutral-400">
                        {booking.teacherName}
                      </span>
                    </button>
                  )
                }

                // Restricted: slate (not amber — amber is maintenance only)
                if (isRestricted && session.role !== "admin") {
                  return (
                    <div
                      key={period}
                      title={restrictionTitle}
                      className="flex min-h-11 flex-col items-center justify-center gap-0.5 border-l border-slate-100 bg-slate-50 text-slate-500"
                    >
                      <Lock className="size-3" strokeWidth={1.5} />
                      <span className="text-[9px] font-medium uppercase tracking-wide">
                        {restriction?.category === "ap_exam" ? "AP" : "Locked"}
                      </span>
                    </div>
                  )
                }

                // Admin on restricted empty slot — still bookable, clearly marked
                if (isRestricted && session.role === "admin") {
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      title={`${restrictionTitle} — admins can still book`}
                      className="flex min-h-11 flex-col items-center justify-center gap-0.5 border-l border-slate-200 bg-slate-50/80 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Lock className="size-3" strokeWidth={1.5} />
                      <span className="text-[9px] font-medium uppercase tracking-wide">
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
                      className="flex min-h-11 items-center justify-center border-l border-neutral-100 bg-neutral-50/60 text-[10px] text-neutral-300"
                    >
                      —
                    </div>
                  )
                }

                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => onCellClick(cart, period)}
                    className="flex min-h-11 items-center justify-center border-l border-neutral-100 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400 transition-colors hover:bg-neutral-950 hover:text-white"
                  >
                    Book
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
