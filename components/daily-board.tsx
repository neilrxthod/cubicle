"use client"

import { useMemo, useRef, useState } from "react"
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
import { bookingInvolvesUser } from "@/lib/types"

type LockKind = "general" | "ap_exam" | "holiday"

const LOCK_KINDS: ReadonlyArray<{
  id: LockKind
  label: string
  hint: string
}> = [
  { id: "general", label: "General", hint: "Block open slots" },
  { id: "ap_exam", label: "AP exam", hint: "Reserve for AP exams" },
  { id: "holiday", label: "Holiday", hint: "School closed / no carts" },
]

function restrictionLabel(restriction: SlotRestriction): string {
  if (restriction.category === "ap_exam") return "AP exam"
  if (
    restriction.category === "other" &&
    (restriction.reason ?? "").toLowerCase().includes("holiday")
  ) {
    return restriction.reason?.trim() || "Holiday"
  }
  return restriction.reason?.trim() || "Locked"
}

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

import { batchRestrictSlots, cancelBooking } from "@/lib/actions"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ArrowLeftRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Wrench,
  AlertTriangle,
  Lock,
  Loader2,
  Trash2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePlatformStore } from "@/lib/data/platform-store"

const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

/** Parse yyyy-MM-dd as local calendar day (no UTC shift). */
function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

const cellBase =
  "flex min-h-14 min-w-0 border-l border-[var(--hairline)] transition-colors duration-150 ease-out sm:min-h-16"

/** Dominant face in the slot; cell height tracks so neighbors stay clear. */
const SLOT_AVATAR =
  "size-11 shrink-0 rounded-full object-cover select-none sm:size-12"
/** Slightly smaller face when stacking share partner. */
const SLOT_AVATAR_STACK =
  "size-9 shrink-0 rounded-full object-cover select-none ring-2 sm:size-10"

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
  stacked,
  className,
}: {
  name: string
  src?: string | null
  /** Initials contrast on solid black vs translucent cells */
  onDark?: boolean
  /** Compact size for dual-share stack */
  stacked?: boolean
  className?: string
}) {
  const sizeClass = stacked ? SLOT_AVATAR_STACK : SLOT_AVATAR
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        draggable={false}
        className={cn(
          sizeClass,
          stacked && (onDark ? "ring-white/25" : "ring-white"),
          className,
        )}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        sizeClass,
        "inline-flex items-center justify-center font-medium tracking-[-0.02em]",
        stacked
          ? "text-[11px] sm:text-[12px]"
          : "text-[13px] sm:text-[14px]",
        onDark
          ? "bg-white/15 text-white"
          : "bg-neutral-900/10 text-neutral-600",
        stacked && (onDark ? "ring-white/25" : "ring-white"),
        className,
      )}
    >
      {slotInitials(name)}
    </span>
  )
}

/** Owner + optional co-teacher (share/borrow) faces. */
function SlotPeople({
  primaryName,
  primarySrc,
  shareName,
  shareSrc,
  onDark,
}: {
  primaryName: string
  primarySrc?: string | null
  shareName?: string
  shareSrc?: string | null
  onDark?: boolean
}) {
  if (!shareName) {
    return <SlotPfp name={primaryName} src={primarySrc} onDark={onDark} />
  }
  return (
    <span className="relative inline-flex items-center pr-2">
      <SlotPfp
        name={primaryName}
        src={primarySrc}
        onDark={onDark}
        stacked
        className="relative z-[1]"
      />
      <SlotPfp
        name={shareName}
        src={shareSrc}
        onDark={onDark}
        stacked
        className="relative z-[2] -ml-3"
      />
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
  /** Admin must pick a lock type before Lock becomes active. */
  const [lockKind, setLockKind] = useState<LockKind | null>(null)
  const [lockReason, setLockReason] = useState("")
  const [lockBusy, setLockBusy] = useState<"lock" | "unlock" | null>(null)
  const lockInFlight = useRef(false)
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(
    null,
  )

  const isAdmin = session.role === "admin"

  async function adminDeleteBooking(booking: Booking) {
    if (deletingBookingId) return
    setDeletingBookingId(booking.id)
    try {
      const res = await cancelBooking(booking.id)
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not delete booking",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Booking deleted" })
      router.refresh()
    } finally {
      setDeletingBookingId(null)
    }
  }

  /** Carts that can receive day locks (prefer active; fall back to all). */
  const lockableCarts = useMemo(() => {
    const active = carts.filter((c) => c.status === "active")
    return active.length > 0 ? active : carts
  }, [carts])

  /** Live day occupancy for the selected board date (drives Unlock enablement). */
  const dayLockStats = useMemo(() => {
    const cartIds = new Set(lockableCarts.map((c) => c.id))
    const total = lockableCarts.length * PERIODS.length
    const bookedKeys = new Set<string>()
    for (const b of bookings) {
      if (b.date.slice(0, 10) !== date || !cartIds.has(b.cartId)) continue
      bookedKeys.add(`${b.cartId}:${b.period}`)
    }
    const lockedKeys = new Set<string>()
    const kinds = { ap: 0, holiday: 0, general: 0 }
    for (const r of slotRestrictions) {
      if (r.date.slice(0, 10) !== date || !cartIds.has(r.cartId)) continue
      lockedKeys.add(`${r.cartId}:${r.period}`)
      if (r.category === "ap_exam") kinds.ap += 1
      else if (
        r.category === "other" &&
        (r.reason ?? "").toLowerCase().includes("holiday")
      ) {
        kinds.holiday += 1
      } else {
        kinds.general += 1
      }
    }
    let open = 0
    for (const cart of lockableCarts) {
      for (const period of PERIODS) {
        const key = `${cart.id}:${period}`
        if (!bookedKeys.has(key) && !lockedKeys.has(key)) open += 1
      }
    }
    // Dominant type for this day (for panel label — not under the date cell)
    const dominant: LockKind | null =
      kinds.ap > 0
        ? "ap_exam"
        : kinds.holiday > 0
          ? "holiday"
          : kinds.general > 0
            ? "general"
            : null
    return {
      total,
      booked: bookedKeys.size,
      locked: lockedKeys.size,
      open,
      dominant,
    }
  }, [bookings, date, lockableCarts, slotRestrictions])

  function resetLockDraft() {
    setLockKind(null)
    setLockReason("")
    setLockBusy(null)
  }

  function resolveLockPayload(): {
    category: RestrictionCategory
    reason?: string
  } | null {
    if (!lockKind) return null
    const note = lockReason.trim().slice(0, 120)
    if (lockKind === "ap_exam") {
      return { category: "ap_exam", reason: note || undefined }
    }
    if (lockKind === "holiday") {
      // DB allows ap_exam | general | other — holiday maps to other.
      return { category: "other", reason: note || "Holiday" }
    }
    return { category: "general", reason: note || undefined }
  }

  async function applyDayLock(action: "restrict" | "available") {
    if (lockInFlight.current) return
    if (!isAdmin) {
      toast({
        title: "Admin only",
        description: "Sign in with an admin account to lock carts.",
        variant: "destructive",
      })
      return
    }
    if (lockableCarts.length === 0) {
      toast({
        title: "No carts",
        description: "Add carts under Admin → Inventory first.",
        variant: "destructive",
      })
      return
    }

    if (action === "restrict" && !lockKind) {
      toast({
        title: "Choose a lock type",
        description: "Select General, AP exam, or Holiday first.",
      })
      return
    }

    if (action === "available" && dayLockStats.locked === 0) {
      toast({
        title: "Nothing to unlock",
        description: "There are no locks on this day.",
      })
      return
    }

    if (action === "restrict" && dayLockStats.open === 0 && dayLockStats.locked === 0) {
      toast({
        title: "Nothing to lock",
        description: "Every slot is booked — locks never overwrite bookings.",
      })
      return
    }

    const shortDate = format(parseLocalYmd(date), "MMM d")
    const cartIds = lockableCarts.map((c) => c.id)
    const payload = action === "restrict" ? resolveLockPayload() : undefined

    lockInFlight.current = true
    setLockBusy(action === "restrict" ? "lock" : "unlock")
    try {
      const res = await batchRestrictSlots(
        cartIds,
        date,
        date,
        PERIODS,
        action,
        payload ?? undefined,
      )
      if (!res.ok) {
        toast({
          title:
            action === "restrict"
              ? "Could not lock carts"
              : "Could not unlock day",
          description: res.error || "Try again.",
          variant: "destructive",
        })
        return
      }

      const count = res.data?.restrictedCount ?? 0
      const skipped = res.data?.skippedBookedCount ?? 0

      if (action === "restrict" && count === 0) {
        toast({
          title: "Nothing to lock",
          description:
            skipped > 0
              ? `All open slots are booked (${skipped} skipped).`
              : "Slots may already be locked for this day.",
        })
        return
      }

      if (action === "available" && count === 0) {
        toast({
          title: "Nothing to unlock",
          description: "There are no locks on this day.",
        })
        return
      }

      toast({
        title: action === "restrict" ? "Carts locked" : "Day unlocked",
        description:
          action === "restrict"
            ? `${count} slots locked for ${shortDate}${
                skipped ? ` · ${skipped} booked skipped` : ""
              }`
            : `${count} locks cleared for ${shortDate}`,
      })
      if (action === "restrict") {
        // Keep type selected so admin can re-lock another day quickly;
        // only clear custom note after a successful lock.
        setLockReason("")
      }
      // Soft refresh — platform store already rehydrated inside batchRestrictSlots.
      router.refresh()
    } catch (err) {
      toast({
        title: "Could not update locks",
        description: err instanceof Error ? err.message : "Unexpected error.",
        variant: "destructive",
      })
    } finally {
      lockInFlight.current = false
      setLockBusy(null)
    }
  }

  const bookingsForDate = bookings.filter(
    (b) => (b.date.length >= 10 ? b.date.slice(0, 10) : b.date) === date,
  )
  const bookingMap = new Map<string, Booking>()
  for (const b of bookingsForDate) bookingMap.set(`${b.cartId}:${b.period}`, b)
  const restrictionMap = new Map<string, SlotRestriction>()
  for (const restriction of slotRestrictions) {
    const rDate =
      restriction.date.length >= 10
        ? restriction.date.slice(0, 10)
        : restriction.date
    if (rDate === date) {
      restrictionMap.set(
        `${restriction.cartId}:${restriction.period}`,
        restriction,
      )
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
    if (next !== date) {
      // New day → admin must pick a lock type again before Lock activates.
      resetLockDraft()
    }
    const url = new URL(window.location.href)
    url.searchParams.set("date", next)
    router.push(url.pathname + url.search, { scroll: false })
  }

  function go(offsetDays: number) {
    const next = format(addDays(parseLocalYmd(date), offsetDays), "yyyy-MM-dd")
    setDate(next)
  }

  function onCellClick(cart: Cart, period: Period) {
    if (cart.status === "maintenance") return

    const existing = bookingMap.get(`${cart.id}:${period}`)
    if (existing) {
      // Owner or share partner → manage/cancel. Anyone else → swap.
      if (bookingInvolvesUser(existing, session.id)) {
        setManageDialog(existing)
        return
      }
      // Same day/period only. Admins may still request past-date swaps.
      if (date < today && session.role !== "admin") {
        toast({
          title: "Past date",
          description: "Cannot request swaps for past dates.",
          variant: "destructive",
        })
        return
      }
      const alreadyPending = platform.swapRequests.some(
        (s) =>
          s.status === "pending" &&
          s.bookingId === existing.id &&
          s.requesterId === session.id,
      )
      if (alreadyPending) {
        toast({
          title: "Already requested",
          description: "You already have a pending request for this slot.",
        })
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
    if (session.role !== "admin") {
      const maxSlots = Math.min(
        15,
        Math.max(1, bookingPolicy.maxSlotsPerTeacherPerDay ?? 5),
      )
      const mineToday = bookingsForDate.filter((b) =>
        bookingInvolvesUser(b, session.id),
      ).length
      if (mineToday >= maxSlots) {
        toast({
          title: "Daily limit reached",
          description:
            maxSlots === 1
              ? "You can book at most 1 cart slot per day."
              : `You can book at most ${maxSlots} cart slots per day.`,
          variant: "destructive",
        })
        return
      }
    }
    setBookDialog({ cart, period })
  }

  const heading = format(parseISO(date), "EEEE, MMM d")
  const isViewingToday = date === today
  const managedCart = manageDialog
    ? carts.find((c) => c.id === manageDialog.cartId)
    : undefined

  /** Single day-lock control: Lock when a type is picked, Unlock when day already locked. */
  const canLockDay = Boolean(lockKind)
  const canUnlockDay = dayLockStats.locked > 0 && !lockKind
  const dayLockActionReady = canLockDay || canUnlockDay

  const navBtn = cn(
    "flex size-8 items-center justify-center rounded-full",
    "text-neutral-400 transition-colors duration-200",
    "hover:bg-black/[0.04] hover:text-black",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
    "disabled:pointer-events-none disabled:opacity-25",
  )

  const legendItem =
    "inline-flex items-center gap-1.5 text-[10.5px] font-normal tracking-[-0.01em] text-neutral-400"

  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_0_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.04)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 border-b border-black/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="truncate text-[17px] font-normal tracking-[-0.035em] text-black sm:text-[18px]">
              {heading}
            </h2>
            {isViewingToday ? (
              <span className="text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-400">
                Today
              </span>
            ) : null}
          </div>
          {session.role !== "admin" && date >= today ? (
            <p className="mt-1 text-[12px] font-normal tracking-[-0.01em] text-neutral-400">
              Booking through {format(parseISO(lastBookableDate), "MMM d")}
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
                aria-expanded={datePickerOpen}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5",
                  "border border-black/[0.08] bg-white",
                  "text-[12px] font-normal tabular-nums tracking-[-0.02em] text-black",
                  "transition-colors duration-150",
                  "hover:bg-black/[0.03]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/10",
                  "data-[state=open]:border-black data-[state=open]:bg-black data-[state=open]:text-white",
                )}
              >
                <CalendarIcon
                  className={cn(
                    "size-3 shrink-0",
                    datePickerOpen ? "text-white/60" : "text-neutral-400",
                  )}
                  strokeWidth={1.5}
                />
                <span>{format(parseLocalYmd(date), "MMM d")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                // Landscape panel: wide rectangle, viewport-safe.
                "z-[60] w-[min(28rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)]",
                "max-h-[min(28rem,calc(100dvh-1.25rem))] overflow-x-hidden overflow-y-auto p-0",
                "rounded-2xl border border-black/[0.08] bg-white",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.1)]",
              )}
              align="end"
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
              avoidCollisions
            >
              <div
                className={cn(
                  "flex min-w-0 flex-col",
                  // Admin: calendar + locks sit side-by-side on wider screens.
                  isAdmin && "sm:flex-row sm:items-stretch",
                )}
              >
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    isAdmin && "sm:border-r sm:border-black/[0.05]",
                  )}
                >
                  <Calendar
                    mode="single"
                    selected={parseLocalYmd(date)}
                    defaultMonth={parseLocalYmd(date)}
                    onSelect={(val) => {
                      if (!val) return
                      setDate(format(val, "yyyy-MM-dd"))
                      // Keep open for admins so they can lock the chosen day.
                      if (!isAdmin) setDatePickerOpen(false)
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
                  />
                </div>

                {isAdmin ? (
                  <div
                    className={cn(
                      "flex min-w-0 flex-col gap-2 border-t border-black/[0.05] bg-neutral-50/70 px-3 py-2.5",
                      "sm:w-[11.5rem] sm:shrink-0 sm:border-t-0 sm:px-3 sm:py-3",
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {dayLockStats.dominant ? (
                      <p className="text-[11px] tracking-[-0.01em] text-neutral-500">
                        This day:{" "}
                        <span className="font-medium text-neutral-900">
                          {dayLockStats.dominant === "ap_exam"
                            ? "AP exam"
                            : dayLockStats.dominant === "holiday"
                              ? "Holiday"
                              : "General"}
                        </span>
                        {dayLockStats.locked > 0
                          ? ` · ${dayLockStats.locked} locked`
                          : null}
                      </p>
                    ) : (
                      <p className="text-[11px] tracking-[-0.01em] text-neutral-400">
                        Lock this day
                      </p>
                    )}

                    <div
                      role="radiogroup"
                      aria-label="Lock type"
                      className="grid min-w-0 grid-cols-3 gap-1 sm:grid-cols-1"
                    >
                      {LOCK_KINDS.map((opt) => {
                        const active = lockKind === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            title={opt.hint}
                            disabled={lockBusy !== null}
                            onClick={() =>
                              setLockKind((prev) =>
                                prev === opt.id ? null : opt.id,
                              )
                            }
                            className={cn(
                              "flex h-7 min-w-0 items-center justify-center truncate rounded-md border px-1.5",
                              "text-[11px] tracking-[-0.01em] transition-colors sm:h-8 sm:justify-start sm:text-[12px]",
                              active
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-black/[0.08] bg-white text-neutral-600 hover:border-black/[0.14]",
                              "disabled:opacity-40",
                              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                            )}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    <Input
                      type="text"
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          if (
                            lockKind &&
                            lockableCarts.length > 0 &&
                            !lockBusy
                          ) {
                            void applyDayLock("restrict")
                          }
                        }
                      }}
                      placeholder={
                        lockKind === "holiday"
                          ? "Note (Holiday)"
                          : "Note (optional)"
                      }
                      maxLength={120}
                      autoComplete="off"
                      disabled={lockBusy !== null || !lockKind}
                      className="h-7 rounded-md border-black/[0.08] bg-white text-[12px] shadow-none sm:h-8 sm:text-[13px]"
                    />

                    <button
                      type="button"
                      disabled={lockBusy !== null || !dayLockActionReady}
                      onClick={() => {
                        if (canUnlockDay) {
                          void applyDayLock("available")
                          return
                        }
                        if (!lockKind) {
                          toast({
                            title: "Choose a type",
                            description: "General, AP exam, or Holiday.",
                          })
                          return
                        }
                        if (lockableCarts.length === 0) {
                          toast({
                            title: "No carts",
                            description: "Add carts in Admin → Inventory.",
                            variant: "destructive",
                          })
                          return
                        }
                        void applyDayLock("restrict")
                      }}
                      className={cn(
                        "mt-auto inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md",
                        "text-[11px] tracking-[-0.01em] transition-colors sm:h-8 sm:text-[12px]",
                        canUnlockDay
                          ? "border border-black/[0.08] bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950"
                          : dayLockActionReady
                            ? "bg-neutral-900 text-white hover:bg-neutral-800"
                            : "bg-neutral-100 text-neutral-400",
                        "disabled:pointer-events-none disabled:opacity-40",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                      )}
                    >
                      {lockBusy !== null ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : canUnlockDay ? (
                        "Unlock"
                      ) : (
                        <>
                          <Lock className="size-3" strokeWidth={2} />
                          Lock
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
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
                className="mx-1.5 h-3.5 w-px shrink-0 bg-black/10"
              />
              <button
                type="button"
                onClick={() => setDate(today)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-normal tracking-[-0.02em] text-neutral-500",
                  "transition-colors duration-200 hover:bg-black/[0.04] hover:text-black",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                )}
              >
                Today
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-black/[0.05] bg-[#fafafa] px-4 py-2.5 sm:px-5">
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full border border-black/15 bg-white" />
          Open
        </span>
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full bg-black" />
          Yours
        </span>
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full bg-black/20" />
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
      <div className="board-scroll">
        <div className="board-track">
          <div className="board-cols grid bg-black">
            <div className="board-sticky-label flex items-center bg-black px-3 py-2.5 text-[10px] font-normal uppercase tracking-[0.18em] text-white/40 sm:px-5 sm:py-3">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center border-l border-white/[0.08] px-1.5 py-2.5 text-[10px] font-normal uppercase tracking-[0.18em] text-white/40 sm:px-2 sm:py-3"
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
                    const isMaintenance = cart.status === "maintenance"
                    const isRestricted = !!restriction
                    const restrictionTitle = restriction
                      ? restrictionLabel(restriction)
                      : "Restricted by admin"

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
                      const isInvolved = bookingInvolvesUser(
                        booking,
                        session.id,
                      )
                      const personName =
                        nameByTeacherId.get(booking.teacherId) ||
                        booking.teacherName
                      const avatarSrc =
                        avatarByTeacherId.get(booking.teacherId) ??
                        (booking.teacherId === session.id
                          ? session.avatarUrl
                          : undefined)
                      const shareName = booking.sharedWithId
                        ? nameByTeacherId.get(booking.sharedWithId) ||
                          booking.sharedWithName ||
                          "Shared"
                        : undefined
                      const shareSrc = booking.sharedWithId
                        ? (avatarByTeacherId.get(booking.sharedWithId) ??
                          (booking.sharedWithId === session.id
                            ? session.avatarUrl
                            : undefined) ??
                          booking.sharedWithAvatarUrl)
                        : undefined
                      const classLabel = booking.className?.trim()
                      // Anyone (teacher or admin) may request a swap on someone else's slot.
                      const isSwapTarget = !isInvolved
                      const hasPendingSwap =
                        isSwapTarget &&
                        platform.swapRequests.some(
                          (s) =>
                            s.status === "pending" &&
                            s.bookingId === booking.id &&
                            s.requesterId === session.id,
                        )
                      const shareBit = shareName
                        ? ` · shared with ${shareName}`
                        : ""
                      const title = isInvolved
                        ? `${classLabel || "Your booking"}${shareBit} — click to manage`
                        : hasPendingSwap
                          ? `${classLabel || personName} · ${personName}${shareBit} — swap pending`
                          : isAdmin
                            ? `${classLabel || personName} · ${personName}${shareBit} — swap or delete`
                            : `${classLabel || personName} · ${personName}${shareBit} — hover to swap`
                      const deleting = deletingBookingId === booking.id

                      return (
                        <div
                          key={period}
                          className={cn(
                            cellBase,
                            "group/slot relative items-center justify-center p-1.5",
                            isInvolved
                              ? "bg-[#211d1d] hover:bg-[#2a2525]"
                              : "bg-[#211d1d]/10 hover:bg-[#211d1d]/15",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onCellClick(cart, period)}
                            title={title}
                            aria-label={title}
                            disabled={deleting}
                            className={cn(
                              "absolute inset-0 flex items-center justify-center p-1.5",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                              isInvolved
                                ? "focus-visible:ring-white/20"
                                : "focus-visible:ring-[#211d1d]/20",
                              "disabled:pointer-events-none",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex transition-[opacity,transform] duration-150 ease-out",
                                isSwapTarget &&
                                  "group-hover/slot:opacity-30 group-focus-within/slot:opacity-30",
                              )}
                            >
                              <SlotPeople
                                primaryName={personName}
                                primarySrc={avatarSrc}
                                shareName={shareName}
                                shareSrc={shareSrc}
                                onDark={isInvolved}
                              />
                            </span>
                          </button>

                          {isSwapTarget ? (
                            <div
                              className={cn(
                                "absolute inset-0 z-[1] flex items-center justify-center gap-1",
                                "opacity-0 transition-opacity duration-150 ease-out",
                                "pointer-events-none group-hover/slot:pointer-events-auto group-hover/slot:opacity-100",
                                "group-focus-within/slot:pointer-events-auto group-focus-within/slot:opacity-100",
                              )}
                            >
                              <button
                                type="button"
                                title="Request swap"
                                aria-label={`Request swap for ${personName}`}
                                disabled={deleting}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCellClick(cart, period)
                                }}
                                className={cn(
                                  "flex size-8 items-center justify-center rounded-full sm:size-9",
                                  "bg-white/95 text-neutral-900 shadow-sm ring-1 ring-black/10",
                                  "transition-transform hover:scale-105 active:scale-95",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
                                  "disabled:opacity-50",
                                )}
                              >
                                <ArrowLeftRight
                                  className="size-3.5 sm:size-4"
                                  strokeWidth={1.75}
                                />
                              </button>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  title="Delete booking"
                                  aria-label={`Delete booking for ${personName}`}
                                  disabled={deleting}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void adminDeleteBooking(booking)
                                  }}
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full sm:size-9",
                                    "bg-white/95 text-red-600 shadow-sm ring-1 ring-black/10",
                                    "transition-transform hover:scale-105 hover:bg-red-50 active:scale-95",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25",
                                    "disabled:opacity-50",
                                  )}
                                >
                                  {deleting ? (
                                    <Loader2
                                      className="size-3.5 animate-spin sm:size-4"
                                      strokeWidth={1.75}
                                    />
                                  ) : (
                                    <Trash2
                                      className="size-3.5 sm:size-4"
                                      strokeWidth={1.75}
                                    />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
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
                            {restriction?.category === "ap_exam"
                              ? "AP"
                              : restriction?.category === "other" &&
                                  (restriction.reason ?? "")
                                    .toLowerCase()
                                    .includes("holiday")
                                ? "Off"
                                : "Locked"}
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
    </section>
  )
}
