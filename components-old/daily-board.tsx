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

  const heading = format(parseISO(date), "EEEE - MMMM d, yyyy")

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-4 sm:p-5 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-[clamp(1.35rem,3.2vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
            {heading}
          </h2>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Book, manage, and report issues.
          </p>
          {session.role !== "admin" && (
            <p className="text-[11px] font-medium text-muted-foreground">
              Advance window: {maxAdvanceDays} day{maxAdvanceDays === 1 ? "" : "s"} (through {format(parseISO(lastBookableDate), "MMM d, yyyy")}).
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-[13px] font-medium text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                {format(parseISO(date), "MMM d, yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(date)}
                onSelect={(val) => val && setDate(format(val, "yyyy-MM-dd"))}
                disabled={(day) => isTeacherWindowEnforced && format(day, "yyyy-MM-dd") > lastBookableDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => go(1)}
            disabled={isTeacherWindowEnforced && date >= lastBookableDate}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="h-10 rounded-md border border-black bg-black px-4 text-[11px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-black/90"
          >
            Today
          </button>
        </div>
      </div>


      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <div className="min-w-215">
          <div
            className="grid border-b border-border bg-black"
            style={{ gridTemplateColumns: "minmax(250px, 1.45fr) repeat(5, minmax(0, 1fr))" }}
          >
            <div className="flex items-center px-5 py-4 text-[11px] font-semibold uppercase tracking-widest text-white/80">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center border-l border-white/10 px-4 py-4 text-[11px] font-semibold uppercase tracking-widest text-white/80"
              >
                {p}
              </div>
            ))}
          </div>

          {carts.map((cart) => (
            <div
              key={cart.id}
              className="grid border-b border-border bg-white last:border-b-0"
              style={{ gridTemplateColumns: "minmax(250px, 1.45fr) repeat(5, minmax(0, 1fr))" }}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-foreground">{cart.name}</span>
                  {cart.status === "maintenance" && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                      maintenance
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Report issue on ${cart.name}`}
                  onClick={() => setIssueDialog(cart)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-white text-muted-foreground transition-colors hover:border-black hover:bg-black hover:text-white"
                >
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
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
                        "flex items-center justify-center border-l border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
                        "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,hsl(var(--border))_6px,hsl(var(--border))_7px)]",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="h-3 w-3" strokeWidth={1.5} />
                        Offline
                      </span>
                    </div>
                  )
                }

                if (booking && isMine) {
                  const primaryLabel = booking.className?.trim() || "Reserved"
                  const secondaryLabel = booking.subject?.trim()
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      className="flex flex-col items-start gap-1 border-l border-border bg-black px-4 py-5 text-left text-white transition-colors hover:bg-black/90"
                    >
                      <span className="text-[13px] font-semibold leading-tight">{primaryLabel}</span>
                      {secondaryLabel && (
                        <span className="text-[11px] leading-tight text-white/70">{secondaryLabel}</span>
                      )}
                    </button>
                  )
                }

                if (booking) {
                  const primaryLabel = booking.className?.trim() || "Reserved"
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onCellClick(cart, period)}
                      className="flex flex-col items-start gap-1 border-l border-border bg-muted/50 px-4 py-5 text-left transition-colors hover:bg-muted/80"
                    >
                      <span className="text-[12px] font-medium leading-tight text-foreground/85">
                        {primaryLabel}
                      </span>
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        {booking.teacherName}
                      </span>
                    </button>
                  )
                }

                if (isRestricted && session.role !== "admin") {
                  const isApExam = restriction?.category === "ap_exam"
                  return (
                    <div
                      key={period}
                      className="flex flex-col items-center justify-center gap-1 border-l border-border bg-amber-50/50 px-4 py-5 text-[10px] font-semibold uppercase tracking-widest text-amber-700"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="h-3 w-3" strokeWidth={1.5} />
                        {isApExam ? "AP exam" : "Restricted"}
                      </span>
                      <span className="text-[9px] text-amber-700/80 normal-case tracking-normal">
                        Admin only
                      </span>
                    </div>
                  )
                }

                if (!booking && isBeyondAdvanceWindow) {
                  return (
                    <div
                      key={period}
                      className="flex flex-col items-center justify-center gap-1 border-l border-border bg-muted/35 px-4 py-5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      <span>Window</span>
                    </div>
                  )
                }

                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => onCellClick(cart, period)}
                    className="flex items-center justify-center border-l border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-black hover:text-white"
                  >
                    Book
                  </button>
                )
              })}
            </div>
          ))}
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
