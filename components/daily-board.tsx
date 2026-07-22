"use client"

import { useState, useTransition } from "react"
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

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Wrench, AlertTriangle, Lock } from "lucide-react"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const [, startTransition] = useTransition()

  const [bookDialog, setBookDialog] = useState<{ cart: Cart; period: Period } | null>(null)
  const [issueDialog, setIssueDialog] = useState<Cart | null>(null)
  const [swapDialog, setSwapDialog] = useState<Booking | null>(null)

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

  function setDate(next: string) {
    if (isTeacherWindowEnforced && next > lastBookableDate) {
      toast({
        title: "Outside booking window",
        description: `Bookings are limited to ${maxAdvanceDays} day${maxAdvanceDays === 1 ? "" : "s"} ahead.`,
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
      if (existing.teacherId !== session.id && session.role !== "admin") {
        setSwapDialog(existing)
        return
      }
      startTransition(async () => {
        const res = await cancelBooking(existing.id)
        if ("error" in res && res.error) {
          toast({ title: "Could not cancel", description: res.error, variant: "destructive" })
        } else {
          toast({ title: "Booking canceled" })
          router.refresh()
        }
      })
      return
    }

    if (isTeacherWindowEnforced && date > lastBookableDate) {
      toast({
        title: "Outside booking window",
        description: `Bookings are limited to ${maxAdvanceDays} day${maxAdvanceDays === 1 ? "" : "s"} ahead.`,
        variant: "destructive",
      })
      return
    }
    if (isTeacherWindowEnforced && date < today) {
      toast({
        title: "Past date",
        description: "Past dates cannot be booked.",
        variant: "destructive",
      })
      return
    }
    const restriction = restrictionMap.get(`${cart.id}:${period}`)
    if (restriction && session.role !== "admin") {
      toast({
        title: restriction.category === "ap_exam" ? "AP exam slot" : "Slot restricted",
        description:
          restriction.category === "ap_exam"
            ? "This slot is reserved for AP exam bookings."
            : restriction.reason ?? "This slot has been restricted by an administrator.",
        variant: "destructive",
      })
      return
    }
    setBookDialog({ cart, period })
  }

  const heading = format(parseISO(date), "EEEE, MMM d")

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-neutral-950 sm:text-[1.25rem]">
            {heading}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-neutral-500">
            {session.role !== "admin"
              ? `Book within ${maxAdvanceDays} day${maxAdvanceDays === 1 ? "" : "s"} · through ${format(parseISO(lastBookableDate), "MMM d")}`
              : "Book, manage, and report cart issues"}
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
            className="h-8 rounded-full bg-neutral-950 px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Today
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
          <div
            className="grid border-b border-neutral-800 bg-neutral-950"
            style={{ gridTemplateColumns: "minmax(9rem, 1fr) repeat(5, minmax(0, 1fr))" }}
          >
            <div className="flex items-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center border-l border-white/10 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65"
              >
                {p}
              </div>
            ))}
          </div>

          {carts.map((cart) => (
            <div
              key={cart.id}
              className="grid border-b border-neutral-100 bg-white last:border-b-0"
              style={{ gridTemplateColumns: "minmax(9rem, 1fr) repeat(5, minmax(0, 1fr))" }}
            >
              <div className="flex items-center justify-between gap-2 border-r border-neutral-100 px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-neutral-950">{cart.name}</span>
                  {cart.status === "maintenance" ? (
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-amber-700">
                      offline
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Report issue on ${cart.name}`}
                  onClick={() => setIssueDialog(cart)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
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

                if (isMaintenance) {
                  return (
                    <div
                      key={period}
                      className={cn(
                        "flex min-h-11 items-center justify-center border-l border-neutral-100 text-neutral-400",
                        "bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.04)_5px,rgba(0,0,0,0.04)_6px)]",
                      )}
                    >
                      <Wrench className="size-3" strokeWidth={1.5} />
                    </div>
                  )
                }

                if (booking && isMine) {
                  const primaryLabel = booking.className?.trim() || "Yours"
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      title={`${primaryLabel} - click to cancel`}
                      className="flex min-h-11 min-w-0 items-center border-l border-neutral-800 bg-neutral-950 px-2 text-left text-white transition-colors hover:bg-neutral-800"
                    >
                      <span className="truncate text-[11.5px] font-semibold leading-tight">
                        {primaryLabel}
                      </span>
                    </button>
                  )
                }

                if (booking) {
                  const primaryLabel = booking.className?.trim() || booking.teacherName
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      title={`${primaryLabel} · ${booking.teacherName}`}
                      className="flex min-h-11 min-w-0 flex-col justify-center border-l border-neutral-100 bg-neutral-50 px-2 text-left transition-colors hover:bg-neutral-100"
                    >
                      <span className="truncate text-[11.5px] font-medium leading-tight text-neutral-900">
                        {primaryLabel}
                      </span>
                      <span className="truncate text-[10px] leading-tight text-neutral-400">
                        {booking.teacherName}
                      </span>
                    </button>
                  )
                }

                if (isRestricted && session.role !== "admin") {
                  return (
                    <div
                      key={period}
                      title={restriction?.category === "ap_exam" ? "AP exam" : "Restricted"}
                      className="flex min-h-11 items-center justify-center border-l border-neutral-100 bg-amber-50/60 text-amber-700"
                    >
                      <Lock className="size-3" strokeWidth={1.5} />
                    </div>
                  )
                }

                if (!booking && isBeyondAdvanceWindow) {
                  return (
                    <div
                      key={period}
                      className="flex min-h-11 items-center justify-center border-l border-neutral-100 bg-neutral-50/80 text-[10px] text-neutral-400"
                    >
                      -
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
          ))}
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
    </section>
  )
}
