"use client"

import {
  useMemo,
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
  setStaffVerified,
  updateTeacherCredentials,
} from "@/lib/actions"
import { isRemotePlatformEnabled } from "@/lib/data/durability"
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/school-domain"
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
    setBusyKey(`delete:${user.id}`)
    setDeleteError(null)

    startTransition(async () => {
      const res = await deleteTeacherCredentials(user.id)
      setBusyKey(null)
      if (!res.ok) {
        setDeleteError(res.error)
        toast({
          title: "Could not remove staff",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Access removed", description: user.name })
      setDeleteTarget(null)
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
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-2 text-[12.5px] text-neutral-600 outline-none focus:border-neutral-400"
              aria-label="Sort"
            >
              <option value="name">Sort by name</option>
              <option value="activity">Sort by activity</option>
            </select>
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
                        <StaffAvatar user={user} />
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

      {/* Add / edit */}
      <Dialog
        open={accessDialog !== null}
        onOpenChange={(open) => !open && setAccessDialog(null)}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-lg border-neutral-200 p-0 sm:max-w-[24rem]">
          <DialogHeader className="gap-1 border-b border-neutral-200 px-5 py-4 text-left">
            <DialogTitle className="text-[14px] font-medium text-neutral-950">
              {isRestore
                ? "Restore access"
                : accessDialog?.mode === "edit"
                  ? "Edit staff"
                  : "Add staff"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-neutral-500">
              {googleMode
                ? `School accounts only (@${SCHOOL_EMAIL_DOMAIN})`
                : "Create a staff login for the demo"}
            </DialogDescription>
          </DialogHeader>

          <form
            key={
              accessDialog?.mode === "edit"
                ? `edit-${accessDialog.user.id}`
                : "add"
            }
            onSubmit={handleAccessSubmit}
            className="grid gap-4 px-5 py-5"
          >
            <Field
              label="Full name"
              name="name"
              defaultValue={editing?.name ?? ""}
              placeholder="Sarah Chen"
              required
            />
            <Field
              label="Work email"
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              placeholder={
                googleMode
                  ? `name@${SCHOOL_EMAIL_DOMAIN}`
                  : "teacher@school.edu"
              }
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="staff-role"
                  className="text-[12px] font-medium text-neutral-600"
                >
                  Role
                </label>
                <select
                  id="staff-role"
                  name="role"
                  defaultValue={editing?.role ?? "teacher"}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-[13px] outline-none focus:border-neutral-400"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="staff-employment"
                  className="text-[12px] font-medium text-neutral-600"
                >
                  Employment
                </label>
                <select
                  id="staff-employment"
                  name="employmentType"
                  defaultValue={editing?.employmentType ?? "permanent"}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-[13px] outline-none focus:border-neutral-400"
                >
                  {EMPLOYMENT_TYPES.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[12px] leading-snug text-neutral-500">
              Permanent = verified blue tick on their name.
            </p>

            {formError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {formError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <DialogCancel
                className="h-8"
                onClick={() => setAccessDialog(null)}
              >
                Cancel
              </DialogCancel>
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-md px-3.5"
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
                    Saving…
                  </span>
                ) : isRestore ? (
                  "Restore"
                ) : accessDialog?.mode === "edit" ? (
                  "Save changes"
                ) : (
                  "Add staff"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-lg border-neutral-200 p-0 sm:max-w-[22rem]">
          <DialogHeader className="gap-1 border-b border-neutral-200 px-5 py-4 text-left">
            <DialogTitle className="text-[14px] font-medium text-neutral-950">
              Remove access
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-neutral-500">
              They will not be able to sign in. Booking history is kept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 py-5">
            {deleteTarget ? (
              <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
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
                  ? "Removing…"
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
  onSetVerified: (verified: boolean) => void
}) {
  const verified = isVerifiedStaff(user)
  const canManageVerify = user.allowlisted !== false
  const profileBits = [user.title, user.department].filter(Boolean)
  const roleLabel = user.role === "admin" ? "Admin" : "Teacher"

  return (
    <div className="flex max-h-[min(68vh,38rem)] flex-col">
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <StaffAvatar user={user} size="lg" verified={verified} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-[15px] font-medium text-neutral-950">
                {user.name}
              </h3>
              {verified ? (
                <VerifiedBadge size="sm" title="Verified permanent staff" />
              ) : null}
            </div>
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
          {user.allowlisted !== false ? (
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
            <ActionBtn onClick={onEdit} icon={<UserPlus className="size-3" />}>
              Restore access
            </ActionBtn>
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
  if (status === "ok") return null
  const label =
    status === "active"
      ? "Active"
      : status === "pending"
        ? "Pending"
        : "Revoked"
  return (
    <span
      className={cn(
        "hidden shrink-0 text-[11.5px] sm:block",
        status === "active"
          ? "text-emerald-700"
          : status === "pending"
            ? "text-amber-700"
            : "text-red-600",
      )}
    >
      {label}
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
}: {
  user: User
  size?: "md" | "lg"
  verified?: boolean
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
      {verified ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white ring-2 ring-white",
            size === "lg" ? "size-3.5" : "size-3",
          )}
        >
          <VerifiedBadge size={badgeSize} className="size-full" />
        </span>
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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-medium text-neutral-600"
      >
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-9 rounded-md border-neutral-200 text-[13px] shadow-none"
      />
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
