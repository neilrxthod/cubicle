"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { format, parseISO, addDays } from "date-fns"
import type {
  Booking,
  BookingPolicy,
  Cart,
  Period,
  SessionUser,
  SlotRestriction,
} from "@/lib/types"
import {
  bookingHasShareInviteFor,
  bookingInvolvesUser,
  getBookingPurpose,
} from "@/lib/types"
import {
  bookingBoardTagText,
  canTeacherBookSlot,
  DEFAULT_ADMIN_MULTI_TAG,
} from "@/lib/booking/slot-rules"

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

import {
  acceptShareInvite,
  cancelBooking,
  createBooking,
  declineShareInvite,
  updateBookingLabel,
} from "@/lib/actions"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
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
  UserPlus,
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
  "flex min-h-14 min-w-0 border-l border-[var(--hairline)] motion-micro sm:min-h-16"

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
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(
    null,
  )
  const [shareInviteBusyId, setShareInviteBusyId] = useState<string | null>(
    null,
  )
  /** Admin multi-book: click open slots to book instantly. */
  const [multiMode, setMultiMode] = useState(false)
  const [multiTag, setMultiTag] = useState(DEFAULT_ADMIN_MULTI_TAG)
  const multiBusy = useRef(false)
  const [renamingBookingId, setRenamingBookingId] = useState<string | null>(
    null,
  )
  const [renameDraft, setRenameDraft] = useState("")
  const [renameBusy, setRenameBusy] = useState(false)
  /** Admin two-step delete: trash → confirm dialog → delete. */
  const [pendingDelete, setPendingDelete] = useState<{
    booking: Booking
    cartName: string
  } | null>(null)

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
      setPendingDelete(null)
      router.refresh()
    } finally {
      setDeletingBookingId(null)
    }
  }

  async function respondShareInvite(
    booking: Booking,
    action: "accept" | "decline",
  ) {
    if (shareInviteBusyId) return
    setShareInviteBusyId(booking.id)
    try {
      const res =
        action === "accept"
          ? await acceptShareInvite(booking.id)
          : await declineShareInvite(booking.id)
      if (res && "error" in res && res.error) {
        toast({
          title:
            action === "accept"
              ? "Could not accept share"
              : "Could not decline share",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title:
          action === "accept" ? "Share accepted" : "Share invite declined",
      })
      router.refresh()
    } finally {
      setShareInviteBusyId(null)
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
    const url = new URL(window.location.href)
    url.searchParams.set("date", next)
    router.push(url.pathname + url.search, { scroll: false })
  }

  function go(offsetDays: number) {
    const next = format(addDays(parseLocalYmd(date), offsetDays), "yyyy-MM-dd")
    setDate(next)
  }

  async function quickMultiBook(cart: Cart, period: Period) {
    if (multiBusy.current) return
    multiBusy.current = true
    try {
      const formData = new FormData()
      formData.set("cartId", cart.id)
      formData.set("date", date)
      formData.set("period", period)
      const tag = multiTag.trim() || DEFAULT_ADMIN_MULTI_TAG
      formData.set("className", tag)
      formData.set("subject", tag)
      const res = await createBooking(formData)
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not book",
          description: res.error,
          variant: "destructive",
        })
        router.refresh()
        return
      }
      // Quiet multi-book — no toast spam on every click.
      router.refresh()
    } finally {
      multiBusy.current = false
    }
  }

  async function commitTagRename(bookingId: string) {
    const next = renameDraft.trim()
    if (!next) {
      setRenamingBookingId(null)
      return
    }
    setRenameBusy(true)
    try {
      const res = await updateBookingLabel(bookingId, next)
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not rename tag",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      setMultiTag(next)
      setRenamingBookingId(null)
      router.refresh()
    } finally {
      setRenameBusy(false)
    }
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
      const check = canTeacherBookSlot({
        bookings,
        policy: bookingPolicy,
        userId: session.id,
        date,
        period,
      })
      if (!check.ok) {
        toast({
          title: "Limit reached",
          description: check.error,
          variant: "destructive",
        })
        return
      }
    }

    // Admin Multiple mode: book on every open-slot click (no dialog).
    if (isAdmin && multiMode) {
      void quickMultiBook(cart, period)
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
    "flex size-8 items-center justify-center rounded-full",
    "text-neutral-400 motion-micro",
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
          {/* Multi mode status — lives with the date, not the chrome */}
          {isAdmin && multiMode ? (
            <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] tracking-[-0.01em] text-neutral-500">
              <span>Click open slots to book</span>
              <span aria-hidden className="text-neutral-300">
                ·
              </span>
              <label className="inline-flex min-w-0 items-center gap-1">
                <span className="shrink-0 text-neutral-400">Tag</span>
                <input
                  type="text"
                  value={multiTag}
                  onChange={(e) => setMultiTag(e.target.value.slice(0, 18))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  }}
                  aria-label="Booking tag"
                  placeholder={DEFAULT_ADMIN_MULTI_TAG}
                  className={cn(
                    "min-w-[3rem] max-w-[7rem] border-0 bg-transparent p-0",
                    "text-[12px] font-medium tracking-[-0.01em] text-neutral-900",
                    "placeholder:font-normal placeholder:text-neutral-300",
                    "focus-visible:outline-none",
                    "underline decoration-neutral-200 underline-offset-4",
                    "focus-visible:decoration-neutral-900",
                  )}
                />
              </label>
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <label
                htmlFor="admin-multi-book"
                className={cn(
                  "cursor-pointer select-none text-[12.5px] tracking-[-0.015em]",
                  multiMode
                    ? "font-medium text-neutral-950"
                    : "font-normal text-neutral-500",
                )}
              >
                Multi
              </label>
              <Switch
                id="admin-multi-book"
                checked={multiMode}
                onCheckedChange={setMultiMode}
                aria-label="Multi-book mode"
                className={cn(
                  "h-[18px] w-[32px] shadow-none",
                  "data-[state=checked]:bg-neutral-950 data-[state=unchecked]:bg-neutral-200/90",
                  "[&_[data-slot=switch-thumb]]:size-[14px] [&_[data-slot=switch-thumb]]:shadow-none",
                  "data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-[14px]",
                  "data-[state=unchecked]:[&_[data-slot=switch-thumb]]:translate-x-[2px]",
                )}
              />
            </div>
          ) : null}

          {isAdmin ? (
            <span
              aria-hidden
              className="hidden h-4 w-px shrink-0 bg-black/10 sm:block"
            />
          ) : null}

          <div
            role="group"
            aria-label="Change board date"
            className="flex items-center gap-0.5"
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
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5",
                  "border border-black/[0.08] bg-white",
                  "text-[12px] font-medium tabular-nums tracking-[-0.02em] text-neutral-900",
                  "transition-colors duration-150",
                  "hover:bg-neutral-50",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/12",
                  "data-[state=open]:border-neutral-900 data-[state=open]:bg-neutral-900 data-[state=open]:text-white",
                )}
              >
                <CalendarIcon
                  className={cn(
                    "size-3 shrink-0",
                    datePickerOpen ? "text-white/55" : "text-neutral-400",
                  )}
                  strokeWidth={1.5}
                />
                <span>{format(parseLocalYmd(date), "MMM d")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                "z-[60] w-auto max-w-[calc(100vw-1.25rem)] overflow-hidden p-0",
                "rounded-2xl border border-black/[0.08] bg-white",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.1)]",
              )}
              align="end"
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
              avoidCollisions
            >
              <Calendar
                mode="single"
                selected={parseLocalYmd(date)}
                defaultMonth={parseLocalYmd(date)}
                onSelect={(val) => {
                  if (!val) return
                  setDate(format(val, "yyyy-MM-dd"))
                  setDatePickerOpen(false)
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
            <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
              <p className="text-[13px] font-medium tracking-[-0.02em] text-neutral-900">
                No carts configured
              </p>
              <p className="mt-1.5 max-w-[18rem] text-[12px] leading-relaxed tracking-[-0.01em] text-neutral-500">
                {session.role === "admin"
                  ? "Add laptop carts in Inventory to open the schedule for booking."
                  : "The schedule opens once an administrator adds laptop carts."}
              </p>
              {session.role === "admin" ? (
                <Link
                  href="/admin"
                  className={cn(
                    "mt-5 inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3.5",
                    "text-[12px] font-medium tracking-[-0.01em] text-white",
                    "transition-colors hover:bg-neutral-800",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                  )}
                >
                  Open Inventory
                </Link>
              ) : null}
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
                      const inviteForMe = bookingHasShareInviteFor(
                        booking,
                        session.id,
                      )
                      const invitePendingName = booking.sharePendingId
                        ? nameByTeacherId.get(booking.sharePendingId) ||
                          booking.sharePendingName ||
                          "Colleague"
                        : undefined
                      const classLabel = booking.className?.trim()
                      const purpose = getBookingPurpose(booking)
                      const purposeTag = purpose?.tag
                      const boardTag = bookingBoardTagText(
                        booking,
                        purposeTag ?? null,
                      )
                      const canRenameTag =
                        isAdmin &&
                        (booking.teacherId === session.id || multiMode)
                      const isRenaming = renamingBookingId === booking.id
                      // Anyone (teacher or admin) may request a swap on someone else's slot.
                      const isSwapTarget = !isInvolved && !inviteForMe
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
                        : invitePendingName
                          ? inviteForMe
                            ? " · share invite for you"
                            : ` · invite pending (${invitePendingName})`
                          : ""
                      const purposeBit =
                        purpose && purpose.id !== "class"
                          ? ` · ${purpose.label}`
                          : ""
                      const title = inviteForMe
                        ? `${personName} invited you to share this cart`
                        : isInvolved
                          ? `${classLabel || "Your booking"}${purposeBit}${shareBit} — click to manage`
                          : hasPendingSwap
                            ? `${classLabel || personName} · ${personName}${purposeBit}${shareBit} — swap pending`
                            : isAdmin
                              ? `${classLabel || personName} · ${personName}${purposeBit}${shareBit} — swap or delete`
                              : `${classLabel || personName} · ${personName}${purposeBit}${shareBit} — hover to swap`
                      const deleting = deletingBookingId === booking.id
                      const inviteBusy = shareInviteBusyId === booking.id

                      return (
                        <div
                          key={period}
                          className={cn(
                            cellBase,
                            "group/slot relative items-center justify-center p-1.5",
                            isInvolved || inviteForMe
                              ? "bg-[#211d1d] hover:bg-[#2a2525]"
                              : "bg-[#211d1d]/10 hover:bg-[#211d1d]/15",
                          )}
                        >
                          {boardTag ? (
                            isRenaming ? (
                              <input
                                autoFocus
                                value={renameDraft}
                                disabled={renameBusy}
                                maxLength={24}
                                onChange={(e) =>
                                  setRenameDraft(e.target.value)
                                }
                                onBlur={() => {
                                  void commitTagRename(booking.id)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    void commitTagRename(booking.id)
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault()
                                    setRenamingBookingId(null)
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "absolute top-0.5 right-0.5 z-[3] h-5 w-[4.5rem] rounded px-1",
                                  "border border-white/30 bg-neutral-950 text-[9px] font-semibold uppercase",
                                  "tracking-[0.04em] text-white shadow-sm",
                                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                                )}
                              />
                            ) : (
                              <span
                                role={canRenameTag ? "button" : undefined}
                                tabIndex={canRenameTag ? 0 : undefined}
                                title={
                                  canRenameTag
                                    ? "Double-click to rename tag"
                                    : boardTag
                                }
                                onDoubleClick={(e) => {
                                  if (!canRenameTag) return
                                  e.stopPropagation()
                                  e.preventDefault()
                                  setRenameDraft(boardTag)
                                  setRenamingBookingId(booking.id)
                                }}
                                onKeyDown={(e) => {
                                  if (!canRenameTag) return
                                  if (e.key === "Enter" || e.key === "F2") {
                                    e.stopPropagation()
                                    setRenameDraft(boardTag)
                                    setRenamingBookingId(booking.id)
                                  }
                                }}
                                className={cn(
                                  "absolute top-1 right-1 z-[2]",
                                  "rounded px-1 py-px text-[8.5px] font-semibold uppercase tracking-[0.04em]",
                                  canRenameTag
                                    ? "cursor-text select-none"
                                    : "pointer-events-none",
                                  purpose?.tag
                                    ? isInvolved || inviteForMe
                                      ? purpose.tagClassOnDark
                                      : purpose.tagClass
                                    : isInvolved || inviteForMe
                                      ? "bg-white/15 text-white"
                                      : "bg-neutral-700 text-white",
                                )}
                              >
                                {boardTag}
                              </span>
                            )
                          ) : null}

                          {/* Share invite for you — same slot look + Accept / Decline */}
                          {inviteForMe ? (
                            <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 p-1">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Decline"
                                  aria-label="Decline share invite"
                                  disabled={inviteBusy}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void respondShareInvite(booking, "decline")
                                  }}
                                  className={cn(
                                    "h-7 rounded-full px-2.5 text-[10.5px] font-medium",
                                    "bg-white/95 text-neutral-700 shadow-sm ring-1 ring-black/10",
                                    "hover:bg-neutral-100 disabled:opacity-50",
                                  )}
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  title="Accept"
                                  aria-label="Accept share invite"
                                  disabled={inviteBusy}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void respondShareInvite(booking, "accept")
                                  }}
                                  className={cn(
                                    "h-7 rounded-full px-2.5 text-[10.5px] font-medium",
                                    "bg-white text-neutral-950 shadow-sm ring-1 ring-black/10",
                                    "hover:bg-neutral-100 disabled:opacity-50",
                                  )}
                                >
                                  {inviteBusy ? (
                                    <Loader2
                                      className="size-3.5 animate-spin"
                                      strokeWidth={2}
                                    />
                                  ) : (
                                    "Accept"
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {/* Owner: pending invite indicator */}
                          {!inviteForMe &&
                          booking.sharePendingId &&
                          booking.teacherId === session.id ? (
                            <span
                              title={`Invite pending: ${invitePendingName}`}
                              className={cn(
                                "pointer-events-none absolute bottom-1 left-1 z-[2]",
                                "flex size-5 items-center justify-center rounded-full",
                                "bg-sky-500/90 text-white ring-1 ring-white/25",
                              )}
                            >
                              <UserPlus className="size-3" strokeWidth={2} />
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => onCellClick(cart, period)}
                            title={title}
                            aria-label={title}
                            disabled={deleting || inviteForMe}
                            className={cn(
                              "absolute inset-0 flex items-center justify-center p-1.5",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                              isInvolved
                                ? "focus-visible:ring-white/20"
                                : "focus-visible:ring-[#211d1d]/20",
                              "disabled:pointer-events-none",
                              inviteForMe && "opacity-40",
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
                                onDark={isInvolved || inviteForMe}
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
                                    setPendingDelete({
                                      booking,
                                      cartName: cart.name,
                                    })
                                  }}
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full sm:size-9",
                                    "bg-white/95 text-red-600 shadow-sm ring-1 ring-black/10",
                                    "transition-transform hover:scale-105 hover:bg-red-50 active:scale-95",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25",
                                    "disabled:opacity-50",
                                  )}
                                >
                                  <Trash2
                                    className="size-3.5 sm:size-4"
                                    strokeWidth={1.75}
                                  />
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
                        title={
                          multiMode && isAdmin
                            ? `Book as “${multiTag.trim() || DEFAULT_ADMIN_MULTI_TAG}”`
                            : "Book this slot"
                        }
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

      {/* Admin two-step delete: trash → confirm → remove */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingBookingId) setPendingDelete(null)
        }}
      >
        <DialogContent
          showCloseButton={!deletingBookingId}
          className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm"
        >
          <DialogHeader className="space-y-1.5 px-5 pt-5 pb-0 text-left">
            <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
              Delete this booking?
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed text-neutral-500">
              {pendingDelete ? (
                <>
                  Removes{" "}
                  <span className="font-medium text-neutral-800">
                    {nameByTeacherId.get(pendingDelete.booking.teacherId) ||
                      pendingDelete.booking.teacherName}
                  </span>
                  ’s reservation for{" "}
                  <span className="font-medium text-neutral-800">
                    {pendingDelete.cartName}
                  </span>{" "}
                  · {pendingDelete.booking.period}. This cannot be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-3 px-5 py-5 sm:space-x-0">
            <button
              type="button"
              disabled={Boolean(deletingBookingId)}
              onClick={() => setPendingDelete(null)}
              className="h-9 px-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-900 disabled:opacity-40"
            >
              Keep booking
            </button>
            <button
              type="button"
              disabled={Boolean(deletingBookingId) || !pendingDelete}
              onClick={() => {
                if (!pendingDelete) return
                void adminDeleteBooking(pendingDelete.booking)
              }}
              className={cn(
                "inline-flex h-9 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg px-4",
                "bg-red-600 text-[13px] font-medium text-white",
                "transition-colors hover:bg-red-700",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {deletingBookingId ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                "Delete booking"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
