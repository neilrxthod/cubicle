"use client"

import { useState, useTransition, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Booking, BookingPolicy, Cart, Issue, User, Period, SlotRestriction, SwapRequest } from "@/lib/types"
import { setCartStatus, deleteBookings, reassignBooking, cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
  BarChart3,
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronDown,
  Download,
  Layers3,
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
} from "lucide-react"
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { StaffPanel } from "@/components/staff-panel"
import { RestrictionsPanel } from "@/components/restrictions-panel"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Tab = "carts" | "bookings" | "staff" | "reports" | "restrictions"

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
}: {
  label: string
  sortKey: string
  sortConfig: { key: string; direction: "asc" | "desc" } | null
  onSort: (key: string) => void
}) {
  return (
    <th className="px-3 py-3 text-left">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="group inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
        {sortConfig?.key === sortKey ? (
          sortConfig.direction === "asc" ? (
            <ArrowUp className="size-3 text-foreground" />
          ) : (
            <ArrowDown className="size-3 text-foreground" />
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
  slotRestrictions,
  bookingPolicy,
  swapRequests = [],
}: {
  carts: Cart[]
  bookings: Booking[]
  users: User[]
  issues: Issue[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
  swapRequests?: SwapRequest[]
}) {
  const [tab, setTab] = useState<Tab>("carts")
  const [range] = useState<DateRange | undefined>()
  // Reports / booking filters: teachers (include revoked so history still labels).
  const teachers = users.filter((user) => user.role === "teacher")

  const filteredBookings = useMemo(() => bookings.filter((b) => isDateInRange(parseISO(b.date), range)), [bookings, range])
  const filteredIssues = useMemo(() => issues.filter((issue) => isDateInRange(parseISO(issue.createdAt), range)), [issues, range])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "carts", label: "Inventory" },
    { id: "bookings", label: "Reservations" },
    { id: "reports", label: "Reports" },
    { id: "staff", label: "Staff" },
    { id: "restrictions", label: "Restrictions" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <nav
        className="inline-flex h-9 w-full max-w-full items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-[var(--hairline-strong)] bg-white p-0.5 shadow-[var(--shadow-surface)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:w-fit"
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

      {tab === "carts" ? (
        <CartsGrid carts={carts} />
      ) : tab === "bookings" ? (
        <BookingsTable bookings={filteredBookings} carts={carts} />
      ) : tab === "reports" ? (
        <ReportsPanel
          bookings={filteredBookings}
          issues={filteredIssues}
          carts={carts}
          teachers={teachers}
          range={range}
          onOpenTab={setTab}
        />
      ) : tab === "staff" ? (
        <StaffPanel
          users={users}
          bookings={bookings}
          issues={issues}
          carts={carts}
          swapRequests={swapRequests}
        />
      ) : (
        <RestrictionsPanel
          carts={carts}
          bookings={bookings}
          slotRestrictions={slotRestrictions}
          bookingPolicy={bookingPolicy}
        />
      )}
    </div>
  )
}

function CartsGrid({ carts }: { carts: Cart[] }) {
  const router = useRouter()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [optimisticStatusById, setOptimisticStatusById] = useState<Record<string, Cart["status"]>>({})
  const [, startTransition] = useTransition()

  function toggle(cart: Cart) {
    const current = optimisticStatusById[cart.id] ?? cart.status
    const next = current === "maintenance" ? "active" : "maintenance"
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
        toast({ title: "Could not update", description: res.error, variant: "destructive" })
        return
      }

      setPendingIds((prev) => {
        const s = new Set(prev)
        s.delete(cart.id)
        return s
      })
      // Drop optimistic once store has refreshed; keep until then for snappy UI
      setOptimisticStatusById((prev) => {
        const m = { ...prev }
        delete m[cart.id]
        return m
      })
      toast({
        title: cart.name,
        description: next === "maintenance" ? "Maintenance" : "Active",
      })
      router.refresh()
    })
  }

  const activeCount = carts.filter((c) => {
    const s = optimisticStatusById[c.id] ?? c.status
    return s === "active"
  }).length
  const maintenanceCount = carts.length - activeCount

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] tabular-nums text-neutral-400">
          <span className="font-medium text-neutral-700">{carts.length}</span> carts
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="text-emerald-700">{activeCount} active</span>
          {maintenanceCount > 0 ? (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              <span className="text-amber-700">{maintenanceCount} maintenance</span>
            </>
          ) : null}
        </p>
      </div>

      {carts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center text-[13px] text-neutral-400">
          No carts.
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {carts.map((cart) => {
            const visualStatus = optimisticStatusById[cart.id] ?? cart.status
            const isPending = pendingIds.has(cart.id)
            const offline = visualStatus === "maintenance"

            return (
              <div
                key={cart.id}
                className={cn(
                  "flex flex-col justify-between rounded-xl border bg-white p-3.5 shadow-[var(--shadow-surface)] transition-colors",
                  offline
                    ? "border-amber-200/90 bg-amber-50/40"
                    : "border-[var(--hairline-strong)] hover:border-neutral-300",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-neutral-950">
                      {cart.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                      {cart.location || "No location"}
                      {typeof cart.laptopCount === "number"
                        ? ` · ${cart.laptopCount} laptops`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={visualStatus} />
                </div>

                <div className="mt-3.5 flex justify-end">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggle(cart)}
                    className={cn(
                      "inline-flex h-8 min-w-[5.75rem] items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      offline
                        ? "bg-neutral-950 text-white hover:opacity-90"
                        : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-950",
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : offline ? (
                      <Wrench className="size-3" strokeWidth={1.75} />
                    ) : null}
                    {isPending ? "…" : offline ? "Resume" : "Pause"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function BookingsTable({ bookings, carts }: { bookings: Booking[]; carts: Cart[] }) {
  const cartMap = useMemo(() => new Map(carts.map((c) => [c.id, c])), [carts])
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

  function handleExportCSV() {
    const headers = ["Date", "Day", "Period", "Cart", "Class", "Subject", "Teacher"]
    const rows = filtered.map((b) => {
      const date = parseISO(b.date)
      return [
        format(date, "MMM d, yyyy"),
        format(date, "EEEE"),
        b.period,
        cartMap.get(b.cartId)?.name ?? "-",
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
    link.setAttribute("download", `bookings-export-${format(new Date(), "yyyy-MM-dd")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Exported" })
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const res = await deleteBookings(Array.from(selectedIds))
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
      } else {
        toast({
          title: "Deleted",
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

  const filterTrigger =
    "h-9 gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12.5px] font-medium text-neutral-800 shadow-none hover:bg-neutral-50 focus:ring-0 data-[state=open]:border-neutral-400 data-[placeholder]:text-neutral-400"

  const dateLabel = rangeFilter?.from
    ? rangeFilter.to
      ? `${format(rangeFilter.from, "MMM d")} - ${format(rangeFilter.to, "MMM d")}`
      : format(rangeFilter.from, "MMM d, yyyy")
    : dateFilter
      ? format(parseISO(dateFilter), "MMM d, yyyy")
      : "Date"

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(filterTrigger, "inline-flex min-w-[132px] items-center justify-between")}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className={cn(!(dateFilter || rangeFilter) && "text-muted-foreground")}>
                      {dateLabel}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-xl border-border p-0 shadow-lg" align="start">
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
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[130px]")}>
                <SelectValue placeholder="Teacher" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
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
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[120px]")}>
                <SelectValue placeholder="Cart" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
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
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[110px]")}>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
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
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {selectedIds.size > 0 ? (
              <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-900 bg-neutral-950 pl-3 pr-1 text-white">
                <span className="text-[12px] font-medium tabular-nums">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="ml-1 inline-flex h-7 items-center gap-1 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                  {isDeleting ? "..." : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="flex size-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50"
              >
                <Download className="size-3.5" />
                Export
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setDateFilter(todayKey)
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                dateFilter === todayKey && !showConflicts && !rangeFilter
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
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
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                dateFilter === tomorrowKey && !showConflicts && !rangeFilter
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
              )}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setRangeFilter({ from: startOfDay(new Date()), to: endOfDay(addDays(new Date(), 6)) })
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                rangeFilter?.from &&
                  rangeFilter?.to &&
                  format(rangeFilter.from, "yyyy-MM-dd") === todayKey &&
                  format(rangeFilter.to, "yyyy-MM-dd") === weekEndKey
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
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
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
                showConflicts ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              Conflicts
              {conflictsCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    showConflicts ? "bg-white/20 text-white" : "bg-red-600 text-white",
                  )}
                >
                  {conflictsCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {filtered.length}
              <span className="text-neutral-300"> / </span>
              {sorted.length}
            </span>
            <div className="inline-flex h-8 rounded-lg border border-border bg-neutral-50 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "rounded-md px-3 text-[12px] font-medium transition-colors",
                  view === "list"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "rounded-md px-3 text-[12px] font-medium transition-colors",
                  view === "board"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70 bg-neutral-50/80">
                <th className="w-11 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(new Set(filtered.map((b) => b.id)))
                      else setSelectedIds(new Set())
                    }}
                    aria-label="Select all"
                  />
                </th>
                <SortableHeader label="Date" sortKey="date" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Period" sortKey="period" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Cart" sortKey="cart" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Class" sortKey="class" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Teacher" sortKey="teacher" sortConfig={sortConfig} onSort={handleSort} />
                <th className="w-12 px-3 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                        <CalendarIcon className="size-5" />
                      </div>
                      <p className="text-[14px] font-semibold tracking-tight text-foreground">
                        {hasFilters ? "No matching reservations" : "No reservations yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                        {hasFilters
                          ? "Try clearing filters or adjusting the date range."
                          : "When teachers book carts, they will show up here."}
                      </p>
                      {hasFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 h-9 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white hover:bg-neutral-800"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const cart = cartMap.get(b.cartId)
                  const date = parseISO(b.date)
                  const isConflict = cart?.status === "maintenance"
                  const selected = selectedIds.has(b.id)

                  return (
                    <tr
                      key={b.id}
                      className={cn(
                        "group border-b border-border/60 transition-colors last:border-b-0",
                        selected
                          ? "bg-neutral-50"
                          : isConflict
                            ? "bg-red-50/40 hover:bg-red-50/70"
                            : "hover:bg-neutral-50/80",
                      )}
                    >
                      <td className="px-4 py-3.5">
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
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold tracking-tight text-foreground">
                            {format(date, "MMM d, yyyy")}
                          </span>
                          <span className="text-[12px] text-muted-foreground">{format(date, "EEEE")}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex h-6 items-center rounded-md bg-neutral-100 px-2 text-[11px] font-semibold tracking-wide text-neutral-800">
                          {b.period}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[13px] font-semibold tracking-tight",
                              isConflict ? "text-red-700" : "text-foreground",
                            )}
                          >
                            {cart?.name ?? "-"}
                          </span>
                          {isConflict ? <AlertTriangle className="size-3.5 text-red-600" /> : null}
                        </div>
                        {cart?.location ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{cart.location}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {b.className?.trim() || "-"}
                          </p>
                          {b.subject?.trim() ? (
                            <p className="truncate text-[11px] text-muted-foreground">{b.subject}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-foreground">{b.teacherName}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-neutral-100 hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-neutral-100 data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Open options</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-lg">
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 rounded-lg text-[13px]"
                              onClick={() => setReassigningBooking(b)}
                            >
                              <ArrowRightLeft className="size-4 text-muted-foreground" />
                              Reassign cart
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg text-[13px]" asChild>
                              <a
                                href={`mailto:${b.teacherName.toLowerCase().replace(/\s/g, ".")}@school.edu?subject=Regarding your cart booking for ${format(date, "MMM d")}`}
                              >
                                <Mail className="size-4 text-muted-foreground" />
                                Contact teacher
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="mt-0.5 cursor-pointer gap-2 rounded-lg text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Cancel ${b.teacherName}'s reservation on ${format(date, "MMM d")}?`,
                                  )
                                ) {
                                  return
                                }
                                const res = await cancelBooking(b.id)
                                if (!res.ok) {
                                  toast({ title: "Error", description: res.error, variant: "destructive" })
                                } else {
                                  toast({
                                    title: "Canceled",
                                    description: `Reservation for ${b.teacherName} removed.`,
                                  })
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                              Cancel booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-neutral-50/50 p-4 sm:p-5">
          <DailyBoardLite bookings={filtered} carts={carts} />
        </div>
      )}

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
                            toast({ title: "Could not reassign", description: res.error, variant: "destructive" })
                          } else {
                            toast({ title: "Reassigned", description: c.name })
                            setReassigningBooking(null)
                          }
                        } finally {
                          setIsReassigning(false)
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
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
  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const teacherNames = new Map(teachers.map((t) => [t.id, t.name]))
  const totalBookings = bookings.length

  const stats = useMemo(() => {
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
      recentIssues: [...issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
      reporterRows: [...issuesByReporter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      activityData: last7Days.map(date => ({ date, day: format(parseISO(date), "EEE"), count: bookingsByDate.get(date) ?? 0 }))
    }
  }, [bookings, issues, carts, teachers, cartMap, teacherNames, totalBookings])

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
  const maxActivity = Math.max(...activityData.map(d => d.count), 1)
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

  return (
    <section className="print-root flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-950">
              Reports
            </h2>
            <p className="mt-0.5 text-[12.5px] text-neutral-400">
              {rangeLabel ? `${rangeLabel} · ` : ""}
              {format(new Date(), "MMM d, yyyy")}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="h-9 rounded-lg px-3.5 text-[12.5px] font-medium"
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportBookingsCsv}>
                Bookings
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportTeacherUsageCsv}>
                Teacher usage
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportIssuesCsv}>
                Issues
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {highPriorityIssues.length > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200/80 bg-red-50/50 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle className="size-3.5 shrink-0 text-red-600" />
              <span className="text-[12.5px] font-medium text-red-800">
                {highPriorityIssues.length} high-priority issue
                {highPriorityIssues.length === 1 ? "" : "s"} open
              </span>
            </div>
            <Link
              href="/issues"
              className="shrink-0 text-[12px] font-medium text-red-700 hover:text-red-900"
            >
              View
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className="flex flex-col gap-1 rounded-xl border border-[var(--hairline-strong)] bg-neutral-50/40 px-3.5 py-3.5 text-left transition hover:bg-neutral-50"
          >
            <span className="type-label text-neutral-400">Fleet</span>
            <span className="type-metric text-neutral-950">{equipmentHealth}%</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenTab("bookings")}
            className="flex flex-col gap-1 rounded-xl border border-[var(--hairline-strong)] bg-neutral-50/40 px-3.5 py-3.5 text-left transition hover:bg-neutral-50"
          >
            <span className="type-label text-neutral-400">Bookings</span>
            <span className="type-metric text-neutral-950">{totalBookings}</span>
          </button>
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--hairline-strong)] bg-neutral-50/40 px-3.5 py-3.5">
            <span className="type-label text-neutral-400">Teachers</span>
            <span className="type-metric text-neutral-950">{activeTeachers}</span>
          </div>
          <Link
            href="/issues"
            className={cn(
              "flex flex-col gap-1 rounded-xl border px-3.5 py-3.5 transition",
              openIssues.length > 0
                ? "border-red-200/90 bg-red-50/40 hover:bg-red-50/70"
                : "border-[var(--hairline-strong)] bg-neutral-50/40 hover:bg-neutral-50",
            )}
          >
            <span
              className={cn(
                "type-label",
                openIssues.length > 0 ? "text-red-600" : "text-neutral-400",
              )}
            >
              Issues
            </span>
            <span
              className={cn(
                "type-metric",
                openIssues.length > 0 ? "text-red-600" : "text-neutral-950",
              )}
            >
              {openIssues.length}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => onOpenTab("carts")}
            className={cn(
              "flex flex-col gap-1 rounded-xl border px-3.5 py-3.5 text-left transition",
              maintenanceCartsCount > 0
                ? "border-amber-200/90 bg-amber-50/40 hover:bg-amber-50/70"
                : "border-[var(--hairline-strong)] bg-neutral-50/40 hover:bg-neutral-50",
            )}
          >
            <span
              className={cn(
                "type-label",
                maintenanceCartsCount > 0 ? "text-amber-800" : "text-neutral-400",
              )}
            >
              Maintenance
            </span>
            <span
              className={cn(
                "type-metric",
                maintenanceCartsCount > 0 ? "text-amber-800" : "text-neutral-950",
              )}
            >
              {maintenanceCartsCount}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="type-section-title">Teacher usage</h3>
              <button
                type="button"
                onClick={() => onOpenTab("bookings")}
                className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
              >
                Reservations
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-neutral-100">
              {topTeachers.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-neutral-400">
                  No bookings yet.
                </p>
              ) : (
                <ul>
                  {topTeachers.map((row, index) => {
                    const topCart = row.topCartEntry
                      ? cartMap.get(row.topCartEntry[0])?.name ?? "Cart"
                      : "—"
                    return (
                      <li
                        key={row.teacherId}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3.5 py-2.5",
                          index > 0 && "border-t border-neutral-100",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-neutral-950">
                            {row.teacherName}
                          </p>
                          <p className="truncate text-[12px] text-neutral-400">
                            Top: {topCart}
                            {row.share > 0 ? ` · ${row.share}%` : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                          {row.total}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="type-section-title">Cart utilization</h3>
              <button
                type="button"
                onClick={() => onOpenTab("carts")}
                className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
              >
                Inventory
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-neutral-100">
              {topCartUsageRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-neutral-400">
                  No cart activity yet.
                </p>
              ) : (
                <ul>
                  {topCartUsageRows.map((row, index) => (
                    <li
                      key={row.cartId}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3.5 py-2.5",
                        index > 0 && "border-t border-neutral-100",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-neutral-950">
                          {row.cartName}
                        </p>
                        <p className="text-[12px] text-neutral-400">
                          {row.teachers.size} teacher
                          {row.teachers.size === 1 ? "" : "s"}
                          {row.share > 0 ? ` · ${row.share}%` : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                        {row.total}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
            <h3 className="type-section-title mb-3">Booking mix</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-100 p-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  By period
                </p>
                {periodRows.length === 0 ? (
                  <p className="text-[13px] text-neutral-400">No data</p>
                ) : (
                  <ul className="space-y-1.5">
                    {periodRows.slice(0, 5).map(([period, count]) => (
                      <li
                        key={period}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-neutral-800">{period}</span>
                        <span className="tabular-nums text-neutral-400">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-neutral-100 p-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  By subject
                </p>
                {subjectRows.length === 0 ? (
                  <p className="text-[13px] text-neutral-400">No data</p>
                ) : (
                  <ul className="space-y-1.5">
                    {subjectRows.slice(0, 5).map(([subject, count]) => (
                      <li
                        key={subject}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="truncate text-neutral-800">{subject}</span>
                        <span className="shrink-0 tabular-nums text-neutral-400">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="type-section-title">Issues</h3>
              <Link
                href="/issues"
                className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800"
              >
                Open issues
              </Link>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {(["high", "medium", "low"] as const).map((severity) => (
                <div
                  key={severity}
                  className="rounded-lg bg-neutral-50 px-2.5 py-2 text-center"
                >
                  <p className="text-[10px] font-medium capitalize text-neutral-400">
                    {severity}
                  </p>
                  <p className="text-[15px] font-semibold tabular-nums text-neutral-900">
                    {issueSeverityCounts[severity]}
                  </p>
                </div>
              ))}
            </div>
            {recentIssues.length === 0 ? (
              <p className="text-[13px] text-neutral-400">No issues reported.</p>
            ) : (
              <ul className="space-y-2">
                {recentIssues.slice(0, 4).map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-950">
                        {cartMap.get(issue.cartId)?.name ?? "Cart"}
                      </p>
                      <p className="truncate text-[12px] text-neutral-400">
                        {issue.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-medium capitalize",
                        issue.status === "open"
                          ? "text-red-600"
                          : "text-neutral-400",
                      )}
                    >
                      {issue.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
      </div>

      <div className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
        <h3 className="type-section-title mb-3">Last 7 days</h3>
        <div className="grid grid-cols-7 gap-2">
          {activityData.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-2 rounded-lg border border-neutral-100 px-1 py-2.5"
            >
              <span className="text-[11px] font-medium text-neutral-400">
                {day.day}
              </span>
              <div className="flex h-14 w-full items-end justify-center px-1">
                <div
                  className="w-full max-w-[1.1rem] rounded-sm bg-neutral-900"
                  style={{
                    height: `${Math.max(
                      (day.count / maxActivity) * 100,
                      day.count > 0 ? 12 : 4,
                    )}%`,
                  }}
                  title={`${day.count} bookings`}
                />
              </div>
              <span className="text-[12px] font-semibold tabular-nums text-neutral-900">
                {day.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: "active" | "maintenance" }) {
  const isMaint = status === "maintenance"

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium",
        isMaint
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-50 text-emerald-700",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isMaint ? "bg-amber-500" : "bg-emerald-500",
        )}
      />
      {isMaint ? "Maintenance" : "Active"}
    </span>
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
          <PopoverContent className="w-auto rounded-xl p-0 shadow-lg" align="start">
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
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] border-b border-border bg-neutral-950">
              <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Cart
              </div>
              {BOARD_PERIODS.map((p) => (
                <div
                  key={p}
                  className="border-l border-white/10 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white/70"
                >
                  {p}
                </div>
              ))}
            </div>

            {carts.map((cart) => (
              <div
                key={cart.id}
                className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] border-b border-border/70 last:border-b-0"
              >
                <div className="flex min-h-14 items-center gap-2 border-r border-border/70 bg-neutral-50/60 px-4">
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
