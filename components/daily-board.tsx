"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { format, parseISO, addDays } from "date-fns"
import type {
  Booking,
  BookingPolicy,
  Cart,
  Period,
  RestrictionCategory,
  SessionUser,
  SlotRestriction,
} from "@/lib/types"

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

import { batchRestrictSlots } from "@/lib/actions"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Wrench,
  AlertTriangle,
  Lock,
  Loader2,
  Pencil,
  Shield,
  Unlock,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePlatformStore } from "@/lib/data/platform-store"

const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

const cellBase =
  "flex min-h-14 min-w-0 border-l border-[var(--hairline)] transition-colors duration-150 ease-out sm:min-h-16"

/** Dominant face in the slot; cell height tracks so neighbors stay clear. */
const SLOT_AVATAR =
  "size-11 shrink-0 rounded-full object-cover select-none sm:size-12"

function slotInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

function SlotPfp({
  name,
  src,
  onDark,
}: {
  name: string
  src?: string | null
  /** Initials contrast on solid black vs translucent cells */
  onDark?: boolean
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        draggable={false}
        className={SLOT_AVATAR}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        SLOT_AVATAR,
        "inline-flex items-center justify-center text-[13px] font-medium tracking-[-0.02em] sm:text-[14px]",
        onDark
          ? "bg-white/15 text-white"
          : "bg-neutral-900/10 text-neutral-600",
      )}
    >
      {slotInitials(name)}
    </span>
  )
}

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

  const avatarByTeacherId = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const user of platform.users) {
      if (user.avatarUrl) map.set(user.id, user.avatarUrl)
    }
    if (session.id && session.avatarUrl) {
      map.set(session.id, session.avatarUrl)
    }
    return map
  }, [platform.users, session.id, session.avatarUrl])

  const nameByTeacherId = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of platform.users) {
      map.set(user.id, user.name)
    }
    if (session.id) map.set(session.id, session.name)
    return map
  }, [platform.users, session.id, session.name])

  const [bookDialog, setBookDialog] = useState<{ cart: Cart; period: Period } | null>(null)
  const [issueDialog, setIssueDialog] = useState<Cart | null>(null)
  const [swapDialog, setSwapDialog] = useState<Booking | null>(null)
  const [manageDialog, setManageDialog] = useState<Booking | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dayLockDate, setDayLockDate] = useState<string | null>(null)

  const restrictedDateMatchers = useMemo(() => {
    const keys = new Set(slotRestrictions.map((r) => r.date))
    return Array.from(keys).map((d) => parseISO(d))
  }, [slotRestrictions])

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

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                disabled={(day) => {
                  if (
                    isTeacherWindowEnforced &&
                    format(day, "yyyy-MM-dd") > lastBookableDate
                  ) {
                    return true
                  }
                  return false
                }}
                modifiers={{
                  locked: restrictedDateMatchers,
                }}
                modifiersClassNames={{
                  locked:
                    "relative after:pointer-events-none after:absolute after:bottom-1 after:left-1 after:size-1 after:rounded-full after:bg-neutral-950 aria-selected:after:bg-white",
                }}
                onEditDay={
                  session.role === "admin"
                    ? (day) => {
                        const key = format(day, "yyyy-MM-dd")
                        setDate(key)
                        setDatePickerOpen(false)
                        setDayLockDate(key)
                      }
                    : undefined
                }
              />
              {session.role === "admin" ? (
                <p className="border-t border-neutral-100 px-3.5 py-2 text-[11px] leading-snug text-neutral-400">
                  Select a date, then tap the pencil to edit booking locks.
                </p>
              ) : null}
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

      {/* ── Legend strip: aligned with toolbar padding ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--hairline)] bg-neutral-50/80 px-4 py-2 sm:px-5">
        <span className={legendItem}>
          <span className="size-2 shrink-0 rounded-[1px] border border-neutral-300 bg-white" />
          Open
        </span>
        <span className={legendItem}>
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: "#211d1d" }}
          />
          Yours
        </span>
        <span className={legendItem}>
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: "rgba(33, 29, 29, 0.15)" }}
          />
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

      {/* ── Period grid — fluid width; scrolls only on very narrow viewports ── */}
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
                {session.role === "admin"
                  ? "Add laptop carts under Admin → Inventory."
                  : "Ask an admin to add laptop carts."}
              </p>
            </div>
          ) : null}

            {carts.map((cart) => {
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
                      "board-sticky-label flex items-center justify-between gap-1.5 border-r border-[var(--hairline)] px-3 py-2.5 sm:gap-2 sm:px-5 sm:py-3",
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
                      const personName =
                        nameByTeacherId.get(booking.teacherId) ||
                        booking.teacherName
                      const avatarSrc =
                        avatarByTeacherId.get(booking.teacherId) ??
                        (isMine ? session.avatarUrl : undefined)
                      const classLabel = booking.className?.trim()
                      const title = isMine
                        ? `${classLabel || "Your booking"} — click to manage or cancel`
                        : `${classLabel || personName} · ${personName} — click to request swap`

                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => onCellClick(cart, period)}
                          title={title}
                          aria-label={title}
                          className={cn(
                            cellBase,
                            "items-center justify-center p-1.5",
                            // Booking ink #211d1d — distinct from period header
                            isMine
                              ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/20"
                              : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#211d1d]/20",
                            isMine
                              ? "bg-[#211d1d] hover:bg-[#2a2525]"
                              : "bg-[#211d1d]/10 hover:bg-[#211d1d]/15",
                          )}
                        >
                          <SlotPfp
                            name={personName}
                            src={avatarSrc}
                            onDark={isMine}
                          />
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
      {session.role === "admin" && dayLockDate ? (
        <AdminDayLockDialog
          date={dayLockDate}
          carts={carts}
          bookings={bookings}
          slotRestrictions={slotRestrictions}
          open={Boolean(dayLockDate)}
          onOpenChange={(open) => {
            if (!open) setDayLockDate(null)
          }}
          onApplied={() => router.refresh()}
        />
      ) : null}
    </section>
  )
}

/* ─── Admin: lock / unlock all open cart slots for one day ─── */

function AdminDayLockDialog({
  date,
  carts,
  bookings,
  slotRestrictions,
  open,
  onOpenChange,
  onApplied,
}: {
  date: string
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}) {
  const [category, setCategory] = useState<RestrictionCategory>("general")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<"lock" | "unlock" | null>(null)

  const activeCarts = useMemo(
    () => carts.filter((c) => c.status !== "maintenance"),
    [carts],
  )
  const totalSlots = activeCarts.length * PERIODS.length
  const dayBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.date === date &&
          activeCarts.some((c) => c.id === b.cartId),
      ),
    [bookings, date, activeCarts],
  )
  const dayLocks = useMemo(
    () =>
      slotRestrictions.filter(
        (r) =>
          r.date === date &&
          activeCarts.some((c) => c.id === r.cartId),
      ),
    [slotRestrictions, date, activeCarts],
  )
  const openSlots = Math.max(0, totalSlots - dayBookings.length - dayLocks.length)

  async function apply(action: "restrict" | "available") {
    if (activeCarts.length === 0) {
      toast({
        title: "No carts",
        description: "Add carts under Admin → Inventory first.",
        variant: "destructive",
      })
      return
    }
    setBusy(action === "restrict" ? "lock" : "unlock")
    try {
      const res = await batchRestrictSlots(
        activeCarts.map((c) => c.id),
        date,
        date,
        PERIODS,
        action,
        action === "restrict"
          ? {
              category,
              reason: reason.trim() || undefined,
            }
          : undefined,
      )
      if (!res.ok) {
        toast({
          title: action === "restrict" ? "Could not lock day" : "Could not unlock day",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: action === "restrict" ? "Day locked" : "Day unlocked",
        description:
          action === "restrict"
            ? `${res.data?.restrictedCount ?? 0} slots locked${
                res.data?.skippedBookedCount
                  ? ` · ${res.data.skippedBookedCount} booked skipped`
                  : ""
              }`
            : `${res.data?.restrictedCount ?? 0} locks cleared`,
      })
      onApplied()
      onOpenChange(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:max-w-sm">
        <DialogHeader className="space-y-1 border-b border-neutral-100 px-5 py-4 text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-950">
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[14px] font-semibold tracking-[-0.02em] text-neutral-950">
                Edit day locks
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] tabular-nums text-neutral-500">
                {format(parseISO(date), "EEEE, MMM d, yyyy")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-3 divide-x divide-neutral-100 rounded-md border border-neutral-200 bg-white text-center">
            <div className="px-2 py-2.5">
              <p className="text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                {openSlots}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                Open
              </p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                {dayBookings.length}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                Booked
              </p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                {dayLocks.length}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                Locked
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              Lock type
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("general")}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-colors",
                  category === "general"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <Lock className="size-3.5" strokeWidth={1.5} />
                General
              </button>
              <button
                type="button"
                onClick={() => setCategory("ap_exam")}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-colors",
                  category === "ap_exam"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <Shield className="size-3.5" strokeWidth={1.5} />
                AP exam
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              Note
            </p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional (shown to teachers)"
              className="h-9 rounded-md border-neutral-200 bg-white text-[13px] shadow-none focus-visible:ring-neutral-950/10"
            />
          </div>

          <p className="text-[11.5px] leading-relaxed text-neutral-400">
            Locks open slots for all active carts and periods. Existing bookings
            are never overwritten.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3.5 sm:flex-row-reverse">
          <button
            type="button"
            disabled={busy !== null || openSlots === 0}
            onClick={() => void apply("restrict")}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md",
              "bg-neutral-950 text-[13px] font-medium text-white",
              "hover:bg-neutral-800 disabled:opacity-40",
            )}
          >
            {busy === "lock" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Lock className="size-3.5" strokeWidth={1.5} />
            )}
            Lock open slots
          </button>
          <button
            type="button"
            disabled={busy !== null || dayLocks.length === 0}
            onClick={() => void apply("available")}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md",
              "border border-neutral-200 bg-white text-[13px] font-medium text-neutral-700",
              "hover:bg-neutral-50 disabled:opacity-40",
            )}
          >
            {busy === "unlock" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Unlock className="size-3.5" strokeWidth={1.5} />
            )}
            Unlock day
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
