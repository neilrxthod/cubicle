"use client"

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import {
  format,
  formatDistanceToNow,
  isToday,
  parseISO,
  subDays,
} from "date-fns"
import {
  Check,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import {
  createTeacherCredentials,
  deleteTeacherCredentials,
  purgeRevokedStaff,
  setStaffVerified,
  updateTeacherCredentials,
} from "@/lib/actions"
import { isRemotePlatformEnabled } from "@/lib/data/durability"
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/school-domain"
import { splitDisplayName } from "@/lib/profile/display-name"
import {
  EMPLOYMENT_TYPES,
  employmentLabel,
  isVerifiedStaff,
} from "@/lib/staff/employment"
import type {
  Booking,
  Cart,
  Issue,
  SwapRequest,
  User,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { VerifiedBadge, VerifiedName } from "@/components/verified-badge"
import {
  StatsDisplay,
  type StatItem,
} from "@/components/tool-ui/stats-display"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

/** Access-focused filters only — employment is managed on the person. */
type FilterId = "all" | "pending" | "verified" | "revoked"

type SortKey = "name" | "activity"

type ActivityItem = {
  id: string
  kind: "booking" | "issue" | "swap"
  at: string
  title: string
  detail: string
}

type StaffMetrics = {
  upcoming: Booking[]
  openIssues: Issue[]
  activity: ActivityItem[]
  lastActiveAt: string | null
  activeToday: boolean
  status: "pending" | "active" | "ok" | "revoked"
}

type AccessDialog =
  | { mode: "add" }
  | { mode: "edit"; user: User }

/**
 * Admin staff directory — allowlist, access, verification.
 * Flow: search/filter → select → manage access.
 */
export function StaffPanel({
  users,
  bookings,
  issues,
  carts,
  swapRequests,
}: {
  users: User[]
  bookings: Booking[]
  issues: Issue[]
  carts: Cart[]
  swapRequests: SwapRequest[]
}) {
  const router = useRouter()
  const googleMode = isRemotePlatformEnabled()
  const today = format(new Date(), "yyyy-MM-dd")

  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterId>("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [accessDialog, setAccessDialog] = useState<AccessDialog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  /** permanent = purge revoked row; access = soft remove from allowlist */
  const [deleteMode, setDeleteMode] = useState<"access" | "permanent">("access")
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const cartMap = useMemo(
    () => new Map(carts.map((c) => [c.id, c])),
    [carts],
  )

  const metricsByUser = useMemo(() => {
    const map = new Map<string, StaffMetrics>()

    for (const user of users) {
      const nameKey = user.name.trim().toLowerCase()
      const allBookings = bookings
        .filter(
          (b) =>
            b.teacherId === user.id ||
            b.teacherName.trim().toLowerCase() === nameKey,
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        )

      const upcoming = allBookings.filter((b) => b.date >= today)

      const userIssues = issues
        .filter(
          (i) =>
            i.reportedById === user.id ||
            i.reporterName.toLowerCase() === nameKey,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const openIssues = userIssues.filter((i) => i.status === "open")

      const swaps = swapRequests
        .filter((s) => s.requesterId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const activity: ActivityItem[] = []
      for (const b of allBookings.slice(0, 20)) {
        activity.push({
          id: `bk-${b.id}`,
          kind: "booking",
          at: b.createdAt || `${b.date}T12:00:00.000Z`,
          title: `Booked ${cartMap.get(b.cartId)?.name ?? "cart"}`,
          detail: `${b.period} · ${fmtDate(b.date)}${
            b.className ? ` · ${b.className}` : ""
          }`,
        })
      }
      for (const issue of userIssues.slice(0, 12)) {
        activity.push({
          id: `iss-${issue.id}`,
          kind: "issue",
          at: issue.createdAt,
          title: `Issue on ${cartMap.get(issue.cartId)?.name ?? "cart"}`,
          detail: `${issue.severity} · ${issue.description}`,
        })
      }
      for (const swap of swaps.slice(0, 8)) {
        activity.push({
          id: `sw-${swap.id}`,
          kind: "swap",
          at: swap.createdAt,
          title: "Swap request",
          detail: swap.status + (swap.reason ? ` · ${swap.reason}` : ""),
        })
      }
      activity.sort((a, b) => b.at.localeCompare(a.at))

      const lastActiveAt =
        activity[0]?.at ?? user.updatedAt ?? user.createdAt ?? null

      const activeToday =
        allBookings.some((b) => b.date === today) ||
        userIssues.some((i) => safeIsToday(i.createdAt)) ||
        activity.some((a) => safeIsToday(a.at))

      let status: StaffMetrics["status"] = "ok"
      if (user.allowlisted === false) status = "revoked"
      else if (user.pendingInvite) status = "pending"
      else if (activeToday) status = "active"

      map.set(user.id, {
        upcoming,
        openIssues,
        activity,
        lastActiveAt,
        activeToday,
        status,
      })
    }

    return map
  }, [users, bookings, issues, swapRequests, cartMap, today])

  const counts = useMemo(() => {
    let all = 0
    let pending = 0
    let verified = 0
    let revoked = 0
    let activeToday = 0
    let openIssues = 0

    for (const user of users) {
      if (user.allowlisted === false) {
        revoked++
        continue
      }
      all++
      if (user.pendingInvite) pending++
      if (isVerifiedStaff(user)) verified++
      const m = metricsByUser.get(user.id)
      if (m?.activeToday) activeToday++
      openIssues += m?.openIssues.length ?? 0
    }

    return { all, pending, verified, revoked, activeToday, openIssues }
  }, [users, metricsByUser])

  /** Brand stats strip — same StatsDisplay as Schedule / Reports. */
  const staffStats = useMemo((): StatItem[] => {
    const spark = "rgb(23 23 23)"
    const end = parseISO(today)
    const dayKeys: string[] = []
    for (let i = 13; i >= 0; i--) {
      dayKeys.push(format(subDays(end, i), "yyyy-MM-dd"))
    }

    // Unique staff with a booking each day (14-day activity spark).
    const activeSpark = dayKeys.map((key) => {
      const ids = new Set<string>()
      for (const b of bookings) {
        if (b.date !== key) continue
        if (b.teacherId) ids.add(b.teacherId)
      }
      return ids.size
    })
    const yActive =
      activeSpark.length >= 2 ? activeSpark[activeSpark.length - 2]! : 0

    // Open issues reported per day (signal for staff-related load).
    const issueSpark = dayKeys.map((key) => {
      let n = 0
      for (const issue of issues) {
        if (issue.status !== "open") continue
        try {
          if (format(parseISO(issue.createdAt), "yyyy-MM-dd") === key) n++
        } catch {
          /* ignore bad dates */
        }
      }
      return n
    })
    const yIssues =
      issueSpark.length >= 2 ? issueSpark[issueSpark.length - 2]! : 0

    function dayOverDay(
      current: number,
      previous: number,
      upIsPositive?: boolean,
    ): StatItem["diff"] {
      if (previous <= 0) return undefined
      const raw = ((current - previous) / previous) * 100
      const value = Math.round(Math.max(-999, Math.min(999, raw)) * 10) / 10
      return { value, decimals: 1, upIsPositive }
    }

    const activeSeries =
      activeSpark.length >= 2
        ? activeSpark
        : [0, counts.activeToday]
    const issueSeries =
      issueSpark.length >= 2 ? issueSpark : [0, counts.openIssues]

    return [
      {
        key: "staff",
        label: "Staff",
        value: counts.all,
        format: { kind: "number" },
      },
      {
        key: "active",
        label: "Active today",
        value: counts.activeToday,
        format: { kind: "number" },
        sparkline: { data: activeSeries, color: spark },
        diff: dayOverDay(counts.activeToday, yActive),
      },
      {
        key: "pending",
        label: "Pending",
        value: counts.pending,
        format: { kind: "number" },
      },
      {
        key: "verified",
        label: "Verified",
        value: counts.verified,
        format: { kind: "number" },
      },
      {
        key: "issues",
        label: "Open issues",
        value: counts.openIssues,
        format: { kind: "number" },
        sparkline: { data: issueSeries, color: spark },
        diff: dayOverDay(counts.openIssues, yIssues, false),
      },
    ]
  }, [counts, bookings, issues, today])

  const filters: Array<{ id: FilterId; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "verified", label: "Verified", count: counts.verified },
    { id: "revoked", label: "Revoked", count: counts.revoked },
  ]

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    const list = users.filter((user) => {
      switch (filter) {
        case "pending":
          if (!user.pendingInvite || user.allowlisted === false) return false
          break
        case "verified":
          if (!isVerifiedStaff(user)) return false
          break
        case "revoked":
          if (user.allowlisted !== false) return false
          break
        default:
          // "All" = current allowlist (hide revoked noise)
          if (user.allowlisted === false) return false
          break
      }

      if (!term) return true
      return [user.name, user.email, user.role, user.title, user.department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    })

    return [...list].sort((a, b) => {
      if (sortKey === "activity") {
        const ma = metricsByUser.get(a.id)?.lastActiveAt ?? ""
        const mb = metricsByUser.get(b.id)?.lastActiveAt ?? ""
        const d = mb.localeCompare(ma)
        if (d !== 0) return d
      }
      return a.name.localeCompare(b.name)
    })
  }, [users, query, filter, sortKey, metricsByUser])

  const resolvedSelectedId =
    filtered.length === 0
      ? null
      : selectedId && filtered.some((u) => u.id === selectedId)
        ? selectedId
        : filtered[0].id

  const selected =
    filtered.find((u) => u.id === resolvedSelectedId) ??
    users.find((u) => u.id === resolvedSelectedId) ??
    null
  const selectedMetrics = selected
    ? metricsByUser.get(selected.id) ?? null
    : null

  function openAdd() {
    setFormError(null)
    setAccessDialog({ mode: "add" })
  }

  function openEdit(user: User) {
    setFormError(null)
    setAccessDialog({ mode: "edit", user })
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedEmail(email)
      toast({ title: "Email copied" })
      window.setTimeout(() => setCopiedEmail(null), 1500)
    } catch {
      toast({ title: "Could not copy", variant: "destructive" })
    }
  }

  function handleAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessDialog) return
    const formData = new FormData(event.currentTarget)
    const firstName = String(formData.get("firstName") ?? "").trim()
    const lastName = String(formData.get("lastName") ?? "").trim()
    const fullName = [firstName, lastName].filter(Boolean).join(" ")
    formData.set("name", fullName)
    // Local-part field + fixed @rbe.sk.ca (users never type the domain).
    const localRaw = String(formData.get("emailLocal") ?? "").trim()
    const local =
      localRaw || emailLocalFromNames(firstName, lastName)
    if (local) {
      formData.set("email", composeSchoolEmail(local))
    }
    formData.delete("emailLocal")
    formData.delete("firstName")
    formData.delete("lastName")
    const key =
      accessDialog.mode === "edit" ? accessDialog.user.id : "create"
    setBusyKey(key)
    setFormError(null)

    startTransition(async () => {
      const isReallowlist =
        accessDialog.mode === "edit" &&
        accessDialog.user.allowlisted === false

      if (accessDialog.mode === "add" || isReallowlist) {
        const res = await createTeacherCredentials(formData)
        setBusyKey(null)
        if (!res.ok) {
          setFormError(res.error)
          return
        }
        toast({
          title: isReallowlist ? "Access restored" : "Staff added",
          description: res.data?.name,
        })
        setAccessDialog(null)
        router.refresh()
        return
      }

      const res = await updateTeacherCredentials(
        accessDialog.user.id,
        formData,
      )
      setBusyKey(null)
      if (!res.ok) {
        setFormError(res.error)
        return
      }
      toast({ title: "Staff updated" })
      setAccessDialog(null)
      router.refresh()
    })
  }

  function handleRemove() {
    if (!deleteTarget) return
    const user = deleteTarget
    const permanent = deleteMode === "permanent"
    setBusyKey(`delete:${user.id}`)
    setDeleteError(null)

    startTransition(async () => {
      const res = permanent
        ? await purgeRevokedStaff(user.id)
        : await deleteTeacherCredentials(user.id)
      setBusyKey(null)
      if (!res.ok) {
        setDeleteError(res.error)
        toast({
          title: permanent
            ? "Could not delete staff"
            : "Could not remove staff",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: permanent ? "Deleted" : "Access removed",
        description: user.name,
      })
      setDeleteTarget(null)
      setDeleteMode("access")
      if (selectedId === user.id) setSelectedId(null)
      router.refresh()
    })
  }

  const editing =
    accessDialog?.mode === "edit" ? accessDialog.user : null
  const isRestore = editing?.allowlisted === false
  const searching = query.trim().length > 0

  return (
    <section className="flex flex-col gap-3">
      <StatsDisplay
        id="staff-stats"
        className="w-full max-w-none"
        stats={staffStats}
      />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {/* Header */}
        <div className="border-b border-neutral-200 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-neutral-950">
                Staff directory
              </p>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                Manage who can sign in and book carts
              </p>
            </div>
            <Button
              type="button"
              onClick={openAdd}
              className="h-8 shrink-0 rounded-md px-3 text-[12.5px] font-medium"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Add staff
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className="h-8 rounded-md border-neutral-200 bg-white pl-8 pr-8 text-[13px] shadow-none placeholder:text-neutral-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-neutral-400 hover:text-neutral-700"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <Select
              value={sortKey}
              onValueChange={(value) => setSortKey((value ?? "name") as SortKey)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Sort"
                className={cn(
                  "h-8 w-auto shrink-0 gap-1.5 rounded-md border-neutral-200 bg-white px-2.5",
                  "text-[12.5px] font-medium text-neutral-600 shadow-none",
                  "transition-[background-color,border-color,color] duration-150 ease-out",
                  "hover:border-neutral-300 hover:bg-neutral-50",
                  "data-[state=open]:border-neutral-400 data-[state=open]:bg-neutral-50",
                  "focus-visible:border-neutral-400 focus-visible:ring-0",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                position="popper"
                className={cn(
                  "min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
                  "border-neutral-200 bg-white shadow-md",
                  "data-[state=open]:duration-200 data-[state=closed]:duration-150",
                  "data-[state=open]:ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "data-[state=closed]:ease-in",
                )}
              >
                <SelectItem
                  value="name"
                  className={cn(
                    "cursor-pointer rounded-md py-1.5 pl-2 pr-8 text-[12.5px] text-neutral-700",
                    "transition-colors duration-150 ease-out",
                    "focus:bg-neutral-100 focus:text-neutral-950",
                    "data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950",
                  )}
                >
                  Sort by name
                </SelectItem>
                <SelectItem
                  value="activity"
                  className={cn(
                    "cursor-pointer rounded-md py-1.5 pl-2 pr-8 text-[12.5px] text-neutral-700",
                    "transition-colors duration-150 ease-out",
                    "focus:bg-neutral-100 focus:text-neutral-950",
                    "data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950",
                  )}
                >
                  Sort by activity
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="mt-3 flex gap-4 overflow-x-auto border-b border-neutral-100 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Filter staff"
          >
            {filters.map((item) => {
              const selectedFilter = filter === item.id
              // Always show All + Revoked (empty Revoked → empty state).
              // Hide empty Pending/Verified unless selected.
              if (
                item.id !== "all" &&
                item.id !== "revoked" &&
                item.count === 0 &&
                !selectedFilter
              ) {
                return null
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedFilter}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[12.5px] font-medium transition-colors",
                    selectedFilter
                      ? "border-neutral-950 text-neutral-950"
                      : "border-transparent text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "tabular-nums text-[11px]",
                      selectedFilter
                        ? "text-neutral-500"
                        : "text-neutral-400",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Master–detail */}
        <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(17.5rem,21rem)]">
          <div className="min-w-0 border-b border-neutral-200 lg:border-b-0 lg:border-r">
            {searching || filter !== "all" ? (
              <div className="border-b border-neutral-100 px-4 py-1.5 sm:px-5">
                <p className="text-[11.5px] text-neutral-400">
                  {filtered.length} result
                  {filtered.length === 1 ? "" : "s"}
                  {searching ? ` for “${query.trim()}”` : null}
                </p>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyList
                hasAny={users.length > 0}
                filter={filter}
                searching={searching}
                onAdd={openAdd}
                onClear={() => {
                  setQuery("")
                  setFilter("all")
                }}
                googleMode={googleMode}
              />
            ) : (
              <ul className="max-h-[min(68vh,38rem)] divide-y divide-neutral-100 overflow-y-auto">
                {filtered.map((user) => {
                  const m = metricsByUser.get(user.id)
                  const active = resolvedSelectedId === user.id
                  const verified = isVerifiedStaff(user)
                  const status = m?.status ?? "ok"
                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(user.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors sm:px-5",
                          active
                            ? "bg-neutral-50"
                            : "bg-white hover:bg-neutral-50/80",
                        )}
                      >
                        <StaffAvatar
                          user={user}
                          online={status === "active"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <VerifiedName
                              name={user.name}
                              verified={verified}
                              nameClassName="text-[13px] font-medium text-neutral-950"
                            />
                            {user.role === "admin" ? (
                              <span className="shrink-0 text-[11px] text-neutral-400">
                                Admin
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                            {user.email}
                          </p>
                        </div>
                        <ListStatus status={status} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="min-w-0 bg-white">
            {!selected || !selectedMetrics ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-16">
                <p className="text-[13px] text-neutral-400">
                  Select a staff member
                </p>
              </div>
            ) : (
              <StaffDetail
                user={selected}
                metrics={selectedMetrics}
                cartMap={cartMap}
                verifyBusy={busyKey === `verify:${selected.id}`}
                emailCopied={copiedEmail === selected.email}
                onCopyEmail={() => copyEmail(selected.email)}
                onEdit={() => openEdit(selected)}
                onRemove={() => {
                  setDeleteError(null)
                  setDeleteMode("access")
                  setDeleteTarget(selected)
                }}
                onPurge={() => {
                  setDeleteError(null)
                  setDeleteMode("permanent")
                  setDeleteTarget(selected)
                }}
                onSetVerified={(verified) => {
                  const id = selected.id
                  setBusyKey(`verify:${id}`)
                  startTransition(async () => {
                    const res = await setStaffVerified(id, verified)
                    setBusyKey(null)
                    if (!res.ok) {
                      toast({
                        title: "Could not update badge",
                        description: res.error,
                        variant: "destructive",
                      })
                      return
                    }
                    toast({
                      title: verified
                        ? "Verified badge granted"
                        : "Verified badge removed",
                      description: selected.name,
                    })
                    router.refresh()
                  })
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Add / edit — corporate minimal access sheet */}
      <Dialog
        open={accessDialog !== null}
        onOpenChange={(open) => !open && setAccessDialog(null)}
      >
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden border border-black/[0.07] bg-white p-0",
            "rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.1)]",
            "sm:max-w-[26rem]",
          )}
        >
          <DialogHeader className="gap-0 border-b border-black/[0.05] px-5 pb-3.5 pt-5 pr-12 text-left">
            <DialogTitle className="text-[16px] font-medium tracking-[-0.02em] text-neutral-950">
              {isRestore
                ? "Restore"
                : accessDialog?.mode === "edit"
                  ? "Edit staff"
                  : "Add staff"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {googleMode
                ? `Allowlist @${SCHOOL_EMAIL_DOMAIN}`
                : `Sandbox login @${SCHOOL_EMAIL_DOMAIN}`}
            </DialogDescription>
          </DialogHeader>

          <form
            key={
              accessDialog?.mode === "edit"
                ? `edit-${accessDialog.user.id}`
                : "add"
            }
            onSubmit={handleAccessSubmit}
            className="flex flex-col"
          >
            <div className="flex flex-col gap-4 px-5 py-4">
              <StaffIdentityFields
                defaultFirstName={
                  editing?.firstName ??
                  splitDisplayName(editing?.name ?? "").firstName ??
                  ""
                }
                defaultLastName={
                  editing?.lastName ??
                  splitDisplayName(editing?.name ?? "").lastName ??
                  ""
                }
                defaultEmail={editing?.email ?? ""}
                autoFocus={!editing}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="staff-role"
                    className={staffFieldLabelClassName}
                  >
                    Role
                  </label>
                  <select
                    id="staff-role"
                    name="role"
                    defaultValue={editing?.role ?? "teacher"}
                    className={staffSelectClassName}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="staff-employment"
                    className={staffFieldLabelClassName}
                  >
                    Employment
                  </label>
                  <select
                    id="staff-employment"
                    name="employmentType"
                    defaultValue={editing?.employmentType ?? "permanent"}
                    className={staffSelectClassName}
                  >
                    {EMPLOYMENT_TYPES.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-[11.5px] text-neutral-400">
                <VerifiedBadge size="xs" className="opacity-90" />
                Permanent = verified tick
              </p>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200/90 bg-red-50 px-3 py-2 text-[12.5px] text-red-700"
                >
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/[0.05] px-5 py-3">
              <DialogCancel
                className="h-9 px-3"
                onClick={() => setAccessDialog(null)}
              >
                Cancel
              </DialogCancel>
              <Button
                type="submit"
                className={cn(
                  "h-9 min-w-[5.5rem] rounded-full px-4",
                  "bg-neutral-950 text-[13px] font-medium tracking-[-0.01em] text-white",
                  "shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
                  "transition-[background-color,box-shadow,transform] duration-150",
                  "hover:bg-neutral-800 hover:shadow-[0_4px_12px_rgba(0,0,0,0.14)]",
                  "active:scale-[0.98]",
                  "disabled:opacity-50",
                )}
                disabled={
                  busyKey ===
                  (accessDialog?.mode === "edit"
                    ? accessDialog.user.id
                    : "create")
                }
              >
                {busyKey ===
                (accessDialog?.mode === "edit"
                  ? accessDialog.user.id
                  : "create") ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-3.5" />
                    Saving
                  </span>
                ) : isRestore ? (
                  "Restore"
                ) : accessDialog?.mode === "edit" ? (
                  "Save"
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove access / permanent delete revoked */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
            setDeleteMode("access")
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 sm:max-w-[22rem]">
          <DialogHeader className="gap-1 border-b border-neutral-200 px-5 py-4 pr-12 text-left">
            <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950">
              {deleteMode === "permanent" ? "Delete permanently" : "Remove access"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-neutral-500">
              {deleteMode === "permanent"
                ? "Removes them from the directory. This cannot be undone."
                : "They will not be able to sign in. History is kept."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 py-5">
            {deleteTarget ? (
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <StaffAvatar user={deleteTarget} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[13px] font-medium text-neutral-950">
                      {deleteTarget.name}
                    </p>
                    {isVerifiedStaff(deleteTarget) ? (
                      <VerifiedBadge size="xs" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                    {deleteTarget.email}
                  </p>
                </div>
              </div>
            ) : null}
            {deleteError ? (
              <p className="text-[12.5px] text-red-600">{deleteError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <DialogCancel
                className="h-8"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </DialogCancel>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 rounded-md"
                disabled={
                  deleteTarget
                    ? busyKey === `delete:${deleteTarget.id}`
                    : false
                }
                onClick={handleRemove}
              >
                {deleteTarget && busyKey === `delete:${deleteTarget.id}`
                  ? deleteMode === "permanent"
                    ? "Deleting…"
                    : "Removing…"
                  : deleteMode === "permanent"
                    ? "Delete"
                    : "Remove access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ─── Detail ─── */

function StaffDetail({
  user,
  metrics,
  cartMap,
  verifyBusy,
  emailCopied,
  onCopyEmail,
  onEdit,
  onRemove,
  onPurge,
  onSetVerified,
}: {
  user: User
  metrics: StaffMetrics
  cartMap: Map<string, Cart>
  verifyBusy?: boolean
  emailCopied?: boolean
  onCopyEmail: () => void
  onEdit: () => void
  onRemove: () => void
  onPurge: () => void
  onSetVerified: (verified: boolean) => void
}) {
  const verified = isVerifiedStaff(user)
  const canManageVerify = user.allowlisted !== false
  const isRevoked = user.allowlisted === false
  const profileBits = [user.title, user.department].filter(Boolean)
  const roleLabel = user.role === "admin" ? "Admin" : "Teacher"

  return (
    <div className="flex max-h-[min(68vh,38rem)] flex-col">
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <StaffAvatar
            user={user}
            size="lg"
            verified={verified}
            online={metrics.status === "active"}
          />
          <div className="min-w-0 flex-1">
            <h3 className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium text-neutral-950">
              <span className="truncate">{user.name}</span>
              {verified ? <VerifiedBadge size="sm" /> : null}
            </h3>
            <button
              type="button"
              onClick={onCopyEmail}
              className="mt-0.5 flex max-w-full items-center gap-1 text-left text-[12.5px] text-neutral-500 transition-colors hover:text-neutral-800"
              title="Copy email"
            >
              <span className="truncate">{user.email}</span>
              {emailCopied ? (
                <Check className="size-3 shrink-0 text-emerald-600" />
              ) : (
                <Copy className="size-3 shrink-0 opacity-60" />
              )}
            </button>
            {profileBits.length > 0 ? (
              <p className="mt-1 truncate text-[12px] text-neutral-400">
                {profileBits.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!isRevoked ? (
            <>
              <ActionBtn onClick={onEdit} icon={<Pencil className="size-3" />}>
                Edit
              </ActionBtn>
              <ActionBtn
                onClick={onRemove}
                icon={<Trash2 className="size-3" />}
                danger
              >
                Remove
              </ActionBtn>
            </>
          ) : (
            <>
              <ActionBtn onClick={onEdit} icon={<UserPlus className="size-3" />}>
                Restore
              </ActionBtn>
              <ActionBtn
                onClick={onPurge}
                icon={<Trash2 className="size-3" />}
                danger
              >
                Delete
              </ActionBtn>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Access facts */}
        <section className="border-b border-neutral-100 px-4 py-4 sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
            Access
          </p>
          <dl className="mt-3 space-y-2.5">
            <FactRow label="Status" value={detailStatusLabel(metrics.status)} />
            <FactRow label="Role" value={roleLabel} />
            <FactRow
              label="Employment"
              value={employmentLabel(user.employmentType)}
            />
            <FactRow
              label="Last active"
              value={
                metrics.lastActiveAt
                  ? relativeShort(metrics.lastActiveAt)
                  : "—"
              }
            />
          </dl>
        </section>

        {/* Verified */}
        {canManageVerify ? (
          <section className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-neutral-950">
                  Verified badge
                </p>
                {verified ? <VerifiedBadge size="xs" /> : null}
              </div>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                Blue tick for permanent staff
              </p>
            </div>
            <Switch
              checked={verified}
              disabled={verifyBusy}
              onCheckedChange={(next) => onSetVerified(next)}
              aria-label={
                verified ? "Remove verified badge" : "Grant verified badge"
              }
            />
          </section>
        ) : null}

        {/* Upcoming — only when present */}
        {metrics.upcoming.length > 0 ? (
          <section className="border-b border-neutral-100 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
              Upcoming ({metrics.upcoming.length})
            </p>
            <ul className="mt-2.5 divide-y divide-neutral-100">
              {metrics.upcoming.slice(0, 4).map((b) => (
                <li
                  key={b.id}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-[13px] text-neutral-800">
                    {cartMap.get(b.cartId)?.name ?? "Cart"}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                    {b.period} · {fmtDate(b.date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Issues — only when present */}
        {metrics.openIssues.length > 0 ? (
          <section className="border-b border-neutral-100 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
              Open issues ({metrics.openIssues.length})
            </p>
            <ul className="mt-2.5 space-y-2.5">
              {metrics.openIssues.slice(0, 3).map((issue) => (
                <li key={issue.id}>
                  <p className="text-[13px] text-neutral-800">
                    <span className="font-medium capitalize">
                      {issue.severity}
                    </span>
                    <span className="text-neutral-400">
                      {" "}
                      · {cartMap.get(issue.cartId)?.name ?? "Cart"}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-500">
                    {issue.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Activity */}
        <section className="px-4 py-4 sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
            Recent activity
          </p>
          {metrics.activity.length === 0 ? (
            <p className="mt-2.5 text-[13px] text-neutral-400">
              {user.pendingInvite
                ? "Has not signed in yet."
                : "No activity yet."}
            </p>
          ) : (
            <ul className="mt-2.5 divide-y divide-neutral-100">
              {metrics.activity.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-neutral-800">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-neutral-400">
                      {item.detail}
                    </p>
                  </div>
                  <p className="shrink-0 pt-0.5 text-[11px] tabular-nums text-neutral-400">
                    {relativeShort(item.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/* ─── Atoms ─── */

function ListStatus({ status }: { status: StaffMetrics["status"] }) {
  if (status === "ok" || status === "active") return null
  return (
    <span
      className={cn(
        "hidden shrink-0 text-[11.5px] sm:block",
        status === "pending" ? "text-amber-700" : "text-red-600",
      )}
    >
      {status === "pending" ? "Pending" : "Revoked"}
    </span>
  )
}

function detailStatusLabel(status: StaffMetrics["status"]): string {
  if (status === "active") return "Active today"
  if (status === "pending") return "Pending invite"
  if (status === "revoked") return "Access revoked"
  return "Signed in"
}

function FactRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12.5px] text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right text-[12.5px] font-medium text-neutral-900">
        {value}
      </dd>
    </div>
  )
}

function EmptyList({
  hasAny,
  filter,
  searching,
  onAdd,
  onClear,
  googleMode,
}: {
  hasAny: boolean
  filter: FilterId
  searching: boolean
  onAdd: () => void
  onClear: () => void
  googleMode: boolean
}) {
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-[13px] font-medium text-neutral-800">No staff yet</p>
        <p className="max-w-[16rem] text-[12.5px] leading-relaxed text-neutral-500">
          {googleMode
            ? `Add @${SCHOOL_EMAIL_DOMAIN} accounts so teachers can sign in.`
            : "Add the first staff member to get started."}
        </p>
        <Button
          type="button"
          onClick={onAdd}
          className="mt-2 h-8 rounded-md px-3 text-[12.5px]"
        >
          <Plus className="size-3.5" />
          Add staff
        </Button>
      </div>
    )
  }

  if (filter === "revoked" && !searching) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-[13px] font-medium text-neutral-800">
          No revoked accounts
        </p>
        <p className="max-w-[17rem] text-[12.5px] leading-relaxed text-neutral-500">
          People you remove from access will appear here so you can restore
          them later.
        </p>
      </div>
    )
  }

  const filterHint =
    filter === "pending"
      ? "No one is waiting to join."
      : filter === "verified"
        ? "No verified staff in this view."
        : "No matching staff."

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <p className="text-[13px] font-medium text-neutral-800">
        {searching ? "No results" : "Nothing here"}
      </p>
      <p className="max-w-[16rem] text-[12.5px] leading-relaxed text-neutral-500">
        {searching ? "Try a different name or email." : filterHint}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-1 text-[12.5px] font-medium text-neutral-700 underline-offset-2 hover:underline"
      >
        Clear filters
      </button>
    </div>
  )
}

function StaffAvatar({
  user,
  size = "md",
  verified = false,
  online = false,
}: {
  user: User
  size?: "md" | "lg"
  verified?: boolean
  online?: boolean
}) {
  const dim = size === "lg" ? "size-10 text-[12px]" : "size-8 text-[11px]"
  const badgeSize = size === "lg" ? "sm" : "xs"

  const face = user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      className={cn(dim, "rounded-full object-cover")}
    />
  ) : (
    <span
      className={cn(
        dim,
        "flex items-center justify-center rounded-full bg-neutral-100 font-medium text-neutral-600",
      )}
    >
      {initials(user.name)}
    </span>
  )

  return (
    <span className="relative shrink-0">
      {face}
      {verified && !online ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white ring-2 ring-white",
            size === "lg" ? "size-3.5" : "size-3",
          )}
        >
          <VerifiedBadge size={badgeSize} className="size-full" />
        </span>
      ) : null}
      {online ? (
        <span
          aria-label="Active today"
          className={cn(
            "absolute rounded-full bg-emerald-500 ring-2 ring-white",
            size === "lg"
              ? "bottom-0 right-0 size-2.5"
              : "bottom-0 right-0 size-2",
          )}
        />
      ) : null}
    </span>
  )
}

function ActionBtn({
  children,
  onClick,
  icon,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  icon: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
        danger
          ? "border-neutral-200 bg-white text-red-600 hover:border-red-200 hover:bg-red-50"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
      )}
    >
      {icon}
      {children}
    </button>
  )
}

const staffFieldLabelClassName =
  "text-[11.5px] font-medium tracking-[0.02em] text-neutral-500"

const staffControlClassName = cn(
  "h-10 w-full rounded-lg border border-neutral-200/90 bg-white",
  "text-[13px] tracking-[-0.01em] text-neutral-950 shadow-none",
  "outline-none transition-[border-color,box-shadow] duration-150",
  "placeholder:text-neutral-400",
  "focus-visible:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/[0.06]",
)

const staffSelectClassName = cn(
  staffControlClassName,
  "cursor-pointer appearance-none px-3 pr-8",
  // Subtle chevron without extra icon markup
  "bg-[length:12px_12px] bg-[right_0.7rem_center] bg-no-repeat",
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20stroke%3D%22%23a3a3a3%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m3%204.5%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')]",
)

/** Normalize a name token for email local-part (sarah, obrien). */
function slugEmailToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
}

/** first + "." + last → e.g. sarah.chen */
function emailLocalFromNames(firstName: string, lastName: string): string {
  const first = slugEmailToken(firstName)
  const last = slugEmailToken(lastName)
  if (first && last) return `${first}.${last}`
  return first || last || ""
}

/** Strip domain so the input only holds the local part. */
function schoolEmailLocalPart(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return ""
  const at = normalized.indexOf("@")
  if (at === -1) return normalized
  return normalized.slice(0, at)
}

/** Build a full school email; forces @rbe.sk.ca even if user pastes another domain. */
function composeSchoolEmail(localOrFull: string): string {
  const local = schoolEmailLocalPart(localOrFull)
    .replace(/[^a-z0-9._+-]/gi, "")
    .replace(/^\.+|\.+$/g, "")
  return `${local}@${SCHOOL_EMAIL_DOMAIN}`
}

/**
 * First + last name, with work email auto-filled as first.last@rbe.sk.ca.
 * Email stays in sync until the admin edits the local part manually.
 */
function StaffIdentityFields({
  defaultFirstName = "",
  defaultLastName = "",
  defaultEmail = "",
  autoFocus,
}: {
  defaultFirstName?: string
  defaultLastName?: string
  defaultEmail?: string
  autoFocus?: boolean
}) {
  const [firstName, setFirstName] = useState(defaultFirstName)
  const [lastName, setLastName] = useState(defaultLastName)
  const emailManual = useRef(false)
  const [emailLocal, setEmailLocal] = useState(() => {
    const fromEmail = schoolEmailLocalPart(defaultEmail)
    if (fromEmail) return fromEmail
    return emailLocalFromNames(defaultFirstName, defaultLastName)
  })

  function syncEmailFromNames(nextFirst: string, nextLast: string) {
    if (emailManual.current) return
    setEmailLocal(emailLocalFromNames(nextFirst, nextLast))
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="firstName" className={staffFieldLabelClassName}>
            First
          </label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => {
              const v = e.target.value
              setFirstName(v)
              syncEmailFromNames(v, lastName)
            }}
            placeholder="Sarah"
            required
            autoFocus={autoFocus}
            className={cn(staffControlClassName, "px-3")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lastName" className={staffFieldLabelClassName}>
            Last
          </label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => {
              const v = e.target.value
              setLastName(v)
              syncEmailFromNames(firstName, v)
            }}
            placeholder="Chen"
            required
            className={cn(staffControlClassName, "px-3")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="emailLocal" className={staffFieldLabelClassName}>
          Email
        </label>
        <div
          className={cn(
            "flex h-10 w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-neutral-200/90 bg-white",
            "shadow-none transition-[border-color,box-shadow] duration-150",
            "focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-900/[0.06]",
          )}
        >
          <input
            id="emailLocal"
            name="emailLocal"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={emailLocal}
            placeholder="first.last"
            required
            aria-describedby="staff-email-domain"
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] tracking-[-0.01em] text-neutral-950 outline-none",
              "placeholder:text-neutral-400",
            )}
            onChange={(e) => {
              emailManual.current = true
              setEmailLocal(
                e.target.value
                  .toLowerCase()
                  .replace(/@.*$/, "")
                  .replace(/\s+/g, ""),
              )
            }}
            onBlur={(e) => {
              const next = schoolEmailLocalPart(e.currentTarget.value)
              if (next !== e.currentTarget.value) setEmailLocal(next)
              if (!next) emailManual.current = false
            }}
          />
          <span
            id="staff-email-domain"
            className={cn(
              "inline-flex shrink-0 items-center border-l border-neutral-200/90 bg-neutral-50/90 px-3",
              "text-[12.5px] font-medium tabular-nums tracking-[-0.015em] text-neutral-500",
              "select-none",
            )}
            aria-hidden
          >
            @{SCHOOL_EMAIL_DOMAIN}
          </span>
        </div>
      </div>
    </div>
  )
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

function fmtDate(date: string) {
  try {
    return format(parseISO(date), "MMM d")
  } catch {
    return date
  }
}

function relativeShort(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function safeIsToday(iso: string) {
  try {
    return isToday(parseISO(iso))
  } catch {
    return false
  }
}
