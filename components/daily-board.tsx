"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { format, parseISO, addDays } from "date-fns"
import { AnimatePresence, motion } from "motion/react"
import { motionSafe, transitionSoft } from "@/lib/motion/platform"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type Modifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  getRestrictionType,
  sortCarts,
  type Booking,
  type BookingPolicy,
  type Cart,
  type Period,
  type SessionUser,
  type SlotRestriction,
} from "@/lib/types"
import {
  bookingHasShareInviteFor,
  bookingInvolvesUser,
  getBookingPurpose,
} from "@/lib/types"
import {
  bookingBoardTagText,
  bookingClassLabel,
  canTeacherBookSlot,
  isGenericClassValue,
  slotLimitNoticeFromError,
  DEFAULT_ADMIN_MULTI_TAG,
  type SlotLimitNotice,
} from "@/lib/booking/slot-rules"

function restrictionLabel(restriction: SlotRestriction): string {
  const reason = restriction.reason?.trim()
  if (reason) return reason
  return getRestrictionType(restriction.category).label
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
const BookingLimitDialog = dynamic(
  () =>
    import("./booking-limit-dialog").then((mod) => mod.BookingLimitDialog),
  { ssr: false },
)

import {
  acceptShareInvite,
  cancelBooking,
  createBooking,
  declineShareInvite,
  reorderCarts,
  updateBookingLabel,
} from "@/lib/actions"
import { BoardBlockDialog } from "@/components/board-block-dialog"
import {
  Calendar,
  calendarPopoverClassName,
} from "@/components/ui/calendar"
import {
  Dialog,
  DialogCancel,
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
  GripVertical,
  Wrench,
  AlertTriangle,
  Lock,
  Loader2,
  Trash2,
  UserPlus,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  holdInviteBusy,
  inviteChipAcceptClassName,
  inviteChipDeclineClassName,
} from "@/lib/ui/invite-actions"
import { usePlatformStore } from "@/lib/data/platform-store"
import { useUserPresence } from "@/lib/staff/presence"
import { PresenceDot } from "@/components/presence-dot"
import { CartBrandMark } from "@/components/admin/laptop-brand-toggle"
import { InviteActionBusy } from "@/components/ui/invite-action-busy"

const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

/** Apple-like settle: short, soft deceleration into place. */
const CART_DROP_ANIMATION: DropAnimation = {
  duration: 280,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.2",
      },
    },
  }),
}

/**
 * Clamp drag so the row stays inside the cart list only —
 * never over the period header above.
 */
function createRestrictToElement(
  getElement: () => HTMLElement | null,
): Modifier {
  return ({ transform, draggingNodeRect }) => {
    const bounds = getElement()?.getBoundingClientRect()
    if (!bounds || !draggingNodeRect) {
      return { ...transform, x: 0 }
    }

    let { y } = transform
    // Top of dragged row must stay ≥ list top (below period header)
    const minY = bounds.top - draggingNodeRect.top
    // Bottom of dragged row must stay ≤ list bottom
    const maxY = bounds.bottom - draggingNodeRect.bottom

    if (minY > maxY) {
      // Row taller than list — pin to top edge of list
      y = minY
    } else {
      y = Math.min(Math.max(y, minY), maxY)
    }

    return {
      ...transform,
      x: 0,
      y,
    }
  }
}

/** Parse yyyy-MM-dd as local calendar day (no UTC shift). */
function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

/**
 * Period cell: 1px white strip around each slot (all sides).
 * Fill sits in the inner face.
 */
const cellBase =
  "box-border flex min-h-[3.25rem] min-w-0 border-l border-[var(--hairline)] bg-white p-[3px] motion-micro sm:min-h-[3.75rem]"

/** Slot fill inside the white strip. */
const slotFace =
  "relative flex h-full w-full min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[5px]"

function slotTagClassName(input: {
  canRename: boolean
  purposeTag?: string | null
  tagText: string
  onDark: boolean
  purposeTagClass?: string
  purposeTagClassOnDark?: string
}) {
  const placeholder = isGenericClassValue(input.tagText)
  return cn(
    "absolute top-1 right-1 z-[3] max-w-[calc(100%-6px)]",
    "rounded px-1 py-px text-[8.5px] font-semibold tracking-[0.04em]",
    "whitespace-nowrap",
    placeholder ? "normal-case" : "uppercase",
    input.canRename ? "cursor-text select-none" : "pointer-events-none",
    input.purposeTag
      ? input.onDark
        ? input.purposeTagClassOnDark
        : input.purposeTagClass
      : input.onDark
        ? "bg-white/30 text-white"
        : "bg-neutral-700 text-white",
  )
}

/** Paused cart — pale system-yellow wash, not a saturated fill. */
const pausedSlotFill = "bg-[#fff6e0] text-amber-400/80"

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
  userId,
}: {
  name: string
  src?: string | null
  /** Initials contrast on solid black vs translucent cells */
  onDark?: boolean
  /** Compact size for dual-share stack */
  stacked?: boolean
  className?: string
  userId?: string
}) {
  const presence = useUserPresence(userId)
  const sizeClass = stacked ? SLOT_AVATAR_STACK : SLOT_AVATAR
  const face = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      draggable={false}
      className={cn(
        sizeClass,
        stacked && (onDark ? "ring-white/25" : "ring-white"),
      )}
    />
  ) : (
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
      )}
    >
      {slotInitials(name)}
    </span>
  )

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {face}
      <PresenceDot
        status={presence}
        size={stacked ? "sm" : "md"}
        className={onDark ? "ring-neutral-950" : undefined}
      />
    </span>
  )
}

/** Owner + optional co-teacher (share/borrow) faces. */
function SlotPeople({
  primaryName,
  primarySrc,
  primaryId,
  shareName,
  shareSrc,
  shareId,
  onDark,
}: {
  primaryName: string
  primarySrc?: string | null
  primaryId?: string
  shareName?: string
  shareSrc?: string | null
  shareId?: string
  onDark?: boolean
}) {
  if (!shareName) {
    return (
      <SlotPfp
        name={primaryName}
        src={primarySrc}
        onDark={onDark}
        userId={primaryId}
      />
    )
  }
  return (
    <span className="relative inline-flex items-center pr-2">
      <SlotPfp
        name={primaryName}
        src={primarySrc}
        onDark={onDark}
        stacked
        userId={primaryId}
        className="relative z-[1]"
      />
      <SlotPfp
        name={shareName}
        src={shareSrc}
        onDark={onDark}
        stacked
        userId={shareId}
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
  compact = false,
}: {
  session: SessionUser
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
  date: string
  /** Phone landscape — one-line chrome, no legend. */
  compact?: boolean
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
  const [bookingSlotKey, setBookingSlotKey] = useState<string | null>(null)
  const [issueDialog, setIssueDialog] = useState<Cart | null>(null)
  const [swapDialog, setSwapDialog] = useState<Booking | null>(null)
  const [manageDialog, setManageDialog] = useState<Booking | null>(null)
  const [slotLimit, setSlotLimit] = useState<SlotLimitNotice | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => parseLocalYmd(date))
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(
    null,
  )
  const [shareInviteBusy, setShareInviteBusy] = useState<{
    id: string
    action: "accept" | "decline"
  } | null>(null)
  /** Admin multi-book: click open slots to book instantly. */
  const [multiMode, setMultiMode] = useState(false)
  const [multiTag, setMultiTag] = useState(DEFAULT_ADMIN_MULTI_TAG)
  const multiBusy = useRef(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
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

  /** Admin board order — dnd-kit sortable (handle-only). */
  const [boardCarts, setBoardCarts] = useState(() => sortCarts(carts))
  const boardCartsRef = useRef(boardCarts)
  /** Cart rows only (excludes period header). */
  const [cartListEl, setCartListEl] = useState<HTMLDivElement | null>(null)
  const orderAtDragStart = useRef<string>("")
  const cartsAtDragStart = useRef<Cart[]>([])
  const [activeCartId, setActiveCartId] = useState<string | null>(null)
  /** Live DOM clone of the real board row (full periods UI) for DragOverlay. */
  const [overlaySnapshot, setOverlaySnapshot] = useState<{
    html: string
    width: number
    height: number
  } | null>(null)
  const [reorderBusy, setReorderBusy] = useState(false)
  const isReordering = Boolean(activeCartId) || reorderBusy

  const cartIds = useMemo(
    () => boardCarts.map((c) => c.id),
    [boardCarts],
  )

  /** No horizontal drag; never cross the black Cart/P1–P5 header. */
  const cartDndModifiers = useMemo(
    () => [restrictToVerticalAxis, createRestrictToElement(() => cartListEl)],
    [cartListEl],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Intentional drag — won’t fight report / book clicks
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    boardCartsRef.current = boardCarts
  }, [boardCarts])

  const incomingCarts = useMemo(() => sortCarts(carts), [carts])
  const incomingCartKey = incomingCarts
    .map((cart) => `${cart.id}:${cart.name}:${cart.sortOrder ?? ""}`)
    .join("|")
  const [syncedCartKey, setSyncedCartKey] = useState(incomingCartKey)
  if (!activeCartId && !reorderBusy && incomingCartKey !== syncedCartKey) {
    setSyncedCartKey(incomingCartKey)
    setBoardCarts(incomingCarts)
  }

  async function persistCartOrder(next: Cart[]) {
    const ids = next.map((c) => c.id)
    const started = orderAtDragStart.current
    if (!started || ids.join("\0") === started) return

    setReorderBusy(true)
    try {
      const res = await reorderCarts(ids)
      if (res && "error" in res && res.error) {
        setBoardCarts(cartsAtDragStart.current)
        toast({
          title: "Could not reorder carts",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      router.refresh()
    } finally {
      setReorderBusy(false)
      orderAtDragStart.current = ""
      cartsAtDragStart.current = []
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    cartsAtDragStart.current = boardCartsRef.current
    orderAtDragStart.current = boardCartsRef.current.map((c) => c.id).join("\0")

    // Snapshot the real row UI *before* React dims the source placeholder.
    const safeId = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const node = document.querySelector(
      `[data-cart-row="${safeId}"]`,
    ) as HTMLElement | null
    if (node) {
      const rect = node.getBoundingClientRect()
      const clone = node.cloneNode(true) as HTMLElement
      clone.removeAttribute("data-cart-row")
      clone.style.cssText = [
        "width:100%",
        "height:100%",
        "transform:none",
        "opacity:1",
        "transition:none",
        "pointer-events:none",
        "box-shadow:none",
        "outline:none",
      ].join(";")
      // Undo any drag-state styling that might already be on children
      clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.style.opacity) el.style.opacity = "1"
      })
      // Grip must not flash black in the floating clone
      const grip = clone.querySelector(
        "[data-drag-handle]",
      ) as HTMLElement | null
      if (grip) {
        grip.style.background = "transparent"
        grip.style.color = "#737373"
        grip.style.boxShadow = "none"
        grip.style.transform = "none"
        grip.style.transition = "none"
      }
      setOverlaySnapshot({
        html: clone.outerHTML,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    } else {
      setOverlaySnapshot(null)
    }

    setActiveCartId(id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCartId(null)
    setOverlaySnapshot(null)

    if (!over || active.id === over.id) {
      orderAtDragStart.current = ""
      cartsAtDragStart.current = []
      return
    }

    const oldIndex = boardCartsRef.current.findIndex((c) => c.id === active.id)
    const newIndex = boardCartsRef.current.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      orderAtDragStart.current = ""
      cartsAtDragStart.current = []
      return
    }

    const next = arrayMove(boardCartsRef.current, oldIndex, newIndex)
    boardCartsRef.current = next
    setBoardCarts(next)
    void persistCartOrder(next)
  }

  function handleDragCancel() {
    setActiveCartId(null)
    setOverlaySnapshot(null)
    orderAtDragStart.current = ""
    cartsAtDragStart.current = []
  }

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
    if (shareInviteBusy) return
    setShareInviteBusy({ id: booking.id, action })
    const startedAt = Date.now()
    try {
      const res =
        action === "accept"
          ? await acceptShareInvite(booking.id)
          : await declineShareInvite(booking.id)
      if (res && "error" in res && res.error) {
        const limit = slotLimitNoticeFromError(res.error)
        if (limit) {
          setSlotLimit(limit)
          return
        }
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
      await holdInviteBusy(startedAt)
      setShareInviteBusy(null)
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
    setCalendarMonth(parseLocalYmd(next))
    router.push(url.pathname + url.search, { scroll: false })
  }

  function go(offsetDays: number) {
    const next = format(addDays(parseLocalYmd(date), offsetDays), "yyyy-MM-dd")
    setDate(next)
  }

  async function quickMultiBook(cart: Cart, period: Period) {
    if (multiBusy.current) return
    multiBusy.current = true
    const key = `${cart.id}:${period}`
    setBookingSlotKey(key)
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
      setBookingSlotKey(null)
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
      const kind = getRestrictionType(restriction.category)
      toast({
        title: kind.label,
        description: restriction.reason ?? "Locked by admin.",
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
        setSlotLimit(check.limit)
        return
      }
    }

    // Admin Multiple mode: book on every open-slot click (no dialog).
    if (isAdmin && multiMode) {
      void quickMultiBook(cart, period)
      return
    }

    setBookingSlotKey(`${cart.id}:${period}`)
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
    "inline-flex items-center gap-1.5 text-[11px] font-normal tracking-[-0.01em] text-neutral-400"

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]",
        compact && "flex h-full min-h-0 flex-col",
      )}
    >
      {/* ── Toolbar ── */}
      <div
        className={cn(
          "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5",
          compact && "flex-row items-center justify-between gap-3 px-3 py-2",
        )}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={date}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={motionSafe(transitionSoft)}
                className={cn(
                  "truncate font-light leading-none tracking-[-0.03em] text-neutral-950",
                  compact ? "text-[16px]" : "text-[20px]",
                )}
              >
                {heading}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {isViewingToday ? (
                <motion.span
                  key="today-pill"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={motionSafe(transitionSoft)}
                  className="inline-flex h-5 shrink-0 origin-left items-center rounded-full bg-neutral-950 px-2 text-[11px] font-light tracking-[-0.01em] text-white"
                >
                  Today
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          {session.role !== "admin" && date >= today && !compact ? (
            <p className="mt-1.5 text-[13px] font-light tracking-[-0.016em] text-neutral-400">
              Booking through {format(parseISO(lastBookableDate), "MMM d")}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
          {isAdmin ? (
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="admin-multi-book"
                className={cn(
                  "cursor-pointer select-none text-[15px] tracking-[-0.022em]",
                  multiMode ? "text-neutral-950" : "text-[#8e8e93]",
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
                  "h-[22px] w-[38px] shadow-none",
                  "data-[state=checked]:bg-neutral-950 data-[state=unchecked]:bg-[#e5e5ea]",
                  "[&_[data-slot=switch-thumb]]:size-[18px] [&_[data-slot=switch-thumb]]:shadow-none",
                  "data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-[16px]",
                  "data-[state=unchecked]:[&_[data-slot=switch-thumb]]:translate-x-[2px]",
                )}
              />
              <AnimatePresence initial={false}>
                {multiMode ? (
                  <motion.input
                    key="multi-tag"
                    type="text"
                    value={multiTag}
                    onChange={(e) =>
                      setMultiTag(e.target.value.slice(0, 18))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur()
                    }}
                    aria-label="Booking tag"
                    placeholder="Tag"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={motionSafe(transitionSoft)}
                    className={cn(
                      "h-8 w-[7.25rem] rounded-[8px] border-0 bg-[#f2f2f7] px-2.5",
                      "text-[15px] tracking-[-0.022em] text-neutral-950",
                      "placeholder:text-[#8e8e93]",
                      "outline-none focus-visible:bg-[#e8e8ed]",
                    )}
                  />
                ) : null}
              </AnimatePresence>

              <span
                aria-hidden
                className="hidden h-4 w-px shrink-0 bg-[var(--hairline-strong)] sm:block"
              />

              <button
                type="button"
                onClick={() => setBlockDialogOpen(true)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5",
                  "text-[12px] font-medium tracking-[-0.02em] text-neutral-600",
                  "transition-[background-color,color,box-shadow] duration-150 ease-out",
                  "hover:bg-neutral-950 hover:text-white hover:shadow-[0_3px_10px_rgba(0,0,0,0.16)]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                )}
              >
                <Lock className="size-3" strokeWidth={1.75} />
                Block
              </button>
            </div>
          ) : null}

          {isAdmin ? (
            <span
              aria-hidden
              className="hidden h-4 w-px shrink-0 bg-[var(--hairline-strong)] sm:block"
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
                  "border border-[var(--hairline-strong)] bg-white",
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
              className={calendarPopoverClassName}
              align="end"
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
              avoidCollisions
              onFocusOutside={(event) => event.preventDefault()}
            >
              <Calendar
                mode="single"
                selected={parseLocalYmd(date)}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onSelect={(val) => {
                  if (!val) return
                  setDate(format(val, "yyyy-MM-dd"))
                  setCalendarMonth(val)
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

          <AnimatePresence initial={false}>
            {!isViewingToday ? (
              <motion.span
                key="jump-today"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={motionSafe(transitionSoft)}
                className="flex overflow-hidden"
              >
                <span
                  aria-hidden
                  className="mx-1.5 h-3.5 w-px shrink-0 self-center bg-[var(--hairline-strong)]"
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
              </motion.span>
            ) : null}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--hairline)] px-4 pb-3 sm:px-5",
          compact && "hidden",
        )}
      >
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full border border-neutral-300 bg-white" />
          Open
        </span>
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full bg-neutral-950" />
          Yours
        </span>
        <span className={legendItem}>
          <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" />
          Booked
        </span>
        <span className={legendItem}>
          <Lock className="size-2.5 shrink-0 text-neutral-400" strokeWidth={1.5} />
          Restricted
        </span>
        <span className={legendItem}>
          <Wrench className="size-2.5 shrink-0 text-neutral-400" strokeWidth={1.5} />
          Paused
        </span>
      </div>

      {/* ── Period grid ── */}
      <div
        className={cn("board-scroll", compact && "min-h-0 flex-1 overflow-y-auto")}
        data-reordering={isReordering ? "true" : undefined}
      >
        <div
          className="board-track"
          data-reordering={isReordering ? "true" : undefined}
        >
          <div className="board-cols grid border-b border-neutral-950 bg-neutral-950">
            <div className="board-sticky-label flex items-center bg-neutral-950 px-3 py-2 text-[11px] font-medium tracking-[-0.01em] text-white/70 sm:px-4">
              Cart
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex items-center justify-center border-l border-white/10 px-1.5 py-2 text-[11px] font-medium tabular-nums tracking-[-0.01em] text-white/70 sm:px-2"
              >
                {p}
              </div>
            ))}
          </div>

          {carts.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
              <p className="text-[13.5px] font-medium tracking-[-0.02em] text-neutral-950">
                No carts configured
              </p>
              <p className="mt-1.5 max-w-[18rem] text-[12.5px] leading-relaxed tracking-[-0.01em] text-neutral-400">
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

          <div className="relative">
            {isAdmin ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={cartDndModifiers}
                measuring={{
                  // Avoid continuous remeasure thrash during rapid pointer moves
                  droppable: { strategy: MeasuringStrategy.BeforeDragging },
                }}
                autoScroll={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={cartIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    ref={setCartListEl}
                    className="relative isolate"
                    data-cart-list
                  >
                  {boardCarts.map((cart) => {
                  const isMaintenanceRow = cart.status === "maintenance"
                  return (
                    <SortableBoardCartRow
                      key={cart.id}
                      cart={cart}
                      disabled={reorderBusy}
                      isMaintenanceRow={isMaintenanceRow}
                      onReportIssue={() => setIssueDialog(cart)}
                    >
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
                        <div key={period} className={cellBase}>
                          <div
                            title="Cart paused — not bookable"
                            className={cn(slotFace, pausedSlotFill)}
                          >
                            <Wrench className="size-3.5" strokeWidth={1.25} />
                          </div>
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
                      const inviteForMe =
                        bookingHasShareInviteFor(booking, session.id) ||
                        shareInviteBusy?.id === booking.id
                      const invitePendingName = booking.sharePendingId
                        ? nameByTeacherId.get(booking.sharePendingId) ||
                          booking.sharePendingName ||
                          "Colleague"
                        : undefined
                      const classLabel = bookingClassLabel(booking)
                      const titleClass = isGenericClassValue(
                        booking.className ?? booking.subject,
                      )
                        ? ""
                        : classLabel
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
                          ? `${titleClass || "Your booking"}${purposeBit}${shareBit} — click to manage`
                          : hasPendingSwap
                            ? `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — swap pending`
                            : isAdmin
                              ? `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — swap or delete`
                              : `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — hover to swap`
                      const deleting = deletingBookingId === booking.id
                      const inviteBusy =
                        shareInviteBusy?.id === booking.id
                          ? shareInviteBusy.action
                          : null

                      return (
                        <div key={period} className={cellBase}>
                        <div
                          className={cn(
                            slotFace,
                            "group/slot",
                            isInvolved || inviteForMe
                              ? "bg-neutral-950 hover:bg-neutral-900"
                              : "bg-neutral-950/[0.07] hover:bg-neutral-950/[0.11]",
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
                                className={slotTagClassName({
                                  canRename: canRenameTag,
                                  purposeTag: purpose?.tag,
                                  tagText: boardTag,
                                  onDark: isInvolved || inviteForMe,
                                  purposeTagClass: purpose?.tagClass,
                                  purposeTagClassOnDark: purpose?.tagClassOnDark,
                                })}
                              >
                                {boardTag}
                              </span>
                            )
                          ) : null}

                          {/* Share invite for you — same slot look + Accept / Decline */}
                          {inviteForMe ? (
                            <ShareInviteSlotActions
                              busy={inviteBusy}
                              onDecline={() =>
                                void respondShareInvite(booking, "decline")
                              }
                              onAccept={() =>
                                void respondShareInvite(booking, "accept")
                              }
                            />
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
                                : "focus-visible:ring-neutral-900/20",
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
                                primaryId={booking.teacherId}
                                shareName={shareName}
                                shareSrc={shareSrc}
                                shareId={booking.sharedWithId}
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
                        </div>
                      )
                    }

                    if (isRestricted && session.role !== "admin") {
                      return (
                        <div key={period} className={cellBase}>
                          <div
                            title={restrictionTitle}
                            className={cn(
                              slotFace,
                              "flex-col gap-1 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.03)_3px,rgba(0,0,0,0.03)_4px)] text-neutral-400",
                            )}
                          >
                            <Lock className="size-3" strokeWidth={1.25} />
                            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                              {restriction
                                ? getRestrictionType(restriction.category).tag
                                : "Locked"}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    if (isRestricted && session.role === "admin") {
                      return (
                        <div key={period} className={cellBase}>
                          <button
                            type="button"
                            onClick={() => onCellClick(cart, period)}
                            title={`${restrictionTitle} — admins can still book`}
                            className={cn(
                              slotFace,
                              "flex-col gap-1",
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
                        </div>
                      )
                    }

                    if (!canBookOpenSlots) {
                      return (
                        <div key={period} className={cellBase}>
                          <div
                            title={
                              isPastDate
                                ? "Past date — cannot book"
                                : "Outside booking window"
                            }
                            className={cn(
                              slotFace,
                              "bg-neutral-50/80 text-neutral-200",
                            )}
                          >
                            <span className="text-[11px] font-light">—</span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={period} className={cellBase}>
                        <OpenSlotBookButton
                          busy={bookingSlotKey === `${cart.id}:${period}`}
                          blocked={bookingSlotKey !== null}
                          multiLabel={
                            multiMode && isAdmin
                              ? `Book as “${multiTag.trim() || DEFAULT_ADMIN_MULTI_TAG}”`
                              : undefined
                          }
                          onBook={() => onCellClick(cart, period)}
                        />
                      </div>
                    )
                  })}
                    </SortableBoardCartRow>
                  )
                })}
                  </div>
                </SortableContext>
                {/*
                  Portal outside the board card so overflow-hidden + rounded-2xl
                  (and board-scroll) cannot clip the floating row into soft
                  bottom corners when it hits the last-card vertical limit.
                */}
                {typeof document !== "undefined"
                  ? createPortal(
                      <DragOverlay
                        dropAnimation={CART_DROP_ANIMATION}
                        zIndex={1000}
                        style={{ overflow: "visible" }}
                      >
                        {overlaySnapshot ? (
                          <BoardCartRowDragOverlay snapshot={overlaySnapshot} />
                        ) : null}
                      </DragOverlay>,
                      document.body,
                    )
                  : null}
              </DndContext>
            ) : (
              boardCarts.map((cart) => {
                const isMaintenanceRow = cart.status === "maintenance"
                return (
                  <div
                    key={cart.id}
                    data-cart-row={cart.id}
                    className={cn(
                      "board-cols group/row grid border-b border-[var(--hairline)] last:border-b-0",
                      isMaintenanceRow ? "bg-neutral-50/70" : "bg-white",
                    )}
                  >
                    <div
                      className={cn(
                        "board-sticky-label flex items-center justify-between gap-2 border-r border-[var(--hairline)] px-3 py-2.5 sm:px-4 sm:py-3",
                        isMaintenanceRow
                          ? "bg-neutral-50/90 opacity-70"
                          : "bg-white",
                      )}
                    >
                      <BoardCartIdentity
                        cart={cart}
                        isMaintenanceRow={isMaintenanceRow}
                      />
                      <button
                        type="button"
                        aria-label={`Report issue on ${cart.name}`}
                        title="Report issue"
                        onClick={() => setIssueDialog(cart)}
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md",
                          "text-red-600 motion-micro",
                          "hover:bg-red-50 hover:text-red-700",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20",
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
                        <div key={period} className={cellBase}>
                          <div
                            title="Cart paused — not bookable"
                            className={cn(slotFace, pausedSlotFill)}
                          >
                            <Wrench className="size-3.5" strokeWidth={1.25} />
                          </div>
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
                      const inviteForMe =
                        bookingHasShareInviteFor(booking, session.id) ||
                        shareInviteBusy?.id === booking.id
                      const invitePendingName = booking.sharePendingId
                        ? nameByTeacherId.get(booking.sharePendingId) ||
                          booking.sharePendingName ||
                          "Colleague"
                        : undefined
                      const classLabel = bookingClassLabel(booking)
                      const titleClass = isGenericClassValue(
                        booking.className ?? booking.subject,
                      )
                        ? ""
                        : classLabel
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
                          ? `${titleClass || "Your booking"}${purposeBit}${shareBit} — click to manage`
                          : hasPendingSwap
                            ? `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — swap pending`
                            : isAdmin
                              ? `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — swap or delete`
                              : `${titleClass || personName} · ${personName}${purposeBit}${shareBit} — hover to swap`
                      const deleting = deletingBookingId === booking.id
                      const inviteBusy =
                        shareInviteBusy?.id === booking.id
                          ? shareInviteBusy.action
                          : null

                      return (
                        <div key={period} className={cellBase}>
                        <div
                          className={cn(
                            slotFace,
                            "group/slot",
                            isInvolved || inviteForMe
                              ? "bg-neutral-950 hover:bg-neutral-900"
                              : "bg-neutral-950/[0.07] hover:bg-neutral-950/[0.11]",
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
                                className={slotTagClassName({
                                  canRename: canRenameTag,
                                  purposeTag: purpose?.tag,
                                  tagText: boardTag,
                                  onDark: isInvolved || inviteForMe,
                                  purposeTagClass: purpose?.tagClass,
                                  purposeTagClassOnDark: purpose?.tagClassOnDark,
                                })}
                              >
                                {boardTag}
                              </span>
                            )
                          ) : null}

                          {/* Share invite for you — same slot look + Accept / Decline */}
                          {inviteForMe ? (
                            <ShareInviteSlotActions
                              busy={inviteBusy}
                              onDecline={() =>
                                void respondShareInvite(booking, "decline")
                              }
                              onAccept={() =>
                                void respondShareInvite(booking, "accept")
                              }
                            />
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
                                : "focus-visible:ring-neutral-900/20",
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
                                primaryId={booking.teacherId}
                                shareName={shareName}
                                shareSrc={shareSrc}
                                shareId={booking.sharedWithId}
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
                        </div>
                      )
                    }

                    if (isRestricted && session.role !== "admin") {
                      return (
                        <div key={period} className={cellBase}>
                          <div
                            title={restrictionTitle}
                            className={cn(
                              slotFace,
                              "flex-col gap-1 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.03)_3px,rgba(0,0,0,0.03)_4px)] text-neutral-400",
                            )}
                          >
                            <Lock className="size-3" strokeWidth={1.25} />
                            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                              {restriction
                                ? getRestrictionType(restriction.category).tag
                                : "Locked"}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    if (isRestricted && session.role === "admin") {
                      return (
                        <div key={period} className={cellBase}>
                          <button
                            type="button"
                            onClick={() => onCellClick(cart, period)}
                            title={`${restrictionTitle} — admins can still book`}
                            className={cn(
                              slotFace,
                              "flex-col gap-1",
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
                        </div>
                      )
                    }

                    if (!canBookOpenSlots) {
                      return (
                        <div key={period} className={cellBase}>
                          <div
                            title={
                              isPastDate
                                ? "Past date — cannot book"
                                : "Outside booking window"
                            }
                            className={cn(
                              slotFace,
                              "bg-neutral-50/80 text-neutral-200",
                            )}
                          >
                            <span className="text-[11px] font-light">—</span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={period} className={cellBase}>
                        <OpenSlotBookButton
                          busy={bookingSlotKey === `${cart.id}:${period}`}
                          blocked={bookingSlotKey !== null}
                          multiLabel={
                            multiMode && isAdmin
                              ? `Book as “${multiTag.trim() || DEFAULT_ADMIN_MULTI_TAG}”`
                              : undefined
                          }
                          onBook={() => onCellClick(cart, period)}
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

      {bookDialog && (
        <BookDialog
          cart={bookDialog.cart}
          period={bookDialog.period}
          date={date}
          onOpened={() => setBookingSlotKey(null)}
          onClose={() => {
            setBookDialog(null)
            setBookingSlotKey(null)
          }}
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
      <BookingLimitDialog
        notice={slotLimit}
        onClose={() => setSlotLimit(null)}
      />
      {isAdmin ? (
        <BoardBlockDialog
          open={blockDialogOpen}
          onOpenChange={setBlockDialogOpen}
          carts={boardCarts}
          activeDate={date}
        />
      ) : null}

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
            <DialogCancel
              disabled={Boolean(deletingBookingId)}
              onClick={() => setPendingDelete(null)}
            >
              Keep booking
            </DialogCancel>
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


function BoardCartIdentity({
  cart,
  isMaintenanceRow,
}: {
  cart: Cart
  isMaintenanceRow: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {cart.laptopBrand ? (
        <CartBrandMark
          brand={cart.laptopBrand}
          className="size-6"
          logoClassName="size-[18px]"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-neutral-100 text-[10px] font-medium tracking-[-0.02em] text-neutral-400"
        >
          {cart.name.trim().slice(0, 1).toUpperCase() || "C"}
        </span>
      )}
      <div className="min-w-0">
        <span className="block truncate text-[13px] font-medium tracking-[-0.02em] text-neutral-950">
          {cart.name}
        </span>
        {isMaintenanceRow ? (
          <span className="mt-0.5 block text-[11px] tracking-[-0.01em] text-neutral-400">
            Paused
          </span>
        ) : cart.location ? (
          <span className="mt-0.5 block truncate text-[11px] tracking-[-0.01em] text-neutral-400">
            {cart.location}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Floating preview — Apple list lift: soft multi-layer shadow, no hard chrome.
 * Portaled to body so board overflow/radius never soft-clips the corners.
 */
function BoardCartRowDragOverlay({
  snapshot,
}: {
  snapshot: { html: string; width: number; height: number }
}) {
  return (
    <div
      className={cn(
        "pointer-events-none cursor-grabbing overflow-hidden bg-white",
        // Hairline edge + depth — no scale (scale wider than track flickers scroll)
        "rounded-[2px]",
        "shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.10),0_20px_40px_rgba(0,0,0,0.06)]",
      )}
      style={{
        width: snapshot.width,
        height: snapshot.height,
      }}
    >
      <div
        className={cn(
          "h-full w-full origin-top-left",
          "[&_[data-drag-handle]]:bg-transparent [&_[data-drag-handle]]:text-neutral-500",
          "[&_[data-drag-handle]]:opacity-100 [&_[data-drag-handle]]:shadow-none",
          "[&_[data-drag-handle]]:scale-100 [&_[data-drag-handle]]:transition-none",
        )}
        dangerouslySetInnerHTML={{ __html: snapshot.html }}
      />
    </div>
  )
}

function OpenSlotBookButton({
  busy,
  blocked,
  multiLabel,
  onBook,
}: {
  busy: boolean
  blocked: boolean
  multiLabel?: string
  onBook: () => void
}) {
  return (
    <button
      type="button"
      disabled={blocked}
      aria-busy={busy}
      aria-label="Book this slot"
      onClick={onBook}
      title={multiLabel ?? "Book this slot"}
      className={cn(
        slotFace,
        "group/cell bg-neutral-50/50",
        "hover:bg-neutral-950",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/15",
        busy && "bg-neutral-50",
        blocked && !busy && "opacity-50",
      )}
    >
      {busy ? (
        <InviteActionBusy spinnerClassName="text-neutral-400" />
      ) : (
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.16em]",
            "text-neutral-300 transition-colors duration-150",
            "group-hover/cell:text-white",
          )}
        >
          Book
        </span>
      )}
    </button>
  )
}

function ShareInviteSlotActions({
  busy,
  onAccept,
  onDecline,
}: {
  busy: "accept" | "decline" | null
  onAccept: () => void
  onDecline: () => void
}) {
  const blocked = busy !== null
  return (
    <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 p-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Decline"
          aria-label="Decline share invite"
          aria-busy={busy === "decline"}
          disabled={blocked}
          onClick={(e) => {
            e.stopPropagation()
            onDecline()
          }}
          className={inviteChipDeclineClassName(
            cn(
              "h-7 min-w-[3.5rem] rounded-full px-2.5 text-[10.5px]",
              busy === "decline"
                ? "disabled:opacity-100"
                : busy
                  ? "opacity-40 disabled:opacity-40"
                  : null,
            ),
          )}
        >
          {busy === "decline" ? <InviteActionBusy /> : "Decline"}
        </button>
        <button
          type="button"
          title="Accept"
          aria-label="Accept share invite"
          aria-busy={busy === "accept"}
          disabled={blocked}
          onClick={(e) => {
            e.stopPropagation()
            onAccept()
          }}
          className={inviteChipAcceptClassName(
            cn(
              "h-7 min-w-[3.5rem] rounded-full px-2.5 text-[10.5px]",
              busy === "accept"
                ? "disabled:opacity-100"
                : busy
                  ? "opacity-40 disabled:opacity-40"
                  : null,
            ),
          )}
        >
          {busy === "accept" ? (
            <InviteActionBusy spinnerClassName="text-white" />
          ) : (
            "Accept"
          )}
        </button>
      </div>
    </div>
  )
}

/**
 * Admin schedule row — dnd-kit sortable.
 * Drag only via grip; vertical-only via modifiers. Order commits on drop.
 */
function SortableBoardCartRow({
  cart,
  disabled,
  isMaintenanceRow,
  onReportIssue,
  children,
}: {
  cart: Cart
  disabled?: boolean
  isMaintenanceRow: boolean
  onReportIssue: () => void
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cart.id,
    disabled: Boolean(disabled),
    // Prevent layout animation thrash when the pointer moves quickly
    animateLayoutChanges: () => false,
  })

  const style: CSSProperties = {
    // Y translate only (modifiers also strip X); no scale warp on the grid
    transform: CSS.Translate.toString(
      transform
        ? { ...transform, x: 0, scaleX: 1, scaleY: 1 }
        : null,
    ),
    transition: isDragging ? undefined : transition,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-cart-row={cart.id}
      data-dragging={isDragging ? "true" : undefined}
      className={cn(
        "board-cols group/row relative grid border-b border-[var(--hairline)] last:border-b-0",
        "bg-white outline-none",
        isMaintenanceRow && "bg-neutral-50/70",
        // Placeholder “hole” under the lifted row — quiet, no rails
        isDragging &&
          "z-[1] bg-neutral-100/50 opacity-[0.22] shadow-none",
      )}
    >
      <div
        className={cn(
          "board-sticky-label flex items-center justify-between gap-1.5 border-r border-[var(--hairline)] px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3",
          isMaintenanceRow ? "bg-neutral-50/90 opacity-70" : "bg-white",
          isDragging && "bg-transparent border-transparent",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            data-drag-handle
            aria-label={`Drag to reorder ${cart.name}`}
            title="Drag to reorder"
            disabled={disabled}
            className={cn(
              "flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md",
              // Quiet grip — present, not loud (Apple list reorder)
              "text-neutral-300/80",
              "opacity-50 transition-[opacity,color,background-color] duration-150",
              "group-hover/row:opacity-100",
              "hover:bg-neutral-100/80 hover:text-neutral-500",
              "active:cursor-grabbing",
              "focus-visible:opacity-100 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-black/10",
              "touch-none select-none",
              isDragging &&
                "cursor-grabbing opacity-0 hover:bg-transparent",
              disabled && "pointer-events-none opacity-30",
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical
              className="pointer-events-none size-3.5"
              strokeWidth={1.5}
            />
          </button>
          <BoardCartIdentity
            cart={cart}
            isMaintenanceRow={isMaintenanceRow}
          />
        </div>
        <button
          type="button"
          aria-label={`Report issue on ${cart.name}`}
          title="Report issue"
          onClick={onReportIssue}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            "text-red-600 motion-micro",
            "hover:bg-red-50 hover:text-red-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20",
            isDragging && "opacity-0",
          )}
        >
          <AlertTriangle className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <div className={cn("contents", isDragging && "[&>*]:opacity-30")}>
        {children}
      </div>
    </div>
  )
}
