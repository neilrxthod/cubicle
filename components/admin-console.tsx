"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Booking, BookingPolicy, Cart, Issue, User, Period, SlotRestriction, SwapRequest } from "@/lib/types"
import {
  createCart,
  deleteCart,
  setCartStatus,
  deleteBookings,
  reassignBooking,
  updateCart,
  clearPlatformData,
  CLEAR_DATA_OPTIONS,
  type ClearDataTarget,
} from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatePresence, motion } from "motion/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Calendar,
  calendarPopoverClassName,
} from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Download,
  MoreHorizontal,
  Search,
  Wrench,
  X,
  Trash2,
  ArrowRightLeft,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react"
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { StaffPanel } from "@/components/staff-panel"
import { ManageBookingDialog } from "@/components/manage-booking-dialog"
import { CartPauseConflictDialog } from "@/components/admin/cart-pause-conflict-dialog"
import {
  ActivityAreaChart,
  CartUsageBarChart,
  ChartCard,
  IssueSeverityPieChart,
  PeriodBarChart,
  TeacherUsageBarChart,
} from "@/components/admin/reports-charts"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LiquidMetalButton } from "@/components/ui/liquid-metal"

type Tab = "carts" | "bookings" | "staff" | "reports"

function isDateInRange(date: Date, range: DateRange | undefined) {
  if (!range?.from) return true
  const start = startOfDay(range.from)
  const end = range.to ? endOfDay(range.to) : endOfDay(range.from)
  return isWithinInterval(date, { start, end })
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  sortConfig: { key: string; direction: "asc" | "desc" } | null
  onSort: (key: string) => void
  className?: string
}) {
  const active = sortConfig?.key === sortKey
  return (
    <th className={cn("px-3 py-2.5 text-left align-middle", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group inline-flex h-7 items-center gap-1 text-[11.5px] font-medium tracking-[-0.01em] transition-colors",
          active ? "text-neutral-950" : "text-neutral-400 hover:text-neutral-700",
        )}
      >
        {label}
        {active ? (
          sortConfig.direction === "asc" ? (
            <ArrowUp className="size-3 text-neutral-500" />
          ) : (
            <ArrowDown className="size-3 text-neutral-500" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    </th>
  )
}
export function AdminConsole({
  carts,
  bookings,
  users,
  issues,
  slotRestrictions = [],
  swapRequests = [],
}: {
  carts: Cart[]
  bookings: Booking[]
  users: User[]
  issues: Issue[]
  slotRestrictions?: SlotRestriction[]
  bookingPolicy?: BookingPolicy
  swapRequests?: SwapRequest[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("carts")
  const [range] = useState<DateRange | undefined>()
  const [clearTarget, setClearTarget] = useState<ClearDataTarget | null>(null)
  // Reports / booking filters: teachers (include revoked so history still labels).
  const teachers = users.filter((user) => user.role === "teacher")

  const filteredBookings = useMemo(() => bookings.filter((b) => isDateInRange(parseISO(b.date), range)), [bookings, range])
  const filteredIssues = useMemo(() => issues.filter((issue) => isDateInRange(parseISO(issue.createdAt), range)), [issues, range])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "carts", label: "Inventory" },
    { id: "bookings", label: "Reservations" },
    { id: "reports", label: "Reports" },
    { id: "staff", label: "Staff" },
  ]

  const clearCounts: Record<ClearDataTarget, number> = {
    bookings: bookings.length,
    issues: issues.length,
    restrictions: slotRestrictions.length,
    swaps: swapRequests.length,
    carts: carts.length,
    all:
      carts.length +
      bookings.length +
      issues.length +
      slotRestrictions.length +
      swapRequests.length,
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="board-scroll inline-flex h-9 w-full max-w-full items-center gap-0.5 overflow-y-hidden rounded-lg border border-[var(--hairline-strong)] bg-white p-0.5 shadow-[var(--shadow-surface)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:w-fit"
          role="tablist"
          aria-label="Admin sections"
        >
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-[var(--hairline-strong)] bg-white px-2.5 sm:self-auto",
                "text-[12.5px] font-medium tracking-[-0.01em] text-neutral-600",
                "transition-colors hover:bg-neutral-50 hover:text-neutral-950",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
              )}
            >
              Clear data
              <ChevronRight className="size-3.5 rotate-90 text-neutral-400" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
              Remove from platform
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CLEAR_DATA_OPTIONS.map((opt) => {
              const count = clearCounts[opt.id]
              return (
                <DropdownMenuItem
                  key={opt.id}
                  disabled={opt.id !== "all" && count === 0}
                  className={cn(
                    "cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2 py-2",
                    opt.id === "all" && "text-red-700 focus:text-red-800",
                  )}
                  onSelect={() => setClearTarget(opt.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{opt.label}</span>
                    <span className="text-[11px] tabular-nums text-neutral-400">
                      {count}
                    </span>
                  </span>
                  <span className="text-[11.5px] leading-snug text-neutral-400">
                    {opt.description}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tab === "carts" ? (
        <CartsGrid carts={carts} bookings={bookings} users={users} />
      ) : tab === "bookings" ? (
        <BookingsTable bookings={filteredBookings} carts={carts} users={users} />
      ) : tab === "reports" ? (
        <ReportsPanel
          bookings={filteredBookings}
          issues={filteredIssues}
          carts={carts}
          teachers={teachers}
          range={range}
          onOpenTab={setTab}
        />
      ) : (
        <StaffPanel
          users={users}
          bookings={bookings}
          issues={issues}
          carts={carts}
          swapRequests={swapRequests}
        />
      )}

      <ClearDataDialog
        target={clearTarget}
        counts={clearCounts}
        onClose={() => setClearTarget(null)}
        onCleared={() => {
          setClearTarget(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function CartsGrid({
  carts,
  bookings,
  users,
}: {
  carts: Cart[]
  bookings: Booking[]
  users: User[]
}) {
  const router = useRouter()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [optimisticStatusById, setOptimisticStatusById] = useState<
    Record<string, Cart["status"]>
  >({})
  const [pauseConflictCart, setPauseConflictCart] = useState<Cart | null>(null)
  const [editor, setEditor] = useState<
    | { mode: "create" }
    | { mode: "edit"; cart: Cart }
    | null
  >(null)
  const [deletingCart, setDeletingCart] = useState<Cart | null>(null)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const sortedCarts = useMemo(
    () =>
      [...carts]
        .filter((c) => !exitingIds.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [carts, exitingIds],
  )

  // Drop exit markers once the server list no longer includes them
  useEffect(() => {
    if (exitingIds.size === 0) return
    const live = new Set(carts.map((c) => c.id))
    setExitingIds((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of prev) {
        if (!live.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [carts, exitingIds.size])

  function futureCount(cartId: string) {
    const today = format(new Date(), "yyyy-MM-dd")
    return bookings.filter((b) => b.cartId === cartId && b.date >= today).length
  }

  function applyStatus(cart: Cart, next: Cart["status"]) {
    setPendingIds((prev) => {
      const s = new Set(prev)
      s.add(cart.id)
      return s
    })
    setOptimisticStatusById((prev) => ({ ...prev, [cart.id]: next }))

    startTransition(async () => {
      const res = await setCartStatus(cart.id, next)

      if (res && "error" in res && res.error) {
        setOptimisticStatusById((prev) => {
          const m = { ...prev }
          delete m[cart.id]
          return m
        })
        setPendingIds((prev) => {
          const s = new Set(prev)
          s.delete(cart.id)
          return s
        })
        toast({
          title: "Could not update cart",
          description: res.error,
          variant: "destructive",
        })
        return
      }

      setPendingIds((prev) => {
        const s = new Set(prev)
        s.delete(cart.id)
        return s
      })
      setOptimisticStatusById((prev) => {
        const m = { ...prev }
        delete m[cart.id]
        return m
      })
      toast({
        title: next === "maintenance" ? "Cart paused" : "Cart resumed",
        description: cart.name,
      })
      router.refresh()
    })
  }

  function toggle(cart: Cart) {
    const current = optimisticStatusById[cart.id] ?? cart.status
    if (current === "active") {
      // Pausing: block immediately if upcoming bookings exist
      if (futureCount(cart.id) > 0) {
        setPauseConflictCart(cart)
        return
      }
      applyStatus(cart, "maintenance")
      return
    }
    applyStatus(cart, "active")
  }

  const activeCount = carts.filter((c) => {
    const s = optimisticStatusById[c.id] ?? c.status
    return s === "active"
  }).length
  const pausedCount = carts.length - activeCount

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] tracking-[-0.01em]">
          <p className="tabular-nums text-neutral-950">
            <span className="font-medium">{carts.length}</span>
            <span className="ml-1 font-normal text-neutral-400">carts</span>
          </p>
          <span aria-hidden className="hidden h-3 w-px bg-neutral-200 sm:block" />
          <p className="tabular-nums text-neutral-500">
            Active{" "}
            <span className="font-medium text-emerald-700">{activeCount}</span>
          </p>
          <span aria-hidden className="hidden h-3 w-px bg-neutral-200 sm:block" />
          <p className="tabular-nums text-neutral-500">
            Paused{" "}
            <span
              className={cn(
                "font-medium",
                pausedCount > 0 ? "text-red-600" : "text-neutral-400",
              )}
            >
              {pausedCount}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setEditor({ mode: "create" })}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-3",
              "text-[12.5px] font-medium tracking-[-0.01em] text-white",
              "transition-opacity hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15",
            )}
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Add cart
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {sortedCarts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200/80 bg-white px-6 py-16 text-center"
          >
            <p className="text-[13.5px] font-medium tracking-[-0.015em] text-neutral-950">
              No carts in inventory
            </p>
            <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-neutral-400">
              Add a cart name and location so staff can start booking.
            </p>
            <button
              type="button"
              onClick={() => setEditor({ mode: "create" })}
              className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 text-[12.5px] font-medium text-white motion-micro hover:opacity-90"
            >
              <Plus className="size-3.5" strokeWidth={1.75} />
              Add first cart
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence initial={false}>
              {sortedCarts.map((cart) => {
                const visualStatus =
                  optimisticStatusById[cart.id] ?? cart.status
                const isPending = pendingIds.has(cart.id)
                const paused = visualStatus === "maintenance"

                return (
                  <motion.div
                    key={cart.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-4 pl-5",
                      "motion-fast",
                      paused
                        ? "border-neutral-200/80 bg-[#fafafa]"
                        : "border-[var(--hairline-strong)] shadow-[var(--shadow-surface)] hover:border-neutral-300/90 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.04)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1 bottom-1",
                        paused
                          ? "w-[5px] bg-red-500"
                          : "w-[4px] bg-emerald-500",
                      )}
                    />

                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className={cn(
                            "truncate text-[13.5px] font-medium tracking-[-0.02em]",
                            paused ? "text-neutral-500" : "text-neutral-950",
                          )}
                        >
                          {cart.name}
                        </h3>
                        <p className="mt-1 truncate text-[12px] tracking-[-0.01em] text-neutral-400">
                          {cart.location || "Location not set"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex shrink-0 items-center gap-0.5",
                          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                          "motion-micro",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Edit ${cart.name}`}
                          title="Edit cart"
                          onClick={() => setEditor({ mode: "edit", cart })}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md",
                            "text-neutral-300 motion-micro",
                            "hover:bg-neutral-100 hover:text-neutral-700",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                          )}
                        >
                          <Pencil className="size-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${cart.name}`}
                          title="Delete cart"
                          onClick={() => setDeletingCart(cart)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md",
                            "text-neutral-300 motion-micro",
                            "hover:bg-red-50 hover:text-red-600",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/15",
                          )}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggle(cart)}
                        className={cn(
                          "inline-flex h-8 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-full px-3.5",
                          "text-[12px] font-medium tracking-[-0.01em] motion-micro",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                          "disabled:pointer-events-none disabled:opacity-40",
                          paused
                            ? "bg-neutral-950 text-white hover:bg-neutral-800"
                            : "bg-neutral-100/90 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-950",
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin opacity-70" />
                        ) : paused ? (
                          "Resume"
                        ) : (
                          "Pause"
                        )}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <CartEditorDialog
        open={!!editor}
        mode={editor?.mode ?? "create"}
        cart={editor?.mode === "edit" ? editor.cart : null}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null)
          router.refresh()
        }}
      />

      <CartDeleteDialog
        cart={deletingCart}
        bookings={bookings}
        onClose={() => setDeletingCart(null)}
        onBeginExit={(cartId) => {
          // Optimistically drop the card so layout + exit motion can run
          setExitingIds((prev) => new Set(prev).add(cartId))
          setDeletingCart(null)
        }}
        onDeleteFailed={(cartId) => {
          setExitingIds((prev) => {
            const next = new Set(prev)
            next.delete(cartId)
            return next
          })
        }}
        onDeleted={() => {
          window.setTimeout(() => {
            router.refresh()
          }, 280)
        }}
      />

      {pauseConflictCart ? (
        <CartPauseConflictDialog
          cart={pauseConflictCart}
          bookings={bookings}
          carts={carts}
          users={users}
          onClose={() => setPauseConflictCart(null)}
          onResolvedAndPaused={() => router.refresh()}
        />
      ) : null}
    </section>
  )
}

/** Confirm targeted platform clear — never runs automatically. */
function ClearDataDialog({
  target,
  counts,
  onClose,
  onCleared,
}: {
  target: ClearDataTarget | null
  counts: Record<ClearDataTarget, number>
  onClose: () => void
  onCleared: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const option = target
    ? CLEAR_DATA_OPTIONS.find((o) => o.id === target)
    : null
  const count = target ? counts[target] : 0

  useEffect(() => {
    if (target) setError(null)
  }, [target])

  function confirm() {
    if (!target) return
    setError(null)
    startTransition(async () => {
      const res = await clearPlatformData(target)
      if (!res.ok) {
        setError(res.error)
        toast({
          title: "Could not clear data",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Data cleared",
        description:
          target === "all"
            ? "Operational data removed. Staff accounts kept."
            : `${option?.label ?? "Selected data"} removed.`,
      })
      onCleared()
    })
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => !o && !pending && onClose()}
    >
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-0 border-b border-[var(--hairline)] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Clear {option?.label.toLowerCase() ?? "data"}?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
            {option?.description ?? "This permanently removes selected data."}{" "}
            Staff accounts and the allowlist are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3.5 py-3 text-[12.5px] text-neutral-600">
            <p className="tabular-nums">
              <span className="font-medium text-neutral-950">{count}</span>{" "}
              {count === 1 ? "record" : "records"} will be removed
            </p>
            <p className="mt-1.5 text-[11.5px] text-neutral-400">
              This cannot be undone.
            </p>
          </div>
          {error ? (
            <p className="text-[12.5px] text-red-600">{error}</p>
          ) : null}
          <div className="flex items-center justify-end gap-3">
            <DialogCancel disabled={pending} onClick={onClose}>
              Cancel
            </DialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className="inline-flex h-9 min-w-[7rem] items-center justify-center rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Clear"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Confirm permanent cart removal — quiet corporate confirm. */
function CartDeleteDialog({
  cart,
  bookings,
  onClose,
  onBeginExit,
  onDeleteFailed,
  onDeleted,
}: {
  cart: Cart | null
  bookings: Booking[]
  onClose: () => void
  onBeginExit: (cartId: string) => void
  onDeleteFailed: (cartId: string) => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (cart) setError(null)
  }, [cart])

  const open = !!cart
  const relatedBookings = cart
    ? bookings.filter((b) => b.cartId === cart.id).length
    : 0

  function confirmDelete() {
    if (!cart) return
    const target = cart
    setError(null)
    // Close dialog + start card exit immediately for a calm corporate motion
    onBeginExit(target.id)
    startTransition(async () => {
      const res = await deleteCart(target.id)
      if (!res.ok) {
        onDeleteFailed(target.id)
        setError(res.error)
        toast({
          title: "Could not delete cart",
          description: res.error,
          variant: "destructive",
        })
        // Re-open confirm is awkward — toast is enough; card is restored
        return
      }
      toast({
        title: "Cart deleted",
        description: target.name,
      })
      onDeleted()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-0 border-b border-[var(--hairline)] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Delete cart?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
            This permanently removes the cart from inventory and the schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          {cart ? (
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3.5 py-3">
              <p className="text-[13.5px] font-medium tracking-[-0.02em] text-neutral-950">
                {cart.name}
              </p>
              <p className="mt-0.5 text-[12px] text-neutral-400">
                {cart.location || "Location not set"}
              </p>
              {relatedBookings > 0 ? (
                <p className="mt-2 text-[12px] leading-snug text-neutral-500">
                  {relatedBookings} booking
                  {relatedBookings === 1 ? "" : "s"} on this cart will also be
                  removed.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-[12.5px] text-red-600">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-0.5">
            <DialogCancel disabled={pending} onClick={onClose}>
              Keep cart
            </DialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className={cn(
                "inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-lg bg-red-600 px-4",
                "text-[13px] font-medium text-white",
                "transition-[opacity,background-color] duration-200 ease-out",
                "hover:bg-red-700 disabled:opacity-50",
              )}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin opacity-90" />
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Minimal admin dialog — add or rename a cart. */
function CartEditorDialog({
  open,
  mode,
  cart,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: "create" | "edit"
  cart: Cart | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Reset fields when opening / switching target
  useEffect(() => {
    if (!open) return
    if (mode === "edit" && cart) {
      setName(cart.name)
      setLocation(cart.location ?? "")
    } else {
      setName("")
      setLocation("")
    }
    setError(null)
  }, [open, mode, cart])

  function submit() {
    setError(null)
    startTransition(async () => {
      const payload = {
        name,
        location,
        // Preserve existing laptop count on edit; never prompt for it in the UI.
        laptopCount:
          mode === "edit" && cart && typeof cart.laptopCount === "number"
            ? cart.laptopCount
            : null,
      }
      const res =
        mode === "edit" && cart
          ? await updateCart(cart.id, payload)
          : await createCart(payload)

      if (!res.ok) {
        setError(res.error)
        toast({
          title: mode === "edit" ? "Could not update cart" : "Could not add cart",
          description: res.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: mode === "edit" ? "Cart updated" : "Cart added",
        description: name.trim(),
      })
      onSaved()
    })
  }

  const title = mode === "edit" ? "Edit cart" : "Add cart"
  const description =
    mode === "edit"
      ? "Update the display name and location for this cart."
      : "Create a cart for the schedule. Name and location are required."
  const canSubmit = Boolean(name.trim() && location.trim())

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-0 border-b border-[var(--hairline)] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-neutral-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="cart-name"
              className="text-[11px] font-medium tracking-[0.04em] text-neutral-400"
            >
              Name
            </Label>
            <Input
              id="cart-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oak"
              disabled={pending}
              autoComplete="off"
              autoFocus
              maxLength={48}
              className="h-9 rounded-lg border-neutral-200 text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (canSubmit) submit()
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="cart-location"
              className="text-[11px] font-medium tracking-[0.04em] text-neutral-400"
            >
              Location
            </Label>
            <Input
              id="cart-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Library"
              disabled={pending}
              autoComplete="off"
              maxLength={80}
              required
              className="h-9 rounded-lg border-neutral-200 text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (canSubmit) submit()
                }
              }}
            />
          </div>

          {error ? (
            <p className="text-[12.5px] text-red-600">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            <DialogCancel disabled={pending} onClick={onClose}>
              Cancel
            </DialogCancel>
            <button
              type="button"
              disabled={pending || !canSubmit}
              onClick={submit}
              className="h-9 rounded-lg bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending
                ? mode === "edit"
                  ? "Saving…"
                  : "Adding…"
                : mode === "edit"
                  ? "Save"
                  : "Add cart"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function bookingTeacherInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

function BookingsTable({
  bookings,
  carts,
  users,
}: {
  bookings: Booking[]
  carts: Cart[]
  users: User[]
}) {
  const cartMap = useMemo(() => new Map(carts.map((c) => [c.id, c])), [carts])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const userByName = useMemo(() => {
    const m = new Map<string, User>()
    for (const u of users) m.set(u.name.toLowerCase(), u)
    return m
  }, [users])
  const [view, setView] = useState<"list" | "board">("list")
  const [query, setQuery] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [rangeFilter, setRangeFilter] = useState<DateRange | undefined>()
  const [teacherFilter, setTeacherFilter] = useState("")
  const [cartFilter, setCartFilter] = useState("")
  const [periodFilter, setPeriodFilter] = useState("")
  const [showConflicts, setShowConflicts] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reassigningBooking, setReassigningBooking] = useState<Booking | null>(null)
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)

  const filterSignature = [
    query,
    dateFilter,
    rangeFilter?.from?.toISOString() ?? "",
    rangeFilter?.to?.toISOString() ?? "",
    teacherFilter,
    cartFilter,
    periodFilter,
    String(showConflicts),
  ].join("|")
  const [selectionFilter, setSelectionFilter] = useState(filterSignature)
  if (selectionFilter !== filterSignature) {
    setSelectionFilter(filterSignature)
    setSelectedIds(new Set())
  }

  const sorted = useMemo(() => {
    const s = [...bookings]
    if (sortConfig !== null) {
      const { key, direction } = sortConfig
      s.sort((a, b) => {
        let valA: string | number = ""
        let valB: string | number = ""
        if (key === "date") {
          valA = a.date
          valB = b.date
        } else if (key === "period") {
          valA = a.period
          valB = b.period
        } else if (key === "cart") {
          valA = cartMap.get(a.cartId)?.name ?? ""
          valB = cartMap.get(b.cartId)?.name ?? "-"
        } else if (key === "class") {
          valA = a.className ?? ""
          valB = b.className ?? ""
        } else if (key === "subject") {
          valA = a.subject ?? ""
          valB = b.subject ?? ""
        } else if (key === "teacher") {
          valA = a.teacherName
          valB = b.teacherName
        }
        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
      })
      return s
    }
    return s.sort((a, b) =>
      a.date === b.date ? a.period.localeCompare(b.period) : b.date.localeCompare(a.date),
    )
  }, [bookings, sortConfig, cartMap])

  const teachers = useMemo(
    () => [...new Set(bookings.map((b) => b.teacherName))].sort(),
    [bookings],
  )
  const cartNames = useMemo(() => [...new Set(carts.map((c) => c.name))].sort(), [carts])
  const periods = useMemo(() => ["P1", "P2", "P3", "P4", "P5"] as Period[], [])

  const q = query.toLowerCase().trim()
  const filtered = useMemo(
    () =>
      sorted.filter((b) => {
        if (showConflicts) {
          const cart = cartMap.get(b.cartId)
          if (!(cart && cart.status === "maintenance")) return false
        }
        const bDate = parseISO(b.date)
        if (rangeFilter?.from) {
          if (
            !isWithinInterval(bDate, {
              start: startOfDay(rangeFilter.from),
              end: endOfDay(rangeFilter.to || rangeFilter.from),
            })
          ) {
            return false
          }
        } else if (dateFilter && b.date !== dateFilter) {
          return false
        }
        if (teacherFilter && b.teacherName !== teacherFilter) return false
        if (cartFilter && (cartMap.get(b.cartId)?.name ?? "-") !== cartFilter) return false
        if (periodFilter && b.period !== periodFilter) return false
        if (q) {
          const searchable = [
            format(bDate, "MMM d"),
            format(bDate, "EEE"),
            b.period,
            cartMap.get(b.cartId)?.name ?? "-",
            b.teacherName,
            b.className ?? "",
            b.subject ?? "",
          ]
            .join(" ")
            .toLowerCase()
          if (!searchable.includes(q)) return false
        }
        return true
      }),
    [sorted, showConflicts, cartMap, rangeFilter, dateFilter, teacherFilter, cartFilter, periodFilter, q],
  )

  const hasFilters = Boolean(
    q || dateFilter || rangeFilter || teacherFilter || cartFilter || periodFilter || showConflicts,
  )
  const todayKey = format(new Date(), "yyyy-MM-dd")
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd")
  const weekEndKey = format(addDays(new Date(), 6), "yyyy-MM-dd")

  function clearFilters() {
    setQuery("")
    setDateFilter("")
    setRangeFilter(undefined)
    setTeacherFilter("")
    setCartFilter("")
    setPeriodFilter("")
    setSortConfig(null)
    setShowConflicts(false)
    setSelectedIds(new Set())
  }

  function handleSort(key: string) {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  function downloadCsv(filename: string, list: Booking[], emptyMessage: string) {
    if (list.length === 0) {
      toast({ title: "Nothing to export", description: emptyMessage })
      return
    }
    const headers = ["Date", "Day", "Period", "Cart", "Location", "Class", "Subject", "Teacher"]
    const rows = list.map((b) => {
      const date = parseISO(b.date)
      const cart = cartMap.get(b.cartId)
      return [
        format(date, "yyyy-MM-dd"),
        format(date, "EEEE"),
        b.period,
        cart?.name ?? "-",
        cart?.location ?? "",
        b.className ?? "",
        b.subject ?? "",
        b.teacherName,
      ]
        .map((val) => `"${String(val).replaceAll('"', '""')}"`)
        .join(",")
    })
    const csvContent = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({
      title: "CSV exported",
      description: `${list.length} reservation${list.length === 1 ? "" : "s"}`,
    })
  }

  function exportVisibleCsv() {
    downloadCsv(
      `reservations-filtered-${format(new Date(), "yyyy-MM-dd")}.csv`,
      filtered,
      "No reservations match the current filters.",
    )
  }

  function exportAllCsv() {
    downloadCsv(
      `reservations-all-${format(new Date(), "yyyy-MM-dd")}.csv`,
      sorted,
      "No reservations to export.",
    )
  }

  function exportTodayCsv() {
    const list = sorted.filter((b) => b.date === todayKey)
    downloadCsv(
      `reservations-today-${todayKey}.csv`,
      list,
      "No reservations scheduled for today.",
    )
  }

  function exportWeekCsv() {
    const list = sorted.filter((b) => b.date >= todayKey && b.date <= weekEndKey)
    downloadCsv(
      `reservations-week-${todayKey}.csv`,
      list,
      "No reservations in the next 7 days.",
    )
  }

  function exportConflictsCsv() {
    const list = sorted.filter((b) => cartMap.get(b.cartId)?.status === "maintenance")
    downloadCsv(
      `reservations-conflicts-${format(new Date(), "yyyy-MM-dd")}.csv`,
      list,
      "No reservations on paused carts.",
    )
  }

  function exportByTeacherCsv() {
    const counts = new Map<string, number>()
    for (const b of filtered) {
      counts.set(b.teacherName, (counts.get(b.teacherName) ?? 0) + 1)
    }
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) =>
        [`"${name.replaceAll('"', '""')}"`, count].join(","),
      )
    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No reservations match the current filters.",
      })
      return
    }
    const csvContent = ["Teacher,Reservations", ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `reservations-by-teacher-${format(new Date(), "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({
      title: "CSV exported",
      description: `${rows.length} teacher${rows.length === 1 ? "" : "s"}`,
    })
  }

  function printTodaySchedule() {
    const list = sorted
      .filter((b) => b.date === todayKey)
      .sort(
        (a, b) =>
          a.period.localeCompare(b.period) ||
          (cartMap.get(a.cartId)?.name ?? "").localeCompare(
            cartMap.get(b.cartId)?.name ?? "",
          ),
      )

    const esc = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")

    const conflictCount = list.filter(
      (b) => cartMap.get(b.cartId)?.status === "maintenance",
    ).length
    const generatedAt = format(new Date(), "MMM d, yyyy · HH:mm")
    const dateLabel = format(parseISO(todayKey), "EEEE, MMMM d, yyyy")

    const bodyRows =
      list.length === 0
        ? `<tr class="empty">
            <td colspan="6">No reservations scheduled for this day.</td>
          </tr>`
        : list
            .map((b) => {
              const c = cartMap.get(b.cartId)
              const conflict = c?.status === "maintenance"
              return `<tr class="${conflict ? "conflict" : ""}">
                <td class="period">${esc(b.period)}</td>
                <td class="cart">
                  <span class="primary">${esc(c?.name ?? "—")}</span>
                  ${conflict ? `<span class="flag">Paused</span>` : ""}
                </td>
                <td class="muted">${esc(c?.location?.trim() || "—")}</td>
                <td class="teacher">${esc(b.teacherName)}</td>
                <td class="muted">${esc(b.className?.trim() || "—")}</td>
                <td class="muted">${esc(b.subject?.trim() || "—")}</td>
              </tr>`
            })
            .join("")

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cubicle · Schedule · ${todayKey}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0.6in 0.65in 0.7in;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0a0a0a;
      -webkit-font-smoothing: antialiased;
      font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    }
    .sheet {
      width: 100%;
      max-width: 8.5in;
      margin: 0 auto;
    }
    .top {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 18px;
      border-bottom: 1.5px solid #0a0a0a;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .wordmark {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #0a0a0a;
    }
    .title {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      letter-spacing: -0.035em;
      line-height: 1.15;
      color: #0a0a0a;
    }
    .meta-block {
      text-align: right;
      font-size: 11.5px;
      line-height: 1.45;
      color: #737373;
    }
    .meta-block strong {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #171717;
      letter-spacing: -0.01em;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin: 16px 0 22px;
      padding: 0;
      list-style: none;
      font-size: 11.5px;
      color: #525252;
    }
    .stats li {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }
    .stats .n {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #0a0a0a;
      letter-spacing: -0.02em;
    }
    .stats .warn {
      color: #b91c1c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead th {
      padding: 0 10px 10px 0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #a3a3a3;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    thead th:last-child { padding-right: 0; }
    tbody td {
      padding: 11px 10px 11px 0;
      font-size: 12px;
      line-height: 1.35;
      vertical-align: middle;
      border-bottom: 1px solid #f0f0f0;
      color: #171717;
    }
    tbody td:last-child { padding-right: 0; }
    tbody tr:last-child td { border-bottom: none; }
    .period {
      width: 9%;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      color: #404040;
    }
    .cart { width: 16%; }
    .cart .primary {
      font-weight: 600;
      letter-spacing: -0.015em;
    }
    .cart .flag {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 5px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #b91c1c;
      background: #fef2f2;
      vertical-align: middle;
    }
    .teacher {
      width: 20%;
      font-weight: 500;
      letter-spacing: -0.01em;
    }
    .muted {
      color: #737373;
      font-weight: 400;
    }
    tr.conflict td { background: #fffafa; }
    tr.empty td {
      padding: 36px 0;
      text-align: center;
      color: #a3a3a3;
      font-size: 12.5px;
      border-bottom: none;
    }
    col.c-period { width: 9%; }
    col.c-cart { width: 16%; }
    col.c-loc { width: 16%; }
    col.c-teacher { width: 20%; }
    col.c-class { width: 20%; }
    col.c-subj { width: 19%; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      letter-spacing: 0.02em;
      color: #a3a3a3;
    }
    .footer .confidential {
      font-weight: 500;
      color: #737373;
    }
    @media print {
      html, body { background: #fff; }
      .sheet { max-width: none; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      .no-print { display: none !important; }
    }
    @media screen {
      body {
        background: #f4f4f5;
        padding: 32px 16px 48px;
      }
      .sheet {
        background: #fff;
        padding: 40px 44px 36px;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.06);
      }
      .toolbar {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        max-width: 8.5in;
        margin: 0 auto 14px;
      }
      .toolbar button {
        height: 32px;
        padding: 0 12px;
        border-radius: 6px;
        border: 1px solid #e5e5e5;
        background: #fff;
        font-size: 12.5px;
        font-weight: 500;
        color: #404040;
        cursor: pointer;
        font-family: inherit;
      }
      .toolbar button.primary {
        background: #0a0a0a;
        border-color: #0a0a0a;
        color: #fff;
      }
      .toolbar button:hover { border-color: #d4d4d4; }
      .toolbar button.primary:hover { background: #262626; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Save as PDF / Print</button>
  </div>
  <div class="sheet">
    <header class="top">
      <div class="brand">
        <div class="wordmark">Cubicle</div>
        <h1 class="title">Daily cart schedule</h1>
      </div>
      <div class="meta-block">
        <strong>${esc(dateLabel)}</strong>
        Generated ${esc(generatedAt)}
      </div>
    </header>

    <ul class="stats">
      <li><span class="n">${list.length}</span> reservation${list.length === 1 ? "" : "s"}</li>
      <li><span class="n">${new Set(list.map((b) => b.teacherId || b.teacherName)).size}</span> teachers</li>
      <li><span class="n">${new Set(list.map((b) => b.cartId)).size}</span> carts</li>
      ${
        conflictCount > 0
          ? `<li class="warn"><span class="n warn">${conflictCount}</span> on paused carts</li>`
          : ""
      }
    </ul>

    <table>
      <colgroup>
        <col class="c-period" />
        <col class="c-cart" />
        <col class="c-loc" />
        <col class="c-teacher" />
        <col class="c-class" />
        <col class="c-subj" />
      </colgroup>
      <thead>
        <tr>
          <th>Period</th>
          <th>Cart</th>
          <th>Location</th>
          <th>Teacher</th>
          <th>Class</th>
          <th>Subject</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>

    <footer class="footer">
      <span class="confidential">Internal use · authorized staff only</span>
      <span>Cubicle operations</span>
    </footer>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`

    const w = window.open("", "_blank")
    if (!w) {
      toast({
        title: "Popup blocked",
        description: "Allow popups to export the PDF schedule.",
        variant: "destructive",
      })
      return
    }
    w.document.write(html)
    w.document.close()
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const res = await deleteBookings(Array.from(selectedIds))
      if (!res.ok) {
        toast({
          title: "Could not delete bookings",
          description: res.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Bookings deleted",
          description: `${selectedIds.size} booking${selectedIds.size === 1 ? "" : "s"}`,
        })
        setSelectedIds(new Set())
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const conflictsCount = bookings.filter((b) => cartMap.get(b.cartId)?.status === "maintenance").length
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const filterTrigger = cn(
    "h-8 gap-1.5 rounded-md border border-[var(--hairline-strong)] bg-white px-2.5",
    "text-[12.5px] font-medium text-neutral-700 shadow-none",
    "hover:bg-neutral-50 focus:ring-0 data-[state=open]:border-neutral-400",
    "data-[placeholder]:text-neutral-400",
  )

  const dateLabel = rangeFilter?.from
    ? rangeFilter.to
      ? `${format(rangeFilter.from, "MMM d")} - ${format(rangeFilter.to, "MMM d")}`
      : format(rangeFilter.from, "MMM d, yyyy")
    : dateFilter
      ? format(parseISO(dateFilter), "MMM d, yyyy")
      : "Date"

  /** Soft corporate accents — muted fills, solid on select. */
  const chipClass = (
    on: boolean,
    tone: "slate" | "blue" | "teal" | "red" = "slate",
  ) => {
    const tones = {
      slate: on
        ? "border-neutral-800 bg-neutral-800 text-white"
        : "border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80",
      blue: on
        ? "border-blue-800 bg-blue-800 text-white"
        : "border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100/80",
      teal: on
        ? "border-teal-800 bg-teal-800 text-white"
        : "border-teal-100 bg-teal-50 text-teal-800 hover:bg-teal-100/80",
      red: on
        ? "border-red-700 bg-red-700 text-white"
        : "border-red-100 bg-red-50 text-red-700 hover:bg-red-100/80",
    } as const
    return cn(
      "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
      tones[tone],
    )
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Summary + view */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] tracking-[-0.01em]">
          <p className="tabular-nums text-neutral-950">
            <span className="font-medium">{filtered.length}</span>
            <span className="ml-1 font-normal text-neutral-400">matching</span>
          </p>
          <span aria-hidden className="hidden h-3 w-px bg-neutral-200 sm:block" />
          <p className="tabular-nums text-neutral-500">
            Total{" "}
            <span className="font-medium text-neutral-700">{sorted.length}</span>
          </p>
          {conflictsCount > 0 ? (
            <>
              <span aria-hidden className="hidden h-3 w-px bg-neutral-200 sm:block" />
              <p className="tabular-nums text-neutral-500">
                On paused carts{" "}
                <span className="font-medium text-red-600">{conflictsCount}</span>
              </p>
            </>
          ) : null}
        </div>

        <div className="inline-flex h-8 items-center rounded-md border border-[var(--hairline-strong)] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "rounded-[5px] px-2.5 text-[12px] font-medium transition-colors",
              view === "list"
                ? "bg-neutral-950 text-white"
                : "text-neutral-400 hover:text-neutral-800",
            )}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={cn(
              "rounded-[5px] px-2.5 text-[12px] font-medium transition-colors",
              view === "board"
                ? "bg-neutral-950 text-white"
                : "text-neutral-400 hover:text-neutral-800",
            )}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1 sm:max-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className={cn(
                  "h-8 w-full rounded-md border border-[var(--hairline-strong)] bg-white pl-8 pr-2.5",
                  "text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-400",
                  "focus:border-neutral-400",
                )}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    filterTrigger,
                    "group inline-flex min-w-[120px] items-center justify-between gap-2",
                    "data-[state=open]:[&_svg.chevron]:rotate-180",
                    "data-[state=open]:[&_svg.chevron]:text-neutral-600",
                  )}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                    <CalendarIcon
                      className="size-3.5 shrink-0 text-neutral-400"
                      strokeWidth={1.75}
                    />
                    <span
                      className={cn(
                        "truncate leading-none",
                        !(dateFilter || rangeFilter) && "text-neutral-400",
                      )}
                    >
                      {dateLabel}
                    </span>
                  </span>
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    fill="none"
                    className="chevron size-3 shrink-0 origin-center text-neutral-400 transition-[transform,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  >
                    <path
                      d="M4.75 6.5 8 9.75 11.25 6.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={calendarPopoverClassName}
                align="start"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
                avoidCollisions
              >
                <Calendar
                  mode="range"
                  selected={rangeFilter}
                  onSelect={(r) => {
                    setRangeFilter(r)
                    setDateFilter("")
                  }}
                />
              </PopoverContent>
            </Popover>

            <Select
              value={teacherFilter || "all"}
              onValueChange={(v) => setTeacherFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[120px]")}>
                <SelectValue placeholder="Teacher" />
              </SelectTrigger>
              <SelectContent className="rounded-lg" align="start">
                <SelectItem value="all">All teachers</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={cartFilter || "all"}
              onValueChange={(v) => setCartFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[110px]")}>
                <SelectValue placeholder="Cart" />
              </SelectTrigger>
              <SelectContent className="rounded-lg" align="start">
                <SelectItem value="all">All carts</SelectItem>
                {cartNames.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={periodFilter || "all"}
              onValueChange={(v) => setPeriodFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[100px]")}>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="rounded-lg" align="start">
                <SelectItem value="all">All periods</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {selectedIds.size > 0 ? (
              <div className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white pl-2.5 pr-1">
                <span className="text-[12px] font-medium tabular-nums text-neutral-700">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                  {isDeleting ? "…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="flex size-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <LiquidMetalButton
                    icon={<Download strokeWidth={1.75} />}
                    trailing={
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        fill="none"
                        className="chevron origin-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      >
                        <path
                          d="M4.75 6.5 8 9.75 11.25 6.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  >
                    Export
                  </LiquidMetalButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="w-56 rounded-lg border-[var(--hairline-strong)] p-1 shadow-[var(--shadow-soft)]"
                >
                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium text-neutral-400">
                    CSV
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportVisibleCsv}
                  >
                    Filtered list
                    <span className="ml-auto tabular-nums text-[11px] text-neutral-400">
                      {filtered.length}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportAllCsv}
                  >
                    All reservations
                    <span className="ml-auto tabular-nums text-[11px] text-neutral-400">
                      {sorted.length}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportTodayCsv}
                  >
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportWeekCsv}
                  >
                    Next 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportConflictsCsv}
                  >
                    On paused carts
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={exportByTeacherCsv}
                  >
                    Counts by teacher
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium text-neutral-400">
                    PDF
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[12.5px]"
                    onSelect={printTodaySchedule}
                  >
                    Today&apos;s schedule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              clearFilters()
              setDateFilter(todayKey)
            }}
            className={chipClass(
              dateFilter === todayKey && !showConflicts && !rangeFilter,
              "slate",
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              clearFilters()
              setDateFilter(tomorrowKey)
            }}
            className={chipClass(
              dateFilter === tomorrowKey && !showConflicts && !rangeFilter,
              "blue",
            )}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => {
              clearFilters()
              setRangeFilter({
                from: startOfDay(new Date()),
                to: endOfDay(addDays(new Date(), 6)),
              })
            }}
            className={chipClass(
              Boolean(
                rangeFilter?.from &&
                  rangeFilter?.to &&
                  format(rangeFilter.from, "yyyy-MM-dd") === todayKey &&
                  format(rangeFilter.to, "yyyy-MM-dd") === weekEndKey,
              ),
              "teal",
            )}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => {
              clearFilters()
              setShowConflicts(true)
            }}
            className={chipClass(showConflicts, "red")}
          >
            On paused carts
            {conflictsCount > 0 ? (
              <span className="tabular-nums opacity-80">{conflictsCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      {view === "list" ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-[var(--hairline)] bg-white px-5 py-12 text-center">
            <p className="text-[13px] text-neutral-400">
              {hasFilters
                ? "No reservations match these filters."
                : "No reservations yet."}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-[13px] font-medium text-neutral-950 underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white">
            <div className="board-scroll">
              <table className="w-full min-w-[36rem] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                  <col className="w-[28%]" />
                  <col className="w-[30%]" />
                  <col className="w-12" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--hairline)]">
                    <th className="px-4 py-2.5 align-middle sm:px-5">
                      <div className="flex h-7 items-center">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(new Set(filtered.map((b) => b.id)))
                            else setSelectedIds(new Set())
                          }}
                          aria-label="Select all"
                        />
                      </div>
                    </th>
                    <SortableHeader label="Date" sortKey="date" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Period" sortKey="period" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Cart" sortKey="cart" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Teacher" sortKey="teacher" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="px-3 py-2.5 align-middle" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const cart = cartMap.get(b.cartId)
                    const date = parseISO(b.date)
                    const isConflict = cart?.status === "maintenance"
                    const selected = selectedIds.has(b.id)
                    const teacher =
                      userById.get(b.teacherId) ??
                      userByName.get(b.teacherName.toLowerCase())
                    const avatarUrl = teacher?.avatarUrl

                    return (
                      <tr
                        key={b.id}
                        className={cn(
                          "group border-t border-[var(--hairline)] transition-colors first:border-t-0",
                          selected ? "bg-neutral-50/80" : "hover:bg-neutral-50/50",
                        )}
                      >
                        <td className="px-4 py-3.5 align-middle sm:px-5">
                          <div className="flex h-8 items-center">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds)
                                if (checked) next.add(b.id)
                                else next.delete(b.id)
                                setSelectedIds(next)
                              }}
                              aria-label={`Select booking for ${b.teacherName}`}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                              {format(date, "MMM d, yyyy")}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                              {format(date, "EEE")}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <span className="text-[12.5px] font-medium tabular-nums text-neutral-700">
                            {b.period}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="min-w-0 leading-tight">
                            <p
                              className={cn(
                                "flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium tracking-[-0.01em]",
                                isConflict ? "text-red-600" : "text-neutral-950",
                              )}
                            >
                              <span className="truncate">{cart?.name ?? "—"}</span>
                              {isConflict ? (
                                <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
                              ) : null}
                            </p>
                            {cart?.location ? (
                              <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                                {cart.location}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="flex min-w-0 items-center gap-2.5">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={avatarUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="size-7 shrink-0 rounded-full object-cover ring-1 ring-black/[0.05]"
                              />
                            ) : (
                              <span
                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold tracking-wide text-neutral-500 ring-1 ring-black/[0.04]"
                                aria-hidden
                              >
                                {bookingTeacherInitials(b.teacherName)}
                              </span>
                            )}
                            <span className="min-w-0 truncate text-[13px] tracking-[-0.01em] text-neutral-800">
                              {b.teacherName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="flex h-8 items-center justify-end">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "inline-flex size-8 items-center justify-center rounded-md text-neutral-400",
                                  "opacity-0 transition-[opacity,background-color,color] hover:bg-neutral-100 hover:text-neutral-900",
                                  "group-hover:opacity-100 data-[state=open]:bg-neutral-100 data-[state=open]:opacity-100 data-[state=open]:text-neutral-900",
                                )}
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Open options</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44 rounded-lg border-[var(--hairline-strong)] p-1 shadow-[var(--shadow-soft)]"
                            >
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 rounded-md text-[12.5px]"
                                onClick={() => setReassigningBooking(b)}
                              >
                                <ArrowRightLeft className="size-3.5 text-neutral-400" />
                                Reassign cart
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 rounded-md text-[12.5px]"
                                asChild
                              >
                                <a
                                  href={`mailto:${b.teacherName.toLowerCase().replace(/\s/g, ".")}@school.edu?subject=Regarding your cart booking for ${format(date, "MMM d")}`}
                                >
                                  <Mail className="size-3.5 text-neutral-400" />
                                  Contact teacher
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 rounded-md text-[12.5px] text-red-600 focus:bg-red-50 focus:text-red-700"
                                onClick={() => setCancelingBooking(b)}
                              >
                                <Trash2 className="size-3.5" />
                                Cancel booking
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white p-4 sm:p-5">
          <DailyBoardLite bookings={filtered} carts={carts} />
        </div>
      )}

      {cancelingBooking ? (
        <ManageBookingDialog
          booking={cancelingBooking}
          cart={cartMap.get(cancelingBooking.cartId)}
          onClose={() => setCancelingBooking(null)}
        />
      ) : null}

      <Dialog open={!!reassigningBooking} onOpenChange={(open) => !open && setReassigningBooking(null)}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl sm:max-w-xl">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="text-left">
              <DialogTitle>Reassign cart</DialogTitle>
            </DialogHeader>
            {reassigningBooking ? (
              <p className="mt-2 text-[13px] text-neutral-500">
                {reassigningBooking.teacherName}
                {" · "}
                {format(parseISO(reassigningBooking.date), "MMM d, yyyy")}
                {" · "}
                {reassigningBooking.period}
                {" · currently "}
                <span className="font-medium text-neutral-900">
                  {cartMap.get(reassigningBooking.cartId)?.name}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Available carts
              {isReassigning ? (
                <span className="ml-2 normal-case tracking-normal text-muted-foreground">Moving...</span>
              ) : null}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {carts
                .filter((c) => c.status === "active" && c.id !== reassigningBooking?.cartId)
                .map((c) => {
                  const hasConflict = bookings.some(
                    (bk) =>
                      bk.cartId === c.id &&
                      bk.date === reassigningBooking?.date &&
                      bk.period === reassigningBooking?.period,
                  )
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={hasConflict || isReassigning}
                      onClick={async () => {
                        if (!reassigningBooking) return
                        setIsReassigning(true)
                        try {
                          const res = await reassignBooking(reassigningBooking.id, c.id)
                          if (!res.ok) {
                            toast({
                              title: "Could not move booking",
                              description: res.error,
                              variant: "destructive",
                            })
                          } else {
                            toast({
                              title: "Booking moved",
                              description: c.name,
                            })
                            setReassigningBooking(null)
                          }
                        } finally {
                          setIsReassigning(false)
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,box-shadow]",
                        hasConflict
                          ? "cursor-not-allowed border-transparent bg-neutral-50 opacity-50"
                          : "border-border bg-white hover:border-neutral-400 hover:shadow-sm",
                      )}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-foreground">{c.name}</span>
                        {c.location ? (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{c.location}</span>
                        ) : null}
                        {hasConflict ? (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">Busy that period</span>
                        ) : null}
                      </span>
                      {!hasConflict ? <ArrowRight className="size-4 text-muted-foreground" /> : null}
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="border-t border-border/70 px-6 py-4">
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setReassigningBooking(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** Grade / class label for a booking — prefers className, falls back to subject tag. */
function bookingGradeLabel(booking: Booking): string {
  const classLabel = booking.className?.trim()
  if (classLabel) return classLabel
  const subject = booking.subject?.trim()
  if (subject) return subject
  return "—"
}

function formatBookingTimestamp(booking: Booking): { primary: string; secondary: string } {
  try {
    const day = format(parseISO(booking.date), "MMM d, yyyy")
    const weekday = format(parseISO(booking.date), "EEE")
    if (booking.createdAt) {
      const created = parseISO(booking.createdAt)
      return {
        primary: day,
        secondary: `${weekday} · ${format(created, "h:mm a")}`,
      }
    }
    return { primary: day, secondary: weekday }
  } catch {
    return { primary: booking.date, secondary: booking.createdAt ?? "" }
  }
}

/**
 * Drill-down when an admin opens a Top subjects chip.
 * Corporate sheet: search + dense table (teacher · time · grade · period).
 */
function SubjectBookingsDialog({
  subject,
  bookings,
  teacherById,
  onClose,
}: {
  subject: string | null
  bookings: Booking[]
  teacherById: Map<string, User>
  onClose: () => void
}) {
  const open = Boolean(subject)
  const [query, setQuery] = useState("")

  // Reset search whenever a different subject capsule is opened.
  const searchKey = subject ?? ""
  const [prevSearchKey, setPrevSearchKey] = useState(searchKey)
  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey)
    setQuery("")
  }

  const rows = useMemo(() => {
    if (!subject) return [] as Booking[]
    return bookings
      .filter((b) => (b.subject || "Unspecified") === subject)
      .slice()
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date)
        if (byDate !== 0) return byDate
        const byPeriod = a.period.localeCompare(b.period)
        if (byPeriod !== 0) return byPeriod
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [bookings, subject])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((booking) => {
      const teacher = teacherById.get(booking.teacherId)
      const grade = bookingGradeLabel(booking)
      const stamp = formatBookingTimestamp(booking)
      const haystack = [
        booking.teacherName,
        teacher?.email,
        grade,
        booking.period,
        stamp.primary,
        stamp.secondary,
        booking.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, query, teacherById])

  function handleClose() {
    setQuery("")
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "w-[min(100%,34rem)] gap-0 overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white p-0",
          "shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:max-w-lg",
        )}
      >
        <DialogHeader className="space-y-3 border-b border-[var(--hairline)] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-[14px] font-medium tracking-[-0.015em] text-neutral-950">
            {subject ?? "Subject"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Bookings for {subject ?? "subject"}
          </DialogDescription>

          {rows.length > 0 ? (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search subject bookings"
                className={cn(
                  "h-8 rounded-md border-neutral-200/90 bg-neutral-50/80 pl-8 pr-8",
                  "text-[13px] tracking-[-0.01em] text-neutral-900 shadow-none",
                  "placeholder:text-neutral-400",
                  "focus-visible:border-neutral-300 focus-visible:bg-white focus-visible:ring-0",
                )}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-neutral-400">
            No bookings
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-neutral-400">
            No results
          </p>
        ) : (
          <div className="min-w-0">
            {/* Full-bleed black header — covers dialog side hairlines */}
            <div
              className={cn(
                "relative left-1/2 w-[calc(100%+2px)] -translate-x-1/2",
                "grid grid-cols-[minmax(0,36%)_minmax(0,28%)_minmax(0,20%)_minmax(0,16%)]",
                "bg-neutral-950",
              )}
              role="row"
            >
              {(["Teacher", "Date", "Grade", "Period"] as const).map((label) => (
                <div
                  key={label}
                  role="columnheader"
                  className="px-5 py-2 text-left text-[11px] font-medium tracking-[-0.01em] text-white"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="board-scroll max-h-[min(22rem,58dvh)]">
              <table className="w-full min-w-[26rem] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[28%]" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <tbody>
                  {filteredRows.map((booking) => {
                    const teacher = teacherById.get(booking.teacherId)
                    const avatarUrl = teacher?.avatarUrl
                    const stamp = formatBookingTimestamp(booking)
                    const grade = bookingGradeLabel(booking)

                    return (
                      <tr
                        key={booking.id}
                        className="border-b border-[var(--hairline)] last:border-b-0 transition-colors hover:bg-neutral-50/70"
                      >
                        <td className="px-5 py-2.5 align-middle">
                          <div className="flex min-w-0 items-center gap-2">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={avatarUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="size-6 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[9px] font-medium text-neutral-500"
                                aria-hidden
                              >
                                {bookingTeacherInitials(booking.teacherName)}
                              </span>
                            )}
                            <span className="min-w-0 truncate text-[13px] tracking-[-0.01em] text-neutral-900">
                              {booking.teacherName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <span className="block truncate text-[12.5px] tabular-nums tracking-[-0.01em] text-neutral-600">
                            {stamp.primary}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <span className="block truncate text-[12.5px] tracking-[-0.01em] text-neutral-600">
                            {grade}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <span className="text-[12.5px] tabular-nums tracking-[-0.01em] text-neutral-600">
                            {booking.period}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReportsPanel({
  bookings,
  issues,
  carts,
  teachers,
  range,
  onOpenTab,
}: {
  bookings: Booking[]
  issues: Issue[]
  carts: Cart[]
  teachers: User[]
  range: DateRange | undefined
  onOpenTab: (tab: Tab) => void
}) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const cartMap = useMemo(() => new Map(carts.map((c) => [c.id, c])), [carts])
  const teacherById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers],
  )
  const totalBookings = bookings.length

  const stats = useMemo(() => {
    const teacherNames = new Map(teachers.map((t) => [t.id, t.name]))
    const usageByTeacher = new Map<string, { teacherId: string; teacherName: string; total: number; carts: Map<string, number> }>()
    const cartUsageByCart = new Map<string, { cartId: string; cartName: string; total: number; teachers: Map<string, number> }>()
    const bookingsByPeriod = new Map<string, number>()
    const bookingsBySubject = new Map<string, number>()
    const bookingsByDate = new Map<string, number>()

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return format(d, "yyyy-MM-dd")
    }).reverse()

    for (const b of bookings) {
      // Teacher usage
      const tName = teacherNames.get(b.teacherId) ?? b.teacherName ?? "Unknown"
      const tEntry = usageByTeacher.get(b.teacherId) ?? { teacherId: b.teacherId, teacherName: tName, total: 0, carts: new Map() }
      tEntry.total += 1
      tEntry.carts.set(b.cartId, (tEntry.carts.get(b.cartId) ?? 0) + 1)
      usageByTeacher.set(b.teacherId, tEntry)

      // Cart usage
      const cName = cartMap.get(b.cartId)?.name ?? "-"
      const cEntry = cartUsageByCart.get(b.cartId) ?? { cartId: b.cartId, cartName: cName, total: 0, teachers: new Map() }
      cEntry.total += 1
      cEntry.teachers.set(b.teacherId, (cEntry.teachers.get(b.teacherId) ?? 0) + 1)
      cartUsageByCart.set(b.cartId, cEntry)

      // Period & Subject
      bookingsByPeriod.set(b.period, (bookingsByPeriod.get(b.period) ?? 0) + 1)
      const sub = b.subject || "Unspecified"
      bookingsBySubject.set(sub, (bookingsBySubject.get(sub) ?? 0) + 1)

      // Activity by date
      if (last7Days.includes(b.date)) {
        bookingsByDate.set(b.date, (bookingsByDate.get(b.date) ?? 0) + 1)
      }
    }

    for (const t of teachers) {
      if (!usageByTeacher.has(t.id)) {
        usageByTeacher.set(t.id, { teacherId: t.id, teacherName: t.name, total: 0, carts: new Map() })
      }
    }

    const usageRowsWithCarts = [...usageByTeacher.values()]
      .sort((a, b) => b.total !== a.total ? b.total - a.total : a.teacherName.localeCompare(b.teacherName))
      .map((row) => {
        const cartEntries = [...row.carts.entries()].sort((a, b) => b[1] - a[1])
        const share = totalBookings > 0 ? Math.round((row.total / totalBookings) * 100) : 0
        return { ...row, cartEntries, topCartEntry: cartEntries[0], share }
      })

    const cartUsageRowsWithShare = [...cartUsageByCart.values()]
      .sort((a, b) => b.total !== a.total ? b.total - a.total : a.cartName.localeCompare(b.cartName))
      .map((row) => ({ ...row, share: totalBookings > 0 ? Math.round((row.total / totalBookings) * 100) : 0 }))

    const issueSeverityCounts: Record<Issue["severity"], number> = { low: 0, medium: 0, high: 0 }
    const issuesByCart = new Map<string, { cartId: string; total: number; open: number; high: number }>()
    const issuesByReporter = new Map<string, number>()

    for (const issue of issues) {
      issueSeverityCounts[issue.severity] += 1
      const reporterName = issue.reporterName || "Unknown"
      issuesByReporter.set(reporterName, (issuesByReporter.get(reporterName) ?? 0) + 1)

      const entry = issuesByCart.get(issue.cartId) ?? { cartId: issue.cartId, total: 0, open: 0, high: 0 }
      entry.total += 1
      if (issue.status === "open") {
        entry.open += 1
        if (issue.severity === "high") entry.high += 1
      }
      issuesByCart.set(issue.cartId, entry)
    }

    const issueRowsTop = [...issuesByCart.values()]
      .sort((a, b) => b.total !== a.total ? b.total - a.total : b.open !== a.open ? b.open - a.open : (cartMap.get(a.cartId)?.name ?? "").localeCompare(cartMap.get(b.cartId)?.name ?? "-"))
      .slice(0, 5)

    return {
      usageRowsWithCarts,
      activeTeachers: usageRowsWithCarts.filter(r => r.total > 0).length,
      cartUsageRowsWithShare,
      topCartUsageRows: cartUsageRowsWithShare.slice(0, 6),
      openIssues: issues.filter(i => i.status === "open"),
      resolvedIssues: issues.filter(i => i.status === "resolved"),
      maintenanceCartsCount: carts.filter(c => c.status === "maintenance").length,
      periodRows: [...bookingsByPeriod.entries()].sort((a, b) => b[1] - a[1]),
      subjectRows: [...bookingsBySubject.entries()].sort((a, b) => b[1] - a[1]),
      issueSeverityCounts,
      issueRowsTop,
      recentIssues: [...issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
      reporterRows: [...issuesByReporter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      activityData: last7Days.map(date => ({ date, day: format(parseISO(date), "EEE"), count: bookingsByDate.get(date) ?? 0 }))
    }
  }, [bookings, issues, carts, teachers, cartMap, totalBookings])

  const {
    usageRowsWithCarts,
    activeTeachers,
    topCartUsageRows,
    openIssues,
    maintenanceCartsCount,
    periodRows,
    subjectRows,
    issueSeverityCounts,
    recentIssues,
    activityData
  } = stats
  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`
      : format(range.from, "MMM d, yyyy")
    : ""

  function exportBookingsCsv() {
    const headers = ["Date", "Period", "Cart", "Teacher", "Class", "Subject", "Notes", "Created"]
    const rows = bookings.map((booking) => [
      booking.date,
      booking.period,
      cartMap.get(booking.cartId)?.name ?? "Cart",
      booking.teacherName,
      booking.className,
      booking.subject,
      booking.notes ?? "",
      booking.createdAt,
    ])
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cubicle-bookings-${format(new Date(), "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportIssuesCsv() {
    const headers = ["Date", "Cart", "Severity", "Status", "Reporter", "Description"]
    const rows = issues.map((issue) => [
      issue.createdAt,
      cartMap.get(issue.cartId)?.name ?? "Cart",
      issue.severity,
      issue.status,
      issue.reporterName,
      issue.description,
    ])
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cubicle-issues-${format(new Date(), "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportTeacherUsageCsv() {
    const headers = ["Teacher", "Total bookings", "Carts used", "Top cart", "Top cart bookings", "Cart mix"]
    const rows = usageRowsWithCarts.map((row) => {
      const topCartEntry = row.topCartEntry
      const topCartName = topCartEntry ? cartMap.get(topCartEntry[0])?.name ?? "Cart" : ""
      const cartMix = row.cartEntries
        .map(([cartId, count]) => `${cartMap.get(cartId)?.name ?? "Cart"} (${count})`)
        .join("; ")
      return [row.teacherName, row.total, row.carts.size, topCartName, topCartEntry?.[1] ?? 0, cartMix]
    })
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cubicle-teacher-usage-${format(new Date(), "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const equipmentHealth = carts.length > 0 ? Math.round(((carts.length - maintenanceCartsCount) / carts.length) * 100) : 0
  const highPriorityIssues = issues.filter(i => i.status === "open" && i.severity === "high")
  const topTeachers = usageRowsWithCarts.filter((row) => row.total > 0).slice(0, 6)

  const reportStatCell = cn(
    "flex min-h-[6.5rem] flex-col justify-between gap-3 px-4 py-4 sm:min-h-[7rem] sm:px-5 sm:py-5",
    "text-left transition-colors hover:bg-white/[0.04]",
  )
  const reportStatLabel =
    "text-[10px] font-medium uppercase tracking-[0.16em] text-white/45"
  const reportStatValue =
    "text-[1.875rem] font-light leading-none tracking-[-0.04em] text-white tabular-nums sm:text-[2.125rem]"

  return (
    <section className="print-root flex flex-col gap-4">
      {/* Toolbar — no card chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] tabular-nums tracking-[-0.01em] text-neutral-400">
          {rangeLabel ? (
            <>
              <span className="font-medium text-neutral-600">{rangeLabel}</span>
              <span className="mx-1.5 text-neutral-300">·</span>
            </>
          ) : null}
          {format(new Date(), "MMM d, yyyy")}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <LiquidMetalButton
              icon={<Download strokeWidth={1.75} />}
              trailing={
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  fill="none"
                  className="chevron origin-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                >
                  <path
                    d="M4.75 6.5 8 9.75 11.25 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            >
              Export
            </LiquidMetalButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-44 rounded-lg border-[var(--hairline-strong)] p-1 shadow-[var(--shadow-soft)]"
          >
            <DropdownMenuItem
              className="cursor-pointer rounded-md text-[12.5px]"
              onSelect={exportBookingsCsv}
            >
              Bookings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-md text-[12.5px]"
              onSelect={exportTeacherUsageCsv}
            >
              Teacher usage
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-md text-[12.5px]"
              onSelect={exportIssuesCsv}
            >
              Issues
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {highPriorityIssues.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-red-200/70 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0 text-red-600" />
            <span className="text-[12.5px] font-medium text-red-700">
              {highPriorityIssues.length} high-priority issue
              {highPriorityIssues.length === 1 ? "" : "s"} open
            </span>
          </div>
          <Link
            href="/issues"
            className="shrink-0 text-[12px] font-medium text-red-700 underline-offset-4 hover:underline"
          >
            View issues
          </Link>
        </div>
      ) : null}

      {/* Brand mesh strip — matches Schedule home stats */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08]">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 80% at 20% 0%, rgba(255,255,255,0.18) 0%, transparent 55%),
              radial-gradient(ellipse 80% 70% at 80% 15%, rgba(255,255,255,0.1) 0%, transparent 55%),
              radial-gradient(ellipse 70% 60% at 100% 40%, rgba(255,255,255,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 80% 70% at 50% 100%, rgba(255,255,255,0.06) 0%, transparent 55%),
              linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 40%, #000000 72%, #111111 100%)
            `,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07)_0%,transparent_45%,transparent_55%,rgba(255,255,255,0.04)_100%)]" />
        <div className="absolute -top-1/3 left-[-8%] h-[80%] w-[55%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.11)_0%,transparent_68%)] blur-3xl" />
        <div className="absolute -top-1/4 right-[-12%] h-[70%] w-[50%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,transparent_68%)] blur-3xl" />

        <div className="relative z-10 hidden md:flex">
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className={cn(reportStatCell, "min-w-0 flex-1")}
          >
            <span className={reportStatLabel}>Active carts</span>
            <span className={reportStatValue}>
              {equipmentHealth}
              <span className="ml-0.5 text-[0.42em] font-light text-white/40">
                %
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenTab("bookings")}
            className={cn(
              reportStatCell,
              "min-w-0 flex-1 border-l border-white/[0.08]",
            )}
          >
            <span className={reportStatLabel}>Reservations</span>
            <span className={reportStatValue}>{totalBookings}</span>
          </button>
          <div
            className={cn(
              reportStatCell,
              "min-w-0 flex-1 border-l border-white/[0.08] hover:bg-transparent",
            )}
          >
            <span className={reportStatLabel}>Teachers</span>
            <span className={reportStatValue}>{activeTeachers}</span>
          </div>
          <Link
            href="/issues"
            className={cn(
              reportStatCell,
              "min-w-0 flex-1 border-l border-white/[0.08]",
            )}
          >
            <span
              className={cn(
                reportStatLabel,
                openIssues.length > 0 && "text-red-300/90",
              )}
            >
              Issues
            </span>
            <span
              className={cn(
                reportStatValue,
                openIssues.length > 0 && "text-red-300",
              )}
            >
              {openIssues.length}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className={cn(
              reportStatCell,
              "min-w-0 flex-1 border-l border-white/[0.08]",
            )}
          >
            <span
              className={cn(
                reportStatLabel,
                maintenanceCartsCount > 0 && "text-amber-200/90",
              )}
            >
              Paused carts
            </span>
            <span
              className={cn(
                reportStatValue,
                maintenanceCartsCount > 0 && "text-amber-200",
              )}
            >
              {maintenanceCartsCount}
            </span>
          </button>
        </div>

        <div className="relative z-10 grid grid-cols-2 md:hidden">
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className={cn(reportStatCell, "border-b border-white/[0.08]")}
          >
            <span className={reportStatLabel}>Active carts</span>
            <span className={reportStatValue}>
              {equipmentHealth}
              <span className="ml-0.5 text-[0.42em] font-light text-white/40">
                %
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenTab("bookings")}
            className={cn(
              reportStatCell,
              "border-b border-l border-white/[0.08]",
            )}
          >
            <span className={reportStatLabel}>Reservations</span>
            <span className={reportStatValue}>{totalBookings}</span>
          </button>
          <div
            className={cn(
              reportStatCell,
              "border-b border-white/[0.08] hover:bg-transparent",
            )}
          >
            <span className={reportStatLabel}>Teachers</span>
            <span className={reportStatValue}>{activeTeachers}</span>
          </div>
          <Link
            href="/issues"
            className={cn(
              reportStatCell,
              "border-b border-l border-white/[0.08]",
            )}
          >
            <span
              className={cn(
                reportStatLabel,
                openIssues.length > 0 && "text-red-300/90",
              )}
            >
              Issues
            </span>
            <span
              className={cn(
                reportStatValue,
                openIssues.length > 0 && "text-red-300",
              )}
            >
              {openIssues.length}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className={cn(reportStatCell, "col-span-2")}
          >
            <span
              className={cn(
                reportStatLabel,
                maintenanceCartsCount > 0 && "text-amber-200/90",
              )}
            >
              Paused carts
            </span>
            <span
              className={cn(
                reportStatValue,
                maintenanceCartsCount > 0 && "text-amber-200",
              )}
            >
              {maintenanceCartsCount}
            </span>
          </button>
        </div>
      </div>

      {/* Charts — EvilCharts (Recharts) */}
      <ChartCard title="Last 7 days">
        <ActivityAreaChart data={activityData} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Teacher usage"
          action={
            <button
              type="button"
              onClick={() => onOpenTab("bookings")}
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
            >
              Reservations
            </button>
          }
        >
          <TeacherUsageBarChart rows={topTeachers} />
        </ChartCard>

        <ChartCard
          title="Cart utilization"
          action={
            <button
              type="button"
              onClick={() => onOpenTab("carts")}
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
            >
              Inventory
            </button>
          }
        >
          <CartUsageBarChart rows={topCartUsageRows} />
        </ChartCard>

        <ChartCard title="By period">
          <PeriodBarChart periodRows={periodRows} />
        </ChartCard>

        <ChartCard
          title="Issues by severity"
          action={
            <Link
              href="/issues"
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
            >
              Open issues
            </Link>
          }
        >
          <IssueSeverityPieChart counts={issueSeverityCounts} />
        </ChartCard>
      </div>

      {/* Top subjects — quiet chips; open sheet for breakdown */}
      <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
        <h3 className="type-section-title mb-3">Top subjects</h3>
        {subjectRows.length === 0 ? (
          <p className="text-[13px] text-neutral-400">No subjects yet</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {subjectRows.slice(0, 8).map(([subject, count]) => {
              const selected = selectedSubject === subject
              return (
                <li key={subject}>
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5",
                      "text-left transition-[background-color,border-color,color]",
                      selected
                        ? "border-neutral-300 bg-neutral-100 text-neutral-950"
                        : "border-transparent bg-neutral-50 text-neutral-700 hover:border-neutral-200 hover:bg-neutral-100/80 hover:text-neutral-950",
                    )}
                  >
                    <span className="text-[12.5px] font-medium tracking-[-0.01em]">
                      {subject}
                    </span>
                    <span
                      className={cn(
                        "text-[11.5px] tabular-nums",
                        selected ? "text-neutral-500" : "text-neutral-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <SubjectBookingsDialog
        subject={selectedSubject}
        bookings={bookings}
        teacherById={teacherById}
        onClose={() => setSelectedSubject(null)}
      />

      {/* Recent issues — full table */}
      <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="type-section-title">Recent issues</h3>
            <p className="mt-0.5 text-[12px] text-neutral-400">
              {recentIssues.length === 0
                ? "No reports yet"
                : `${Math.min(recentIssues.length, 8)} latest · ${openIssues.length} open`}
            </p>
          </div>
          <Link
            href="/issues"
            className="shrink-0 text-[12.5px] font-medium text-neutral-600 transition-colors hover:text-neutral-950"
          >
            View all
          </Link>
        </div>

        {recentIssues.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-neutral-400">
            No issues reported.
          </p>
        ) : (
          <div className="board-scroll">
            <table className="w-full min-w-[42rem] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[34%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--hairline)] bg-neutral-50/60">
                  {(
                    [
                      "Cart",
                      "Description",
                      "Severity",
                      "Status",
                      "Reporter",
                      "Reported",
                    ] as const
                  ).map((label) => (
                    <th
                      key={label}
                      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400 sm:px-5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentIssues.slice(0, 8).map((issue) => {
                  const cart = cartMap.get(issue.cartId)
                  const isOpen = issue.status === "open"
                  return (
                    <tr
                      key={issue.id}
                      className="border-t border-[var(--hairline)] transition-colors hover:bg-neutral-50/60"
                    >
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                            {cart?.name ?? "Cart"}
                          </p>
                          {cart?.location ? (
                            <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                              {cart.location}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-neutral-600">
                          {issue.description}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5",
                            "text-[11px] font-medium capitalize tracking-[-0.01em]",
                            issue.severity === "high" &&
                              "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/80",
                            issue.severity === "medium" &&
                              "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80",
                            issue.severity === "low" &&
                              "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200/80",
                          )}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5",
                            "text-[11px] font-medium capitalize tracking-[-0.01em]",
                            isOpen
                              ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/80"
                              : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
                          )}
                        >
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <p className="truncate text-[12.5px] font-medium text-neutral-800">
                          {issue.reporterName}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <div className="leading-tight">
                          <p className="text-[12.5px] font-medium tabular-nums text-neutral-800">
                            {format(parseISO(issue.createdAt), "MMM d")}
                          </p>
                          <p className="mt-0.5 text-[11.5px] tabular-nums text-neutral-400">
                            {format(parseISO(issue.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

const BOARD_PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]

function DailyBoardLite({ bookings, carts }: { bookings: Booking[]; carts: Cart[] }) {
  const [activeDate, setActiveDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const bookingsForDate = useMemo(
    () => bookings.filter((b) => b.date === activeDate),
    [bookings, activeDate],
  )
  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>()
    for (const b of bookingsForDate) map.set(`${b.cartId}:${b.period}`, b)
    return map
  }, [bookingsForDate])

  const go = (offset: number) => {
    setActiveDate(format(addDays(parseISO(activeDate), offset), "yyyy-MM-dd"))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:border-neutral-400 hover:text-foreground"
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] font-semibold text-foreground transition-colors hover:border-neutral-400"
            >
              <CalendarIcon className="size-3.5 text-muted-foreground" />
              {format(parseISO(activeDate), "EEE, MMM d, yyyy")}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className={calendarPopoverClassName}
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            avoidCollisions
          >
            <Calendar
              mode="single"
              selected={parseISO(activeDate)}
              onSelect={(d) => d && setActiveDate(format(d, "yyyy-MM-dd"))}
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => go(1)}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:border-neutral-400 hover:text-foreground"
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveDate(format(new Date(), "yyyy-MM-dd"))}
          className="h-9 rounded-lg px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
        >
          Today
        </button>

        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          {bookingsForDate.length} booking{bookingsForDate.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="board-scroll">
          <div className="board-track">
            <div className="board-cols grid border-b border-border bg-neutral-950">
              <div className="board-sticky-label bg-neutral-950 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 sm:px-4">
                Cart
              </div>
              {BOARD_PERIODS.map((p) => (
                <div
                  key={p}
                  className="border-l border-white/10 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white/70 sm:px-3"
                >
                  {p}
                </div>
              ))}
            </div>

            {carts.map((cart) => (
              <div
                key={cart.id}
                className="board-cols grid border-b border-border/70 last:border-b-0"
              >
                <div className="board-sticky-label flex min-h-12 items-center gap-2 border-r border-border/70 bg-neutral-50 px-3 sm:min-h-14 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{cart.name}</p>
                    {cart.location ? (
                      <p className="truncate text-[11px] text-muted-foreground">{cart.location}</p>
                    ) : null}
                  </div>
                  {cart.status === "maintenance" ? (
                    <Wrench className="size-3.5 shrink-0 text-red-500" />
                  ) : null}
                </div>

                {BOARD_PERIODS.map((p) => {
                  const b = bookingMap.get(`${cart.id}:${p}`)
                  if (cart.status === "maintenance" && !b) {
                    return (
                      <div
                        key={p}
                        className="flex min-h-14 items-center justify-center border-r border-border/70 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_6px)] last:border-r-0"
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
                          Offline
                        </span>
                      </div>
                    )
                  }
                  if (!b) {
                    return (
                      <div
                        key={p}
                        className="min-h-14 border-r border-border/70 last:border-r-0"
                      />
                    )
                  }
                  return (
                    <div
                      key={p}
                      className="min-h-14 border-r border-border/70 p-1.5 last:border-r-0"
                      title={`${b.teacherName}${b.className ? ` - ${b.className}` : ""}`}
                    >
                      <div className="flex h-full flex-col justify-center rounded-lg bg-neutral-100 px-2.5 py-1.5">
                        <span className="truncate text-[12px] font-semibold text-foreground">
                          {b.className?.trim() || b.teacherName}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {b.className?.trim() ? b.teacherName : b.subject?.trim() || "Reserved"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
