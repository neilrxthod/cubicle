"use client"

import { useEffect, useState, useTransition, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Booking, BookingPolicy, Cart, Issue, User, Period, SlotRestriction, RestrictionCategory } from "@/lib/types"
import { setCartStatus } from "@/lib/actions"
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
} from "lucide-react"
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { TeacherCredentialsPanel } from "@/components/teacher-credentials-panel"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteBookings, reassignBooking, cancelBooking, toggleSlotRestriction, batchRestrictSlots, updateBookingPolicy } from "@/lib/actions"
import { Switch } from "@/components/ui/switch"
import { ShieldCheck, Settings2, Lock, History, Unlock, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react"

type Tab = "carts" | "bookings" | "teachers" | "reports" | "restrictions"

function isDateInRange(date: Date, range: DateRange | undefined) {
  if (!range?.from) return true
  const start = startOfDay(range.from)
  const end = range.to ? endOfDay(range.to) : endOfDay(range.from)
  return isWithinInterval(date, { start, end })
}
export function AdminConsole({
  carts,
  bookings,
  users,
  issues,
  slotRestrictions,
  bookingPolicy,
}: {
  carts: Cart[]
  bookings: Booking[]
  users: User[]
  issues: Issue[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
}) {
  const [tab, setTab] = useState<Tab>("carts")
  const [range, setRange] = useState<DateRange | undefined>()
  const teachers = users.filter((user) => user.role === "teacher")

  const filteredBookings = useMemo(() => bookings.filter((b) => isDateInRange(parseISO(b.date), range)), [bookings, range])
  const filteredIssues = useMemo(() => issues.filter((issue) => isDateInRange(parseISO(issue.createdAt), range)), [issues, range])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 border-b border-border/40 pb-px sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex items-center gap-8">
          <TabButton active={tab === "carts"} onClick={() => setTab("carts")}>
            Inventory
          </TabButton>
          <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>
            Reservations
          </TabButton>
          <TabButton active={tab === "reports"} onClick={() => setTab("reports")}>
            Reports
          </TabButton>
          <TabButton active={tab === "teachers"} onClick={() => setTab("teachers")}>
            Credentials
          </TabButton>
          <TabButton active={tab === "restrictions"} onClick={() => setTab("restrictions")}>
            Restrictions
          </TabButton>
        </nav>

        {tab === "teachers" ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {teachers.length} teachers
          </p>
        ) : null}
      </div>

      <div className="min-h-100">
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
          />
        ) : tab === "restrictions" ? (
          <RestrictionsPanel carts={carts} bookings={bookings} slotRestrictions={slotRestrictions} bookingPolicy={bookingPolicy} />
        ) : (
          <TeacherCredentialsPanel teachers={teachers} />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px pb-4 text-[12px] font-bold uppercase tracking-widest transition-all",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 w-full bg-foreground" />
      )}
    </button>
  )
}

function CartsGrid({ carts }: { carts: Cart[] }) {
  const router = useRouter()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [optimisticStatusById, setOptimisticStatusById] = useState<Record<string, Cart["status"]>>({})
  const [, startTransition] = useTransition()

  useEffect(() => {
    setOptimisticStatusById((prev) => {
      let changed = false
      const nextMap = { ...prev }

      for (const cart of carts) {
        if (nextMap[cart.id] === cart.status) {
          delete nextMap[cart.id]
          changed = true
        }
      }

      return changed ? nextMap : prev
    })
  }, [carts])

  useEffect(() => {
    setPendingIds((prev) => {
      let changed = false
      const nextSet = new Set(prev)
      for (const id of prev) {
        const cart = carts.find(c => c.id === id)
        const target = optimisticStatusById[id]
        if (cart && target && cart.status === target) {
          nextSet.delete(id)
          changed = true
        }
      }
      return changed ? nextSet : prev
    })
  }, [carts, optimisticStatusById])

  function toggle(cart: Cart) {
    const current = optimisticStatusById[cart.id] ?? cart.status
    const next = current === "maintenance" ? "active" : "maintenance"
    setPendingIds(prev => {
      const s = new Set(prev)
      s.add(cart.id)
      return s
    })

    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setOptimisticStatusById((prev) => ({ ...prev, [cart.id]: next }))

      const res = await setCartStatus(cart.id, next)

      if (res && "error" in res && res.error) {
        setOptimisticStatusById((prev) => {
          const m = { ...prev }
          delete m[cart.id]
          return m
        })
        setPendingIds(prev => {
          const s = new Set(prev)
          s.delete(cart.id)
          return s
        })
        toast({ title: "Could not update", description: res.error, variant: "destructive" })
        return
      }

      toast({ title: `${cart.name} is now ${next === "maintenance" ? "in maintenance" : "active"}` })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {carts.map((cart) => {
        const optimisticStatus = optimisticStatusById[cart.id] ?? cart.status
        const isPending = pendingIds.has(cart.id)
        const visualStatus = isPending ? cart.status : optimisticStatus
        const nextActionLabel = visualStatus === "maintenance" ? "Resume" : "Pause"

        return (
          <div
            key={cart.id}
            className={cn(
              "relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl border bg-background p-6",
              "transition-[border-color,background-color] duration-300 ease-out",
              visualStatus === "maintenance"
                ? "border-red-200/70 bg-red-50/25"
                : "border-border/70"
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-px",
                visualStatus === "maintenance" ? "bg-red-300/80" : "bg-foreground/10"
              )}
            />

            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{cart.name}</h3>
                </div>
                <StatusBadge status={visualStatus} />
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggle(cart)}
                className={cn(
                  "inline-flex h-8 min-w-[120px items-center justify-center gap-1.5 rounded-full px-3.5 text-[10px] font-medium uppercase tracking-wider",
                  "transform-gpu transition-[background-color,color,border-color] duration-200",
                  "disabled:cursor-not-allowed disabled:opacity-80",
                  visualStatus === "maintenance"
                    ? "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-600/80"
                    : "border border-border/80 bg-background text-muted-foreground hover:border-foreground/20 hover:bg-foreground/5 hover:text-foreground disabled:bg-muted/50"
                )}
              >
                {isPending && <Loader2 className="size-3 animate-spin" />}
                {isPending ? "Updating..." : nextActionLabel}
              </button>
            </div>
          </div>
        )
      })}
    </div>
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

  const sorted = useMemo(() => {
    const s = [...bookings]
    if (sortConfig !== null) {
      const { key, direction } = sortConfig
      s.sort((a, b) => {
        let valA: string | number = ""
        let valB: string | number = ""

        if (key === "date") { valA = a.date; valB = b.date }
        else if (key === "period") { valA = a.period; valB = b.period }
        else if (key === "cart") { valA = cartMap.get(a.cartId)?.name ?? ""; valB = cartMap.get(b.cartId)?.name ?? "" }
        else if (key === "class") { valA = a.className; valB = b.className }
        else if (key === "subject") { valA = a.subject; valB = b.subject }
        else if (key === "teacher") { valA = a.teacherName; valB = b.teacherName }

        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
      })
      return s
    }
    return s.sort((a, b) => a.date === b.date ? a.period.localeCompare(b.period) : b.date.localeCompare(a.date))
  }, [bookings, sortConfig, cartMap])

  const teachers = useMemo(() => [...new Set(bookings.map((b) => b.teacherName))].sort(), [bookings])
  const cartNames = useMemo(() => [...new Set(bookings.map((b) => cartMap.get(b.cartId)?.name ?? "Ã¢â‚¬â€"))].sort(), [bookings, cartMap])
  const periods = useMemo(() => [...new Set(bookings.map((b) => b.period))].sort(), [bookings])

  const q = query.toLowerCase().trim()
  const filtered = useMemo(() => sorted.filter((b) => {
    if (showConflicts) {
      const cart = cartMap.get(b.cartId)
      const isConflict = cart && cart.status === "maintenance"
      if (!isConflict) return false
    }
    const bDate = parseISO(b.date)
    if (rangeFilter) {
      if (!isWithinInterval(bDate, {
        start: startOfDay(rangeFilter.from!),
        end: endOfDay(rangeFilter.to || rangeFilter.from!)
      })) return false
    } else if (dateFilter && b.date !== dateFilter) {
      return false
    }
    if (teacherFilter && b.teacherName !== teacherFilter) return false
    if (cartFilter && (cartMap.get(b.cartId)?.name ?? "Ã¢â‚¬â€") !== cartFilter) return false
    if (periodFilter && b.period !== periodFilter) return false
    if (q) {
      const searchable = [
        format(bDate, "MMM d"),
        format(bDate, "EEE"),
        b.period,
        cartMap.get(b.cartId)?.name ?? "",
        b.teacherName,
      ].join(" ").toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  }), [sorted, showConflicts, cartMap, rangeFilter, dateFilter, teacherFilter, cartFilter, periodFilter, q])

  const hasFilters = q || dateFilter || rangeFilter || teacherFilter || cartFilter || periodFilter || showConflicts

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

  // Clear selection when filters change to avoid accidental batch actions on hidden items
  useEffect(() => {
    setSelectedIds(new Set())
  }, [query, dateFilter, rangeFilter, teacherFilter, cartFilter, periodFilter, showConflicts])

  function handleSort(key: string) {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  function SortableHeader({ label, sortKey }: { label: string; sortKey: string }) {
    return (
      <th className="border-b border-r border-border/50 px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground group">
        <button
          onClick={() => handleSort(sortKey)}
          className="flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm"
        >
          {label}
          {sortConfig?.key === sortKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="size-3 text-foreground" />
            ) : (
              <ArrowDown className="size-3 text-foreground" />
            )
          ) : (
            <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </button>
      </th>
    )
  }

  function handleExportCSV() {
    const headers = ["Date", "Day", "Period", "Cart", "Teacher"]
    const rows = filtered.map((b) => {
      const date = parseISO(b.date)
      const cartName = cartMap.get(b.cartId)?.name ?? "Ã¢â‚¬â€"
      return [
        format(date, "MMM d, yyyy"),
        format(date, "EEEE"),
        b.period,
        cartName,
        b.teacherName,
      ]
        .map((val) => `"${val}"`)
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
    toast({ title: "Export complete", description: "CSV file has been downloaded." })
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const res = await deleteBookings(Array.from(selectedIds))
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Bookings deleted", description: `Successfully removed ${selectedIds.size} reservations.` })
        setSelectedIds(new Set())
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const conflictsCount = bookings.filter(b => {
    const cart = cartMap.get(b.cartId)
    return cart && cart.status === "maintenance"
  }).length

  const selectClass = "h-8 rounded-full border border-dashed border-border/80 bg-background px-3.5 text-[12px] font-medium transition-colors hover:border-foreground/30 hover:bg-muted/10 focus:ring-1 focus:ring-foreground/10"

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bookingsÃ¢â‚¬Â¦"
              className="h-8 w-full rounded-md border border-border/60 bg-background pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 sm:w-56"
            />
          </div>
          <div className="hidden items-center gap-1 sm:flex border-l border-border/60 pl-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black px-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-black/80 active:scale-95"
            >
              <Download className="size-3" strokeWidth={2.5} />
              CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 fade-in duration-200">
              <div className="flex items-center gap-1.5 rounded-full bg-foreground px-2 py-1 shadow-md">
                <span className="text-[11px] font-bold text-background tracking-wide pl-2 pr-1">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 rounded-full bg-background/15 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-background transition-all hover:bg-destructive hover:text-white disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : (
                    <>
                      <Trash2 className="size-3" />
                      Delete
                    </>
                  )}
                </button>
                <div className="h-3 w-px bg-background/20 mx-0.5" />
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center justify-center rounded-full p-1 text-background/60 transition-colors hover:bg-background/20 hover:text-background mr-0.5"
                  title="Clear selection"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(selectClass, "group flex w-auto min-w-[130px items-center gap-2.5 text-left text-muted-foreground hover:text-foreground data-[state=open]:border-foreground/30 data-[state=open]:bg-muted/10 data-[state=open]:text-foreground")}>
                    <CalendarIcon className="size-3.5 shrink-0" />
                    <span className="truncate flex-1">
                      {rangeFilter ? (
                        rangeFilter.to ? (
                          `${format(rangeFilter.from!, "MMM d")} - ${format(rangeFilter.to, "MMM d")}`
                        ) : (
                          format(rangeFilter.from!, "MMM d, yyyy")
                        )
                      ) : dateFilter ? (
                        format(parseISO(dateFilter), "MMM d, yyyy")
                      ) : (
                        "Select Date"
                      )}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={rangeFilter}
                    onSelect={(r) => {
                      setRangeFilter(r)
                      setDateFilter("")
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Select value={teacherFilter || "all"} onValueChange={(v) => setTeacherFilter(v === "all" ? "" : v)}>
                <SelectTrigger className={cn(selectClass, "group w-auto min-w-27.5 gap-2 data-[state=open]:border-foreground/30 data-[state=open]:bg-muted/10 [&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180", !teacherFilter && "text-muted-foreground")}>
                  <SelectValue placeholder="Teacher" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-lg" align="start">
                  <SelectItem value="all" className="text-[12px] font-medium">All teachers</SelectItem>
                  {teachers.map((t) => <SelectItem key={t} value={t} className="text-[12px]">{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cartFilter || "all"} onValueChange={(v) => setCartFilter(v === "all" ? "" : v)}>
                <SelectTrigger className={cn(selectClass, "group w-auto min-w-25 gap-2 data-[state=open]:border-foreground/30 data-[state=open]:bg-muted/10 [&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180", !cartFilter && "text-muted-foreground")}>
                  <SelectValue placeholder="Cart" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-lg" align="start">
                  <SelectItem value="all" className="text-[12px] font-medium">All carts</SelectItem>
                  {cartNames.map((c) => <SelectItem key={c} value={c} className="text-[12px]">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={periodFilter || "all"} onValueChange={(v) => setPeriodFilter(v === "all" ? "" : v)}>
                <SelectTrigger className={cn(selectClass, "group w-auto min-w-25 gap-2 data-[state=open]:border-foreground/30 data-[state=open]:bg-muted/10 [&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180", !periodFilter && "text-muted-foreground")}>
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-lg" align="start">
                  <SelectItem value="all" className="text-[12px] font-medium">All periods</SelectItem>
                  {periods.map((p) => <SelectItem key={p} value={p} className="text-[12px]">{p}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-1">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground transition-all hover:bg-muted/20 hover:text-foreground",
                    (!hasFilters) ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}
                >
                  <X className="size-3" />
                  Clear
                </button>

                <span className="min-w-16.25 text-right text-[11px] tabular-nums text-muted-foreground">
                  {filtered.length} of {sorted.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 bg-muted/5 px-4 py-2 overflow-x-auto">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mr-2 shrink-0">Quick Views</span>
        <button
          onClick={() => { clearFilters(); setDateFilter(format(new Date(), "yyyy-MM-dd")) }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            dateFilter === format(new Date(), "yyyy-MM-dd") && !showConflicts && !teacherFilter && !cartFilter && !periodFilter && !query
              ? "border-foreground bg-foreground text-background"
              : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          Today
        </button>
        <button
          onClick={() => { clearFilters(); setDateFilter(format(addDays(new Date(), 1), "yyyy-MM-dd")) }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            dateFilter === format(addDays(new Date(), 1), "yyyy-MM-dd") && !showConflicts && !teacherFilter && !cartFilter && !periodFilter && !query
              ? "border-foreground bg-foreground text-background"
              : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          Tomorrow
        </button>
        <button
          onClick={() => {
            clearFilters();
            const start = startOfDay(new Date());
            const end = endOfDay(addDays(new Date(), 6));
            setRangeFilter({ from: start, to: end });
          }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            rangeFilter?.from && rangeFilter?.to && format(rangeFilter.from, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && format(rangeFilter.to, "yyyy-MM-dd") === format(addDays(new Date(), 6), "yyyy-MM-dd")
              ? "border-foreground bg-foreground text-background"
              : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          This Week
        </button>
        <button
          onClick={() => { clearFilters(); setShowConflicts(true) }}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            showConflicts
              ? "border-destructive/50 bg-destructive/15 text-destructive"
              : "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
          )}
        >
          Conflicts
          {conflictsCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
              {conflictsCount}
            </span>
          )}
        </button>

        <div className="ml-auto relative flex items-center rounded-full bg-muted/10 p-1 border border-border/40 backdrop-blur-sm overflow-hidden min-w-30">
          <div
            className="absolute inset-y-1 rounded-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-sm"
            style={{
              left: view === "list" ? "4px" : "calc(50% + 2px)",
              width: "calc(50% - 6px)"
            }}
          />
          <button
            onClick={() => setView("list")}
            className={cn(
              "relative z-10 flex-1 rounded-full px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-widest transition-colors duration-300 focus:outline-none",
              view === "list" ? "text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            List
          </button>
          <button
            onClick={() => setView("board")}
            className={cn(
              "relative z-10 flex-1 rounded-full px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-widest transition-colors duration-300 focus:outline-none",
              view === "board" ? "text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden min-h-100">
        {/* List View */}
        <div
          className={cn(
            "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
            view === "list"
              ? "opacity-100 translate-x-0 relative z-10"
              : "opacity-0 -translate-x-8 absolute inset-x-0 top-0 pointer-events-none z-0"
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/90 backdrop-blur-sm">
                  <th className="border-b border-r border-border/50 px-3 py-2.5 w-10" aria-label="Select all rows">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filtered.map(b => b.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                    />
                  </th>
                  <SortableHeader label="Date" sortKey="date" />
                  <SortableHeader label="Period" sortKey="period" />
                  <SortableHeader label="Cart" sortKey="cart" />
                  <SortableHeader label="Teacher" sortKey="teacher" />
                  <th className="border-b border-border/50 px-3 py-2.5 w-10" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-20">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 border border-border/50">
                          <CalendarIcon className="size-5 text-muted-foreground" />
                        </div>
                        <div className="text-[14px] font-semibold text-foreground">
                          {hasFilters ? "No matching reservations" : "No reservations found"}
                        </div>
                        <div className="text-[12px] text-muted-foreground max-w-50 text-center">
                          {hasFilters ? "Try adjusting your filters or search terms to find what you're looking for." : "It looks like there are no active bookings in the system yet."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((b, i) => {
                    const cart = cartMap.get(b.cartId)
                    const date = parseISO(b.date)
                    const isConflict = cart && cart.status === "maintenance"

                    return (
                      <tr key={b.id} className={cn(
                        "group/row transition-colors",
                        isConflict ? "bg-red-50/30 hover:bg-red-50/50" : i % 2 === 1 ? "bg-muted/10 hover:bg-muted/20" : "hover:bg-muted/5",
                        selectedIds.has(b.id) && "bg-foreground/3 shadow-[inset_2px_0_0_0_var(--color-foreground)]"
                      )}>
                        <td className="border-b border-r border-border/30 px-3 py-2">
                          <Checkbox
                            checked={selectedIds.has(b.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds)
                              if (checked) next.add(b.id)
                              else next.delete(b.id)
                              setSelectedIds(next)
                            }}
                          />
                        </td>
                        <td className="border-b border-r border-border/30 px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold tracking-tight text-foreground">{format(date, "MMM d, yyyy")}</span>
                            <span className="text-[11px] font-medium text-muted-foreground">{format(date, "EEEE")}</span>
                          </div>
                        </td>
                        <td className="border-b border-r border-border/30 px-3 py-2">
                          <span className="inline-flex h-6 items-center justify-center rounded-md border border-border/60 bg-muted/20 px-2 text-[9.5px] font-bold uppercase tracking-widest text-foreground shadow-sm">
                            {b.period}
                          </span>
                        </td>
                        <td className="border-b border-r border-border/30 px-3 py-2">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span className={cn(isConflict && "text-red-600 font-bold")}>{cart?.name ?? "Ã¢â‚¬â€"}</span>
                            {isConflict && <AlertTriangle className="size-3.5 text-red-600" />}
                          </div>
                        </td>
                        <td className="border-b border-r border-border/30 px-3 py-2 font-semibold tracking-tight text-foreground">{b.teacherName}</td>
                        <td className="border-b border-border/30 px-3 py-2 text-center">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Open options</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 font-medium shadow-lg rounded-xl">
                              <DropdownMenuItem
                                className="text-[13px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                                onClick={() => setReassigningBooking(b)}
                              >
                                <ArrowRightLeft className="size-4 text-muted-foreground" />
                                Reassign cart
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                                asChild
                              >
                                <a href={`mailto:${b.teacherName.toLowerCase().replace(/\s/g, ".")}@school.edu?subject=Regarding your cart booking for ${format(date, "MMM d")}`}>
                                  <Mail className="size-4 text-muted-foreground" />
                                  Contact teacher
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 mt-1"
                                onClick={async (e) => {
                                  if (!window.confirm(`Are you sure you want to cancel the reservation for ${b.teacherName} on ${format(date, "MMM d")}? This action cannot be undone.`)) {
                                    e.preventDefault()
                                    return
                                  }
                                  const res = await cancelBooking(b.id)
                                  if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" })
                                  else toast({ title: "Booking canceled", description: `Reservation for ${b.teacherName} removed.` })
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
        </div>

        {/* Board View */}
        <div
          className={cn(
            "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
            view === "board"
              ? "opacity-100 translate-x-0 relative z-10"
              : "opacity-0 translate-x-8 absolute inset-x-0 top-0 pointer-events-none z-0"
          )}
        >
          <div className="p-4 bg-muted/5">
            <DailyBoardLite bookings={filtered} carts={carts} />
          </div>
        </div>
      </div>

      <Dialog open={!!reassigningBooking} onOpenChange={(open) => !open && setReassigningBooking(null)}>
        <DialogContent className="sm:max-w-175 w-[95vw] p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl bg-background max-h-[85vh] flex flex-col">
          <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
            {/* Left Column (Sticky Context) */}
            <div className="sm:w-60 bg-muted/10 p-6 sm:p-7 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-border/50 shrink-0 z-10">
              <div className="space-y-6 sm:space-y-8">
                <DialogHeader className="text-left p-0">
                  <DialogTitle className="text-[18px] font-semibold tracking-tight text-foreground">Reassign Cart</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-1 gap-4 sm:gap-6">
                  <div className="space-y-1 sm:space-y-1.5">
                    <p className="text-[11px] sm:text-[12px] font-medium text-muted-foreground">Teacher</p>
                    <p className="text-[13px] sm:text-[14px] font-medium text-foreground truncate">{reassigningBooking?.teacherName}</p>
                  </div>
                  <div className="space-y-1 sm:space-y-1.5">
                    <p className="text-[11px] sm:text-[12px] font-medium text-muted-foreground">Date</p>
                    <p className="text-[13px] sm:text-[14px] font-medium text-foreground">{reassigningBooking ? format(parseISO(reassigningBooking.date), "MMM d, yyyy") : ""}</p>
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 col-span-2 sm:col-span-1">
                    <p className="text-[11px] sm:text-[12px] font-medium text-muted-foreground">Current</p>
                    <p className="text-[13px] sm:text-[14px] font-medium text-foreground flex items-center">
                      <span className="truncate">{reassigningBooking ? cartMap.get(reassigningBooking.cartId)?.name : ""}</span>
                      <span className="text-muted-foreground mx-1.5">{"\u00b7"}</span>
                      <span className="shrink-0">{reassigningBooking?.period}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={() => setReassigningBooking(null)} className="hidden sm:block text-[13px] font-medium text-muted-foreground hover:text-foreground text-left mt-8 transition-colors shrink-0">
                Cancel
              </button>
            </div>

            {/* Right Column (Scrollable Selection) */}
            <div className="flex-1 p-6 sm:p-7 bg-background flex flex-col overflow-hidden">
              <div className="mb-4 sm:mb-5 shrink-0 flex items-center justify-between">
                <h3 className="text-[12px] sm:text-[13px] font-medium text-muted-foreground">Select New Cart</h3>
                {isReassigning && <span className="text-[11px] text-muted-foreground animate-pulse">Reassigning...</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-2 scrollbar-hide flex-1 pb-4">
                {carts
                  .filter(c => c.status === "active" && c.id !== reassigningBooking?.cartId)
                  .map(c => {
                    const hasConflict = bookings.some(bk => bk.cartId === c.id && bk.date === reassigningBooking?.date && bk.period === reassigningBooking?.period)
                    return (
                      <button
                        key={c.id}
                        disabled={hasConflict || isReassigning}
                        onClick={async () => {
                          if (!reassigningBooking) return
                          setIsReassigning(true)
                          try {
                            const res = await reassignBooking(reassigningBooking.id, c.id)
                            if (!res.ok) toast({ title: "Could not reassign", description: res.error, variant: "destructive" })
                            else {
                              toast({ title: "Cart reassigned", description: `Moved to ${c.name}` })
                              setReassigningBooking(null)
                            }
                          } finally {
                            setIsReassigning(false)
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-4 py-3 sm:py-3.5 text-left transition-all duration-200",
                          hasConflict
                            ? "border-transparent bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border bg-background hover:border-foreground/30 hover:shadow-sm hover:bg-muted/5 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        )}
                      >
                        <span className="text-[13px] sm:text-[14px] font-medium text-foreground">{c.name}</span>
                        {!hasConflict && <ArrowRight className="size-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </button>
                    )
                  })
                }
              </div>

              {/* Mobile Cancel Button */}
              <div className="sm:hidden pt-4 mt-auto border-t border-border/50 shrink-0">
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setReassigningBooking(null)}>
                  Cancel
                </Button>
              </div>
            </div>
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
}: {
  bookings: Booking[]
  issues: Issue[]
  carts: Cart[]
  teachers: User[]
  range: DateRange | undefined
}) {
  const router = useRouter()
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
      const cName = cartMap.get(b.cartId)?.name ?? "Cart"
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
      .sort((a, b) => b.total !== a.total ? b.total - a.total : b.open !== a.open ? b.open - a.open : (cartMap.get(a.cartId)?.name ?? "").localeCompare(cartMap.get(b.cartId)?.name ?? ""))
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
    cartUsageRowsWithShare,
    topCartUsageRows,
    openIssues,
    resolvedIssues,
    maintenanceCartsCount,
    periodRows,
    subjectRows,
    issueSeverityCounts,
    issueRowsTop,
    recentIssues,
    reporterRows,
    activityData
  } = stats
  const maxActivity = Math.max(...activityData.map(d => d.count), 1)
  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`
      : format(range.from, "MMM d, yyyy")
    : ""

  const generatedAt = format(new Date(), "MMM d, yyyy")

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
    link.download = `air-kart-bookings-${format(new Date(), "yyyy-MM-dd")}.csv`
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
    link.download = `air-kart-issues-${format(new Date(), "yyyy-MM-dd")}.csv`
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
    link.download = `air-kart-teacher-usage-${format(new Date(), "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const equipmentHealth = carts.length > 0 ? Math.round(((carts.length - maintenanceCartsCount) / carts.length) * 100) : 0
  const highPriorityIssues = issues.filter(i => i.status === "open" && i.severity === "high")

  return (
    <section className="print-root overflow-hidden rounded-2xl border border-border bg-card font-sans shadow-sm">
      <div className="flex flex-col gap-8 border-b border-border/60 px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-foreground sm:text-[32px]">
              Reporting & Analytics
            </h2>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
              {rangeLabel ? (
                <>
                  <span>{rangeLabel}</span>
                  <span>&bull;</span>
                </>
              ) : null}
              <span>{format(new Date(), "MMM d, yyyy")}</span>
            </p>
          </div>

          <div className="no-print flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" className="h-10 rounded-full px-5 text-[13px] font-semibold shadow-sm">
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportBookingsCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Bookings Log
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportTeacherUsageCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Teacher Usage
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[13px]" onSelect={exportIssuesCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Issue Reports
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {highPriorityIssues.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-red-200/80 bg-red-50/50 px-5 py-3.5 -mt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-red-600" />
              <span className="text-[13px] font-medium text-red-800">
                Action Required: {highPriorityIssues.length} high priority issue{highPriorityIssues.length > 1 ? "s" : ""} unresolved.
              </span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-700 border-red-200 hover:bg-red-100 shadow-none">
              View Log
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5 lg:gap-6">
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-muted/10 p-5 transition hover:bg-muted/20 sm:p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Fleet Health</span>
            <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">{equipmentHealth}%</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-muted/10 p-5 transition hover:bg-muted/20 sm:p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Bookings</span>
            <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">{totalBookings}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-muted/10 p-5 transition hover:bg-muted/20 sm:p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Teachers</span>
            <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">{activeTeachers}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-muted/10 p-5 transition hover:bg-muted/20 sm:p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Issues</span>
            <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">{openIssues.length}</span>
          </div>
          <div className={cn("flex flex-col gap-1.5 rounded-2xl border p-5 transition sm:p-6", maintenanceCartsCount > 0 ? "border-red-200/80 bg-red-50/30 hover:bg-red-50/50" : "border-border/60 bg-muted/10 hover:bg-muted/20")}>
            <span className={cn("text-[11px] font-semibold uppercase tracking-widest", maintenanceCartsCount > 0 ? "text-red-600" : "text-muted-foreground")}>Maintenance</span>
            <span className={cn("text-3xl font-light tracking-tight sm:text-4xl", maintenanceCartsCount > 0 ? "text-red-600" : "text-foreground")}>{maintenanceCartsCount}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-12 sm:gap-16 lg:grid-cols-2 lg:grid-flow-col lg:grid-rows-2 lg:gap-x-20 lg:gap-y-16">
          <div>
            <div className="mb-5 flex items-center gap-2">
              <Layers3 className="size-4 text-muted-foreground" />
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground">Usage & Utilization</h3>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-[13px] text-muted-foreground">
                    Teacher usage and cart mix, plus volume and frequency.
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="group h-9 rounded-full px-5 text-[12px] font-semibold shadow-none hover:bg-primary transition-none">
                      Open
                      <ChevronDown className="ml-2 size-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-xl">
                    <DropdownMenuItem className="text-[13px]" onSelect={() => router.push("/admin/teacher-usage")}>
                      Teacher usage
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[13px]" onSelect={() => router.push("/admin/carts")}>
                      Utilization
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground">Insights</h3>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[13px] text-muted-foreground">
                  Booking volume and distribution.
                </p>
                <Button asChild className="h-9 rounded-full px-5 text-[12px] font-semibold shadow-sm">
                  <Link href="/admin/bookings">
                    Open
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground">Issues</h3>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[13px] text-muted-foreground">
                  Fleet health and report summary.
                </p>
                <Button asChild className="h-9 rounded-full px-5 text-[12px] font-semibold shadow-sm">
                  <Link href="/admin/carts">
                    Open
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground">Log</h3>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[13px] text-muted-foreground">
                  Recent maintenance activity.
                </p>
                <Button asChild className="h-9 rounded-full px-5 text-[12px] font-semibold shadow-sm">
                  <Link href="/admin/carts">
                    Open
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: "active" | "maintenance" }) {
  const isMaint = status === "maintenance"
  const label = isMaint ? "Unavailable" : "Bookable"

  return (
    <span
      className={cn(
        "inline-flex h-6 w-28 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium uppercase tracking-wider",
        isMaint ? "border-red-200/80 bg-red-50/70 text-red-700" : "border-emerald-300/90 bg-emerald-50/40 text-emerald-700"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isMaint ? "bg-red-500" : "bg-emerald-500")} />
      {label}
    </span>
  )
}

function DailyBoardLite({ bookings, carts }: { bookings: Booking[]; carts: Cart[] }) {
  const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]
  const [activeDate, setActiveDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const bookingsForDate = useMemo(() => bookings.filter((b) => b.date === activeDate), [bookings, activeDate])
  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>()
    for (const b of bookingsForDate) map.set(`${b.cartId}:${b.period}`, b)
    return map
  }, [bookingsForDate])

  const go = (offset: number) => {
    setActiveDate(format(addDays(parseISO(activeDate), offset), "yyyy-MM-dd"))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <ChevronDown className="size-4 rotate-90" />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-foreground/20">
                <CalendarIcon className="size-4 text-muted-foreground" />
                {format(parseISO(activeDate), "EEEE, MMM d, yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(activeDate)}
                onSelect={(d) => d && setActiveDate(format(d, "yyyy-MM-dd"))}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <button
            onClick={() => go(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <ChevronDown className="size-4 -rotate-90" />
          </button>

          <button
            onClick={() => setActiveDate(format(new Date(), "yyyy-MM-dd"))}
            className="ml-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Today
          </button>
        </div>

      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm min-h-100">
        <div className="min-w-200">
          <div className="grid grid-cols-[200px_repeat(5,minmax(0,1fr))] bg-black h-10 items-center">
            <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white/80 border-r border-white/10">Cart</div>
            {PERIODS.map(p => (
              <div key={p} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white/80 border-r border-white/10 last:border-r-0">{p}</div>
            ))}
          </div>
          {carts.map(cart => (
            <div key={cart.id} className="grid grid-cols-[200px_repeat(5,minmax(0,1fr))] border-t border-border h-17">
              <div className="flex items-center gap-2 px-4 py-3 border-r border-border bg-muted/5 font-medium text-sm overflow-hidden whitespace-nowrap">
                <span className="truncate">{cart.name}</span>
                {cart.status === "maintenance" && <Wrench className="size-3 text-red-500 shrink-0" />}
              </div>
              {PERIODS.map(p => {
                const b = bookingMap.get(`${cart.id}:${p}`)
                const subjectLabel = b?.subject?.trim()
                const classLabel = b?.className?.trim()
                return (
                  <div key={p} className="relative min-h-15 border-r border-border last:border-r-0 p-2">
                    {b ? (
                      <div className="h-full rounded-md bg-foreground/5 p-2 text-[11px] leading-tight flex flex-col gap-1 border border-foreground/10 group">
                        <span className="font-bold truncate">{b.teacherName}</span>
                        {subjectLabel && (
                          <span className="text-muted-foreground truncate">{subjectLabel}</span>
                        )}
                        {classLabel && (
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                            <span className="text-[10px] font-bold">{classLabel}</span>
                          </div>
                        )}
                      </div>
                    ) : cart.status === "maintenance" ? (
                      <div className="h-full flex items-center justify-center bg-red-50/20">
                        <X className="size-4 text-red-300" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function SlotCell({
  cart,
  period,
  activeDate,
  booking,
  restriction,
  isPending,
  onApply,
  onRemove,
  onCancelBooking,
  onResumeCart,
}: {
  cart: Cart
  period: Period
  activeDate: string
  booking: Booking | undefined
  restriction: SlotRestriction | undefined
  isPending: boolean
  onApply: (cartId: string, period: Period, category: RestrictionCategory, reason?: string) => Promise<void>
  onRemove: (cartId: string, period: Period) => Promise<void>
  onCancelBooking: (bookingId: string) => Promise<void>
  onResumeCart: (cartId: string) => Promise<void>
}) {
  const [localCategory, setLocalCategory] = useState<RestrictionCategory>("general")
  const [localReason, setLocalReason] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isCellPending, setIsCellPending] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (restriction) {
        setLocalCategory(restriction.category ?? "general")
        setLocalReason(restriction.reason ?? "")
      } else {
        setLocalCategory("general")
        setLocalReason("")
      }
      setIsConfirmingCancel(false)
    }
  }, [isOpen, restriction])

  const isMaintenanceCart = cart.status === "maintenance"
  const isBooked = !!booking
  const isRestricted = !!restriction
  const isApExam = restriction?.category === "ap_exam"

  async function handleApply() {
    setIsCellPending(true)
    try {
      await onApply(cart.id, period, localCategory, localReason.trim() || undefined)
      setIsOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCellPending(false)
    }
  }

  async function handleRemove() {
    setIsCellPending(true)
    try {
      await onRemove(cart.id, period)
      setIsOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCellPending(false)
    }
  }

  async function handleUpdate() {
    setIsCellPending(true)
    try {
      await onRemove(cart.id, period)
      await onApply(cart.id, period, localCategory, localReason.trim() || undefined)
      setIsOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCellPending(false)
    }
  }

  async function handleCancel() {
    if (!booking) return
    setIsCellPending(true)
    try {
      await onCancelBooking(booking.id)
      setIsOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCellPending(false)
    }
  }

  async function handleResume() {
    setIsCellPending(true)
    try {
      await onResumeCart(cart.id)
      setIsOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCellPending(false)
    }
  }

  const showLoading = isPending || isCellPending

  // Ã¢â€â‚¬Ã¢â€â‚¬ 1. MAINTENANCE STATE Ã¢â€â‚¬Ã¢â€â‚¬
  if (isMaintenanceCart) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-center rounded-md border border-border/60 bg-muted/20 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/35"
          >
            {showLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="inline-flex items-center gap-1">
                <Wrench className="size-3" />
                Paused
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 rounded-xl border border-border/50 bg-background p-0 shadow-xl" align="center">
          <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Maintenance</p>
            <h4 className="mt-0.5 text-[13px] font-semibold text-foreground">{cart.name}</h4>
          </div>
          <div className="space-y-3 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Cart is currently in maintenance. All slots are suspended.
            </p>
            <button
              type="button"
              disabled={showLoading}
              onClick={handleResume}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground text-[11px] font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {showLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Resume Cart Service
            </button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ 2. BOOKED STATE Ã¢â€â‚¬Ã¢â€â‚¬
  if (isBooked) {
    const lastName = booking.teacherName.trim().split(" ").pop() ?? "Teacher"
    const initials = booking.teacherName
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    const subjectLabel = booking.subject?.trim()
    const classLabel = booking.className?.trim()
    const detailLine = [subjectLabel, classLabel].filter(Boolean).join(" - ")

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-14 w-full flex-col justify-center rounded-md border border-emerald-300/35 bg-emerald-500/5 px-2.5 py-2 text-left transition-colors hover:bg-emerald-500/10"
          >
            <span className="truncate text-[10.5px] font-semibold leading-tight text-foreground">
              {lastName}
            </span>
            {subjectLabel && (
              <span className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {subjectLabel}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-68 p-4 rounded-xl shadow-xl border border-border/40 bg-background backdrop-blur-md" align="center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-bold text-[11px] shrink-0 shadow-inner">
                {initials}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-[13px] font-semibold text-foreground leading-none">{booking.teacherName}</h4>
                {detailLine && (
                  <p className="text-[10.5px] text-muted-foreground leading-none">{detailLine}</p>
                )}
              </div>
            </div>

            {booking.notes && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/90 italic border border-border/20">
                &ldquo;{booking.notes}&rdquo;
              </div>
            )}

            <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
              <span>Booked on</span>
              <span>{format(parseISO(booking.createdAt), "MMM d, h:mm a")}</span>
            </div>

            <div className="border-t border-border/40 pt-3">
              {isConfirmingCancel ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold leading-snug">
                    Confirm cancellation? An email notification will be sent.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={showLoading}
                      onClick={handleCancel}
                      className="flex-1 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {showLoading && <Loader2 className="size-3 animate-spin" />}
                      Cancel Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingCancel(false)}
                      className="h-8 px-3 rounded-lg border border-border/50 text-[11px] font-semibold hover:bg-muted/30 transition-colors"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingCancel(true)}
                  className="w-full h-8 rounded-lg border border-rose-200/50 text-[11px] font-bold text-rose-600 hover:bg-rose-50/50 hover:text-rose-700 dark:border-rose-950/40 dark:hover:bg-rose-950/15 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Cancel Reservation
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ 3. RESTRICTED STATE Ã¢â€â‚¬Ã¢â€â‚¬
  if (isRestricted) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-h-14 w-full items-center justify-center rounded-md border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              isApExam
                ? "border-amber-300/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
                : "border-rose-300/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400"
            )}
          >
            {isApExam ? "AP Exam" : "Locked"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 rounded-xl border border-border/50 bg-background p-0 shadow-xl" align="center">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isApExam ? "AP Exam Lockout" : "Manual Restriction"}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-foreground">{cart.name}{" \u00b7 "}{period}</p>
          </div>

          <div className="space-y-3 px-4 py-3">
            {(restriction.reason || isApExam) && (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                {restriction.reason || (isApExam ? "Reserved exclusively for AP exam bookings." : "Manual slot restriction.")}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Reason / Note</label>
              <input
                value={localReason}
                onChange={(e) => setLocalReason(e.target.value)}
                placeholder="Reason for restriction..."
                className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[11px] outline-none transition-colors focus:border-foreground/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={showLoading}
                onClick={handleUpdate}
                className="h-9 rounded-lg border border-border/60 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-muted/25 disabled:opacity-50"
              >
                Update
              </button>
              <button
                type="button"
                disabled={showLoading}
                onClick={async () => {
                  setIsCellPending(true)
                  try {
                    await onRemove(cart.id, period)
                    await onApply(cart.id, period, isApExam ? "general" : "ap_exam", localReason.trim() || undefined)
                    setIsOpen(false)
                  } catch (e) {
                    console.error(e)
                  } finally {
                    setIsCellPending(false)
                  }
                }}
                className={cn(
                  "h-9 rounded-lg border text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50",
                  isApExam
                    ? "border-rose-300/50 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400"
                    : "border-amber-300/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
                )}
              >
                {isApExam ? "To General" : "To AP"}
              </button>
            </div>

            <button
              type="button"
              disabled={showLoading}
              onClick={handleRemove}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/15 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-muted/25 disabled:opacity-50"
            >
              {showLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
              Unlock Slot
            </button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // -- 4. AVAILABLE STATE --
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-border/70 bg-background p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/25 hover:text-foreground"
        >
          {showLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Plus className="size-3.5 text-muted-foreground/45 transition-colors group-hover:text-foreground/75" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 rounded-xl border border-border/50 bg-background p-3 shadow-xl" align="center">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-foreground">
            Restrict {cart.name} {" \u00b7 "} {period}
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLocalCategory("general")}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide transition-colors",
                localCategory === "general"
                  ? "border-rose-300/50 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : "border-border/60 text-muted-foreground hover:bg-muted/25"
              )}
            >
              <Lock className="size-3" />
              General
            </button>
            <button
              type="button"
              onClick={() => setLocalCategory("ap_exam")}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide transition-colors",
                localCategory === "ap_exam"
                  ? "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-border/60 text-muted-foreground hover:bg-muted/25"
              )}
            >
              <ShieldCheck className="size-3" />
              AP Exam
            </button>
          </div>

          <input
            value={localReason}
            onChange={(e) => setLocalReason(e.target.value)}
            placeholder={localCategory === "ap_exam" ? "AP exam note... (Optional)" : "Reason note... (Optional)"}
            className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-[11px] outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/50"
          />

          <button
            type="button"
            disabled={showLoading}
            onClick={handleApply}
            className={cn(
              "flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wide text-white transition-colors disabled:opacity-50",
              localCategory === "ap_exam" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {showLoading && <Loader2 className="size-3 animate-spin" />}
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function RestrictionsPanel({
  carts,
  bookings,
  slotRestrictions,
  bookingPolicy,
}: {
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
}) {
  const router = useRouter()
  const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]
  const [activeDate, setActiveDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [isPending, setIsPending] = useState<string | null>(null)
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const [showRestrictedOnly, setShowRestrictedOnly] = useState(false)
  const [isClearingDate, setIsClearingDate] = useState(false)
  const [cartQuery, setCartQuery] = useState("")

  const restrictedMap = useMemo(() => {
    const map = new Map<string, SlotRestriction>()
    slotRestrictions
      .filter((r) => r.date === activeDate)
      .forEach((r) => map.set(`${r.cartId}:${r.period}`, r))
    return map
  }, [slotRestrictions, activeDate])

  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>()
    bookings
      .filter((b) => b.date === activeDate)
      .forEach((b) => map.set(`${b.cartId}:${b.period}`, b))
    return map
  }, [bookings, activeDate])

  const restrictionsForDate = useMemo(
    () => slotRestrictions.filter((r) => r.date === activeDate),
    [slotRestrictions, activeDate],
  )

  const apExamRestrictionCount = useMemo(
    () => restrictionsForDate.filter((r) => r.category === "ap_exam").length,
    [restrictionsForDate],
  )

  const restrictedSlotCount = restrictionsForDate.length
  const totalSlotsForDay = carts.length * PERIODS.length
  const bookedSlotCount = bookingMap.size
  const availableSlotCount = Math.max(0, totalSlotsForDay - bookedSlotCount - restrictedSlotCount)

  const visibleCarts = useMemo(() => {
    const query = cartQuery.trim().toLowerCase()
    return carts.filter((cart) => {
      const matchesRestriction = !showRestrictedOnly || PERIODS.some((period) => restrictedMap.has(`${cart.id}:${period}`))
      const matchesQuery = !query || cart.name.toLowerCase().includes(query)
      return matchesRestriction && matchesQuery
    })
  }, [cartQuery, carts, restrictedMap, showRestrictedOnly, PERIODS])

  const activeDateLabel = format(parseISO(activeDate), "EEEE, MMM d, yyyy")

  async function handleApplyRestriction(cartId: string, period: Period, category: RestrictionCategory, reason?: string) {
    const key = `${cartId}:${period}`
    setIsPending(key)
    try {
      const res = await toggleSlotRestriction(cartId, activeDate, period, { category, reason })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsPending(null)
    }
  }

  async function handleRemoveRestriction(cartId: string, period: Period) {
    const key = `${cartId}:${period}`
    setIsPending(key)
    try {
      const res = await toggleSlotRestriction(cartId, activeDate, period)
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsPending(null)
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setIsPending(`cancel:${bookingId}`)
    try {
      const res = await cancelBooking(bookingId)
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsPending(null)
    }
  }

  async function handleResumeCart(cartId: string) {
    setIsPending(`resume:${cartId}`)
    try {
      const res = await setCartStatus(cartId, "active")
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsPending(null)
    }
  }

  async function handleClearDate() {
    setIsClearingDate(true)
    try {
      const res = await batchRestrictSlots(
        carts.map((cart) => cart.id),
        activeDate,
        activeDate,
        PERIODS,
        "available",
      )
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsClearingDate(false)
    }
  }

  const go = (offset: number) => {
    setActiveDate(format(addDays(parseISO(activeDate), offset), "yyyy-MM-dd"))
  }

  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="rounded-2xl border border-border/50 bg-background/95 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/30"
                >
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span>{format(parseISO(activeDate), "EEE, MMM d")}</span>
                  <ChevronDown className="size-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-xl border border-border/50 bg-background p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(activeDate)}
                  onSelect={(d) => d && setActiveDate(format(d, "yyyy-MM-dd"))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => go(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 pr-2">
              <Switch
                checked={showRestrictedOnly}
                onCheckedChange={setShowRestrictedOnly}
                id="restricted-mode-toggle"
              />
              <label htmlFor="restricted-mode-toggle" className="text-[11.5px] font-semibold text-foreground cursor-pointer">
                Locked Carts Only
              </label>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={cartQuery}
                onChange={(event) => setCartQuery(event.target.value)}
                placeholder="Filter carts"
                className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-[12px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/30 sm:w-44"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsBatchOpen(true)}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 text-[11px] font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/90"
            >
              <Settings2 className="size-3.5" />
              Manage
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 py-3 text-[10.5px] sm:grid-cols-4">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
            <p className="text-muted-foreground">Open</p>
            <p className="mt-0.5 font-semibold text-foreground">{availableSlotCount} slots</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
            <p className="text-muted-foreground">Booked</p>
            <p className="mt-0.5 font-semibold text-foreground">{bookedSlotCount} slots</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-rose-500/5 px-2.5 py-2">
            <p className="text-muted-foreground">Locked</p>
            <p className="mt-0.5 font-semibold text-foreground">{restrictedSlotCount - apExamRestrictionCount} slots</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-amber-500/5 px-2.5 py-2">
            <p className="text-muted-foreground">AP Exam</p>
            <p className="mt-0.5 font-semibold text-foreground">{apExamRestrictionCount} slots</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-220">
            <div
              className="grid border-b border-zinc-800 bg-zinc-950"
              style={{ gridTemplateColumns: "minmax(250px, 1.45fr) repeat(5, minmax(0, 1fr))" }}
            >
              <div className="sticky left-0 z-20 flex items-center border-r border-zinc-800 bg-zinc-950 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:bg-zinc-900/70">
                CART
              </div>
              {PERIODS.map((period) => (
                <div
                  key={period}
                  className="flex items-center justify-center border-l border-zinc-800 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:bg-zinc-900/70"
                >
                  {period}
                </div>
              ))}
            </div>

            {visibleCarts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[13px] font-semibold text-foreground">No carts match this view.</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {cartQuery.trim()
                    ? `No results for "${cartQuery.trim()}".`
                    : "Try turning off Restricted Only to show every cart."}
                </p>
              </div>
            ) : (
              visibleCarts.map((cart, idx) => {
                const isMaintenanceCart = cart.status === "maintenance"
                const rowBg = idx % 2 === 1 ? "bg-muted/[0.22]" : "bg-background"

                return (
                  <div
                    key={cart.id}
                    className={cn("grid min-h-17 border-b border-border/40 last:border-b-0", rowBg)}
                    style={{ gridTemplateColumns: "minmax(250px, 1.45fr) repeat(5, minmax(0, 1fr))" }}
                  >
                    <div
                      className={cn(
                        "sticky left-0 z-10 flex items-center justify-between gap-3 border-r border-border/40 px-5 py-3 transition-colors hover:bg-muted/35",
                        rowBg
                      )}
                    >
                      <span className="truncate text-[12px] font-semibold tracking-tight text-foreground">{cart.name}</span>
                    </div>

                    {PERIODS.map((period) => {
                      const slotKey = `${cart.id}:${period}`
                      const restriction = restrictedMap.get(slotKey)
                      const booking = bookingMap.get(slotKey)

                      return (
                        <div
                          key={period}
                          className="flex items-center justify-center border-r border-border/40 p-2 transition-colors hover:bg-muted/35 last:border-r-0"
                        >
                          <SlotCell
                            cart={cart}
                            period={period}
                            activeDate={activeDate}
                            booking={booking}
                            restriction={restriction}
                            isPending={isPending === slotKey || isPending === `cancel:${booking?.id}` || isPending === `resume:${cart.id}`}
                            onApply={handleApplyRestriction}
                            onRemove={handleRemoveRestriction}
                            onCancelBooking={handleCancelBooking}
                            onResumeCart={handleResumeCart}
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

      <ManageDayDialog
        open={isBatchOpen}
        onOpenChange={setIsBatchOpen}
        carts={carts}
        bookings={bookings}
        slotRestrictions={slotRestrictions}
        bookingPolicy={bookingPolicy}
        activeDate={activeDate}
        availableSlotCount={availableSlotCount}
        bookedSlotCount={bookedSlotCount}
        apExamRestrictionCount={apExamRestrictionCount}
        restrictedSlotCount={restrictedSlotCount}
        showRestrictedOnly={showRestrictedOnly}
        setShowRestrictedOnly={setShowRestrictedOnly}
        handleClearDate={handleClearDate}
        isClearingDate={isClearingDate}
        restrictionsForDate={restrictionsForDate}
      />
    </div>
  )
}
function ManageDayDialog({
  open,
  onOpenChange,
  carts,
  bookings,
  slotRestrictions,
  bookingPolicy,
  activeDate,
  availableSlotCount,
  bookedSlotCount,
  apExamRestrictionCount,
  restrictedSlotCount,
  showRestrictedOnly,
  setShowRestrictedOnly,
  handleClearDate,
  isClearingDate,
  restrictionsForDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  carts: Cart[]
  bookings: Booking[]
  slotRestrictions: SlotRestriction[]
  bookingPolicy: BookingPolicy
  activeDate: string
  availableSlotCount: number
  bookedSlotCount: number
  apExamRestrictionCount: number
  restrictedSlotCount: number
  showRestrictedOnly: boolean
  setShowRestrictedOnly: (show: boolean) => void
  handleClearDate: () => Promise<void>
  isClearingDate: boolean
  restrictionsForDate: SlotRestriction[]
}) {
  const router = useRouter()
  const [subCategory, setSubCategory] = useState<"overview" | "batch">("overview")

  const [selectedCartIds, setSelectedCartIds] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [selectedPeriods, setSelectedPeriods] = useState<Set<Period>>(new Set())
  const [restrictionType, setRestrictionType] = useState<RestrictionCategory>("general")
  const [reason, setReason] = useState("")
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [maxAdvanceInput, setMaxAdvanceInput] = useState(String(bookingPolicy.maxAdvanceDays ?? 14))
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isApplyingDayLock, setIsApplyingDayLock] = useState<RestrictionCategory | null>(null)
  const [cartSearchQuery, setCartSearchQuery] = useState("")

  const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"]
  const activeDateLabel = format(parseISO(activeDate), "MMMM d, yyyy")

  const selectedDates = useMemo(() => {
    if (!dateRange?.from) return []
    const from = startOfDay(dateRange.from)
    const to = startOfDay(dateRange.to ?? dateRange.from)
    const dates: string[] = []
    let current = from
    while (current <= to) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6
      if (!weekdaysOnly || !isWeekend) {
        dates.push(format(current, "yyyy-MM-dd"))
      }
      current = addDays(current, 1)
    }
    return dates
  }, [dateRange, weekdaysOnly])

  const selectedKeySet = useMemo(() => {
    const keys = new Set<string>()
    selectedCartIds.forEach((cartId) => {
      selectedDates.forEach((date) => {
        selectedPeriods.forEach((period) => {
          keys.add(`${cartId}:${date}:${period}`)
        })
      })
    })
    return keys
  }, [selectedCartIds, selectedDates, selectedPeriods])

  const targetSlotCount = selectedKeySet.size
  const bookedCount = useMemo(
    () => bookings.filter((b) => selectedKeySet.has(`${b.cartId}:${b.date}:${b.period}`)).length,
    [bookings, selectedKeySet],
  )
  const existingRestrictionCount = useMemo(
    () => slotRestrictions.filter((r) => selectedKeySet.has(`${r.cartId}:${r.date}:${r.period}`)).length,
    [slotRestrictions, selectedKeySet],
  )
  const estimatedNewRestrictions = Math.max(0, targetSlotCount - bookedCount - existingRestrictionCount)
  const selectedCartCount = selectedCartIds.size
  const selectedPeriodCount = selectedPeriods.size
  const allSelectedCarts = selectedCartCount === carts.length && carts.length > 0
  const noSelectedCarts = selectedCartCount === 0

  const canRunActions =
    !isPending &&
    selectedCartCount > 0 &&
    selectedPeriodCount > 0 &&
    !!dateRange?.from &&
    selectedDates.length > 0

  useEffect(() => {
    setMaxAdvanceInput(String(bookingPolicy.maxAdvanceDays ?? 14))
  }, [bookingPolicy.maxAdvanceDays])

  function applyNextSchoolDaysPreset(days: number) {
    const from = startOfDay(new Date())
    let to = from
    let counted = 0
    while (counted < days) {
      const isWeekend = to.getDay() === 0 || to.getDay() === 6
      if (!isWeekend) counted += 1
      if (counted < days) to = addDays(to, 1)
    }
    setDateRange({ from, to })
    setWeekdaysOnly(true)
  }

  async function handleSavePolicy() {
    const parsed = Number(maxAdvanceInput)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) {
      toast({
        title: "Invalid value",
        description: "Set a whole number between 0 and 120 days.",
        variant: "destructive",
      })
      return
    }

    setIsSavingPolicy(true)
    try {
      const res = await updateBookingPolicy(parsed)
      if (!res.ok) {
        toast({ title: "Could not save policy", description: res.error, variant: "destructive" })
        return
      }
      toast({
        title: "Booking policy updated",
        description: `Teachers can now book up to ${parsed} day${parsed === 1 ? "" : "s"} ahead.`,
      })
      router.refresh()
    } finally {
      setIsSavingPolicy(false)
    }
  }

  async function handleLockFullDay(category: RestrictionCategory) {
    setIsApplyingDayLock(category)
    try {
      const res = await batchRestrictSlots(
        carts.map((cart) => cart.id),
        activeDate,
        activeDate,
        PERIODS,
        "restrict",
        {
          category,
          reason: category === "ap_exam"
            ? "Reserved for AP exam bookings."
            : `Restricted on ${activeDateLabel}.`,
        },
      )
      if (!res.ok) {
        toast({ title: "Could not lock day", description: res.error, variant: "destructive" })
        return
      }
      const summary = ("data" in res ? res.data : undefined) as { restrictedCount?: number; skippedBookedCount?: number } | undefined
      toast({
        title: category === "ap_exam" ? "AP exam day lock applied" : "Full-day lock applied",
        description: `${summary?.restrictedCount ?? 0} slots locked, ${summary?.skippedBookedCount ?? 0} booked slots skipped.`,
      })
      router.refresh()
    } finally {
      setIsApplyingDayLock(null)
    }
  }

  async function handleApply(action: "restrict" | "available") {
    if (selectedCartIds.size === 0 || !dateRange?.from || selectedPeriods.size === 0) return
    if (selectedDates.length === 0) return

    setIsPending(true)
    try {
      const rangeEnd = dateRange.to ?? dateRange.from
      const res = await batchRestrictSlots(
        Array.from(selectedCartIds),
        format(dateRange.from, "yyyy-MM-dd"),
        format(rangeEnd, "yyyy-MM-dd"),
        Array.from(selectedPeriods),
        action,
        {
          category: restrictionType,
          reason: reason.trim(),
          weekdaysOnly,
        }
      )

      if (res.ok) {
        router.refresh()
        onOpenChange(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-195 w-[95vw] sm:w-full p-0 overflow-hidden border-border/40 shadow-2xl rounded-2xl bg-background backdrop-blur-md flex flex-col sm:flex-row h-[90vh] sm:h-130 max-h-[90vh] focus:outline-none">
        <div className="w-full sm:w-45 border-b sm:border-b-0 sm:border-r border-border/30 bg-muted/5 p-3 sm:p-5 flex flex-row sm:flex-col gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubCategory("overview")}
            className={cn(
              "flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left whitespace-nowrap flex-1 sm:flex-none",
              subCategory === "overview"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Settings2 className="size-4 shrink-0" />
            <span className="truncate">General</span>
          </button>
          <button
            type="button"
            onClick={() => setSubCategory("batch")}
            className={cn(
              "flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left whitespace-nowrap flex-1 sm:flex-none",
              subCategory === "batch"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Layers3 className="size-4 shrink-0" />
            <span className="truncate">Batch Rules</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {subCategory === "overview" ? (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-md">
                <DialogTitle className="text-[18px] font-semibold tracking-tight text-foreground">General Settings</DialogTitle>

                <div className="mt-6 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background px-4 py-3">
                    <label className="text-[12px] font-semibold text-foreground">Booking Window (Days)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={1}
                        value={maxAdvanceInput}
                        onChange={(event) => setMaxAdvanceInput(event.target.value)}
                        className="h-8 w-14 rounded-md border border-border/80 bg-background px-2 text-center text-[12px] font-medium outline-none transition-colors focus:border-foreground/50"
                      />
                      <button
                        type="button"
                        onClick={handleSavePolicy}
                        disabled={isSavingPolicy}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-3 text-[11px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                      >
                        {isSavingPolicy ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3">
                    <label className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">Clear All Locks</label>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleClearDate()
                        onOpenChange(false)
                      }}
                      disabled={isClearingDate || restrictionsForDate.length === 0}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                    >
                      {isClearingDate ? <Loader2 className="size-3.5 animate-spin" /> : "Clear Locks"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0 bg-background">
              {/* Left Column - Scope Settings */}
              <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto border-b sm:border-b-0 sm:border-r border-border/40">
                <div className="shrink-0">
                  <DialogTitle className="text-[18px] font-semibold tracking-tight text-foreground">Batch Rules</DialogTitle>
                </div>

                <div className="space-y-4 mt-2 flex-1 flex flex-col">
                  <div className="space-y-2 shrink-0">
                    <div className="grid gap-2.5">
                      <Select value={restrictionType} onValueChange={(val) => setRestrictionType(val as RestrictionCategory)}>
                        <SelectTrigger className="h-8.5 rounded-lg border-border/80 bg-muted/5 text-[12px] font-medium hover:border-border transition-colors focus:border-foreground/50 focus:outline-none">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg shadow-xl border-border/50">
                          <SelectItem value="general" className="text-[11.5px] cursor-pointer">General Lock</SelectItem>
                          <SelectItem value="ap_exam" className="text-[11.5px] cursor-pointer">AP Exam Lock</SelectItem>
                        </SelectContent>
                      </Select>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Note (optional)"
                        className="h-8.5 w-full rounded-lg border border-border/80 bg-muted/5 px-3 text-[12px] placeholder:text-muted-foreground/60 focus:border-foreground/50 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 flex flex-col min-h-150px">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-semibold text-foreground">
                        Target Carts ({selectedCartCount})
                      </label>
                      <div className="flex items-center rounded-md bg-foreground overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedCartIds(new Set(carts.map((c) => c.id)))}
                          className="border-r border-background/20 px-2.5 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCartIds(new Set())}
                          className="px-2.5 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search carts..."
                        value={cartSearchQuery}
                        onChange={(e) => setCartSearchQuery(e.target.value)}
                        className="h-8 w-full rounded-lg border border-border/80 bg-background pl-8 pr-3 text-[11px] placeholder:text-muted-foreground/60 focus:border-foreground/50 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-xl border border-border/40 bg-muted/5 p-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex flex-col">
                      {(() => {
                        const filtered = carts.filter(c => c.name.toLowerCase().includes(cartSearchQuery.toLowerCase()))

                        if (filtered.length === 0) {
                          return (
                            <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
                              <span className="text-[11px] font-medium text-muted-foreground/60">No matching carts</span>
                            </div>
                          )
                        }

                        return filtered.map((cart) => {
                          const selected = selectedCartIds.has(cart.id)
                          return (
                            <div
                              key={cart.id}
                              onClick={() => {
                                const next = new Set(selectedCartIds)
                                if (next.has(cart.id)) next.delete(cart.id)
                                else next.add(cart.id)
                                setSelectedCartIds(next)
                              }}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 cursor-pointer transition-all duration-150 active:scale-[0.995]",
                                selected ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                              )}
                            >
                              <Checkbox checked={selected} className={cn("shrink-0 size-3.5", selected && "border-foreground bg-foreground text-background")} />
                              <span className="text-[12px] font-medium truncate">
                                {cart.name}
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Timeline Settings */}
              <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto bg-muted/5">
                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-[12px] font-semibold text-foreground">
                        Schedule
                      </label>
                      <div className="flex items-center rounded-md bg-foreground overflow-hidden pr-0 mr-8">
                        <button
                          type="button"
                          onClick={() => applyNextSchoolDaysPreset(5)}
                          className="border-r border-background/20 px-2 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          +5 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyNextSchoolDaysPreset(10)}
                          className="px-2 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          +10 Days
                        </button>
                      </div>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-border focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        >
                          <CalendarIcon className="size-3.5 text-muted-foreground" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <span>
                                {format(dateRange.from, "MMM d, yyyy")} <ArrowRight className="mx-1.5 inline size-3 text-muted-foreground" /> {format(dateRange.to, "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span>{format(dateRange.from, "MMMM d, yyyy")}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">Select date range...</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto rounded-xl p-0 border border-border/80 shadow-none" align="end">
                        <Calendar
                          initialFocus
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background px-3 py-2">
                      <label htmlFor="dialog-weekdays-only" className="text-[12px] font-medium text-foreground cursor-pointer">
                        Skip weekends
                      </label>
                      <Switch checked={weekdaysOnly} onCheckedChange={setWeekdaysOnly} id="dialog-weekdays-only" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-semibold text-foreground">
                        Periods
                      </label>
                      <div className="flex items-center rounded-md bg-foreground overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedPeriods(new Set(PERIODS))}
                          className="border-r border-background/20 px-2.5 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPeriods(new Set())}
                          className="px-2.5 py-0.5 text-[10px] font-semibold text-background transition-colors hover:bg-background/20 active:scale-95"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {PERIODS.map((period) => {
                        const selected = selectedPeriods.has(period)
                        return (
                          <button
                            key={period}
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedPeriods)
                              if (next.has(period)) next.delete(period)
                              else next.add(period)
                              setSelectedPeriods(next)
                            }}
                            className={cn(
                              "flex h-8 items-center justify-center rounded-lg border text-[12px] font-semibold transition-all duration-200 active:scale-95",
                              selected
                                ? "border-foreground bg-foreground text-background"
                                : "border-border/80 bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            )}
                          >
                            {period}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-background p-4 mt-auto">
                    <div className="space-y-2 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Existing bookings</span>
                        <span className="font-semibold text-foreground tabular-nums">{bookedCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Already locked</span>
                        <span className="font-semibold text-foreground tabular-nums">{existingRestrictionCount}</span>
                      </div>
                      <div className="my-2 h-px bg-border/40" />
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span>New locks to apply</span>
                        <span className="tabular-nums text-rose-500">{estimatedNewRestrictions}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button
                    type="button"
                    disabled={!canRunActions}
                    onClick={() => handleApply("available")}
                    className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background text-[12px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/50 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Unlock className="size-3.5" />
                    Release Locks
                  </button>
                  <button
                    type="button"
                    disabled={!canRunActions}
                    onClick={() => handleApply("restrict")}
                    className={cn(
                      "flex-1 flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]",
                      restrictionType === "ap_exam"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-foreground hover:bg-foreground/90"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : restrictionType === "ap_exam" ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <Lock className="size-3.5" />
                    )}
                    {restrictionType === "ap_exam" ? "Apply AP Lock" : "Apply Lock"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}




