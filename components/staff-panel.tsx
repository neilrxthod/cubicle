"use client"

import {
  useEffect,
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
} from "date-fns"
import {
  AlertTriangle,
  CalendarDays,
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
  updateTeacherCredentials,
} from "@/lib/actions"
import { isSupabaseConfigured } from "@/lib/supabase/env"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type FilterId =
  | "all"
  | "active"
  | "pending"
  | "permanent"
  | "contract"
  | "revoked"

type SortKey = "name" | "activity" | "bookings"

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

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active today" },
  { id: "pending", label: "Pending" },
  { id: "permanent", label: "Permanent" },
  { id: "contract", label: "Sub / temp" },
  { id: "revoked", label: "Revoked" },
]

/**
 * Admin staff directory — allowlist, profiles, activity.
 * Clean master-detail, no badge soup.
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
  const googleMode = isSupabaseConfigured()
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
      for (const b of allBookings.slice(0, 30)) {
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
      for (const issue of userIssues.slice(0, 20)) {
        activity.push({
          id: `iss-${issue.id}`,
          kind: "issue",
          at: issue.createdAt,
          title: `Issue on ${cartMap.get(issue.cartId)?.name ?? "cart"}`,
          detail: `${issue.severity} · ${issue.description}`,
        })
      }
      for (const swap of swaps.slice(0, 10)) {
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

  const summary = useMemo(() => {
    let pending = 0
    let active = 0
    let verified = 0
    let openIssues = 0
    let allowlisted = 0

    for (const user of users) {
      const m = metricsByUser.get(user.id)
      if (user.allowlisted !== false) allowlisted++
      if (user.pendingInvite && user.allowlisted !== false) pending++
      if (m?.activeToday) active++
      if (isVerifiedStaff(user)) verified++
      openIssues += m?.openIssues.length ?? 0
    }

    return { allowlisted, pending, active, verified, openIssues }
  }, [users, metricsByUser])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    const list = users.filter((user) => {
      const m = metricsByUser.get(user.id)
      const emp = user.employmentType ?? "permanent"

      switch (filter) {
        case "active":
          if (!m?.activeToday) return false
          break
        case "pending":
          if (!user.pendingInvite || user.allowlisted === false) return false
          break
        case "permanent":
          if (user.allowlisted === false || emp !== "permanent") return false
          break
        case "contract":
          if (
            user.allowlisted === false ||
            (emp !== "substitute" && emp !== "temporary")
          )
            return false
          break
        case "revoked":
          if (user.allowlisted !== false) return false
          break
        default:
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
      const ma = metricsByUser.get(a.id)
      const mb = metricsByUser.get(b.id)
      if (sortKey === "bookings") {
        const d =
          (mb?.upcoming.length ?? 0) +
          (mb?.activity.filter((x) => x.kind === "booking").length ?? 0) -
          ((ma?.upcoming.length ?? 0) +
            (ma?.activity.filter((x) => x.kind === "booking").length ?? 0))
        if (d !== 0) return d
      }
      if (sortKey === "activity") {
        const d = (mb?.lastActiveAt ?? "").localeCompare(ma?.lastActiveAt ?? "")
        if (d !== 0) return d
      }
      return a.name.localeCompare(b.name)
    })
  }, [users, query, filter, sortKey, metricsByUser])

  // Keep selection valid; auto-pick first when empty.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!selectedId || !filtered.some((u) => u.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected =
    filtered.find((u) => u.id === selectedId) ??
    users.find((u) => u.id === selectedId) ??
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
          title: isReallowlist ? "Restored" : "Added",
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
      toast({ title: "Saved" })
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
          title: "Could not remove",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Removed", description: user.name })
      setDeleteTarget(null)
      if (selectedId === user.id) setSelectedId(null)
      router.refresh()
    })
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: label })
    } catch {
      toast({ title: "Could not copy", variant: "destructive" })
    }
  }

  const editing =
    accessDialog?.mode === "edit" ? accessDialog.user : null
  const isRestore = editing?.allowlisted === false

  return (
    <section className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-9 rounded-lg border-neutral-200 bg-white pl-9 pr-8 text-[13px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-neutral-400 hover:text-neutral-700"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] text-neutral-700 outline-none focus:border-neutral-400"
              aria-label="Sort"
            >
              <option value="name">Name</option>
              <option value="activity">Recent activity</option>
              <option value="bookings">Bookings</option>
            </select>
            <Button
              type="button"
              onClick={openAdd}
              className="h-9 rounded-lg px-3.5 text-[12.5px] font-medium"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors",
                  filter === item.id
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="text-[12px] tabular-nums text-neutral-400">
            <span className="text-neutral-600">{summary.allowlisted}</span> staff
            {summary.pending > 0 ? (
              <>
                {" · "}
                <span className="text-amber-700">{summary.pending} pending</span>
              </>
            ) : null}
            {summary.active > 0 ? (
              <>
                {" · "}
                <span className="text-emerald-700">{summary.active} active</span>
              </>
            ) : null}
            {summary.verified > 0 ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-0.5 text-sky-700">
                  <VerifiedBadge size="xs" />
                  {summary.verified}
                </span>
              </>
            ) : null}
            {summary.openIssues > 0 ? (
              <>
                {" · "}
                <span className="text-red-600">{summary.openIssues} issues</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Master–detail */}
      <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-neutral-200/90 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        {/* List */}
        <div className="min-w-0 border-b border-neutral-100 lg:border-b-0 lg:border-r">
          {filtered.length === 0 ? (
            <EmptyList
              hasAny={users.length > 0}
              onAdd={openAdd}
              googleMode={googleMode}
            />
          ) : (
            <ul className="max-h-[min(70vh,40rem)] divide-y divide-neutral-100 overflow-y-auto">
              {filtered.map((user) => {
                const m = metricsByUser.get(user.id)
                const active = selectedId === user.id
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-neutral-50 ring-1 ring-inset ring-neutral-200/80"
                          : "hover:bg-neutral-50/80",
                      )}
                    >
                      <Avatar user={user} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <VerifiedName
                            name={user.name}
                            verified={isVerifiedStaff(user)}
                            nameClassName="text-[13.5px] font-medium tracking-tight text-neutral-950"
                          />
                          {user.role === "admin" ? (
                            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                              Admin
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                          {user.email}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                          <StatusDot status={m?.status ?? "ok"} />
                          <span className="text-neutral-300">·</span>
                          <span>{employmentLabel(user.employmentType)}</span>
                          {(m?.openIssues.length ?? 0) > 0 ? (
                            <>
                              <span className="text-neutral-300">·</span>
                              <span className="text-red-600">
                                {m!.openIssues.length} issue
                                {m!.openIssues.length === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0 bg-white">
          {!selected || !selectedMetrics ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <p className="text-[13px] text-neutral-400">
                Select someone to view profile and activity.
              </p>
            </div>
          ) : (
            <StaffDetail
              user={selected}
              metrics={selectedMetrics}
              cartMap={cartMap}
              googleMode={googleMode}
              onEdit={() => openEdit(selected)}
              onRemove={() => {
                setDeleteError(null)
                setDeleteTarget(selected)
              }}
              onCopyEmail={() => copyText(selected.email, "Email copied")}
            />
          )}
        </div>
      </div>

      {/* Add / edit */}
      <Dialog
        open={accessDialog !== null}
        onOpenChange={(open) => !open && setAccessDialog(null)}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 sm:max-w-[26rem]">
          <DialogHeader className="space-y-1 border-b border-neutral-100 px-5 py-4 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              {isRestore
                ? "Restore"
                : accessDialog?.mode === "edit"
                  ? "Edit"
                  : "Add staff"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {googleMode
                ? `@${SCHOOL_EMAIL_DOMAIN} only`
                : "Demo staff login"}
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
              label="Name"
              name="name"
              defaultValue={editing?.name ?? ""}
              placeholder="Sarah Chen"
              required
            />
            <Field
              label="Email"
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
                  className="text-[11px] font-medium text-neutral-500"
                >
                  Role
                </label>
                <select
                  id="staff-role"
                  name="role"
                  defaultValue={editing?.role ?? "teacher"}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] outline-none focus:border-neutral-400"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="staff-employment"
                  className="text-[11px] font-medium text-neutral-500"
                >
                  Employment
                </label>
                <select
                  id="staff-employment"
                  name="employmentType"
                  defaultValue={editing?.employmentType ?? "permanent"}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] outline-none focus:border-neutral-400"
                >
                  {EMPLOYMENT_TYPES.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.shortLabel}
                      {opt.verified ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11.5px] leading-snug text-neutral-400">
              Permanent = blue tick. Sub / temp can still sign in.
            </p>

            {formError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {formError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setAccessDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-lg px-4"
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
                  "Save"
                ) : (
                  "Add"
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
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 sm:max-w-[24rem]">
          <DialogHeader className="space-y-1 border-b border-neutral-100 px-5 py-4 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              Remove
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Blocks sign-in. History is kept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 py-5">
            {deleteTarget ? (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2.5">
                <Avatar user={deleteTarget} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {deleteTarget.name}
                  </p>
                  <p className="truncate text-[12px] text-neutral-400">
                    {deleteTarget.email}
                  </p>
                </div>
              </div>
            ) : null}
            {deleteError ? (
              <p className="text-[12.5px] text-red-600">{deleteError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9 rounded-lg"
                disabled={
                  deleteTarget
                    ? busyKey === `delete:${deleteTarget.id}`
                    : false
                }
                onClick={handleRemove}
              >
                {deleteTarget && busyKey === `delete:${deleteTarget.id}`
                  ? "Removing…"
                  : "Remove"}
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
  googleMode,
  onEdit,
  onRemove,
  onCopyEmail,
}: {
  user: User
  metrics: StaffMetrics
  cartMap: Map<string, Cart>
  googleMode: boolean
  onEdit: () => void
  onRemove: () => void
  onCopyEmail: () => void
}) {
  const verified = isVerifiedStaff(user)

  return (
    <div className="flex max-h-[min(70vh,40rem)] flex-col">
      <div className="border-b border-neutral-100 px-4 py-4">
        <div className="flex items-start gap-3">
          <Avatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <VerifiedName
              name={user.name}
              verified={verified}
              size="md"
              nameClassName="text-[15px] font-semibold tracking-tight text-neutral-950"
            />
            <p className="mt-0.5 truncate text-[12.5px] text-neutral-400">
              {user.email}
            </p>
            <p className="mt-1.5 text-[11.5px] text-neutral-500">
              <StatusDot status={metrics.status} />
              <span className="mx-1.5 text-neutral-300">·</span>
              {user.role === "admin" ? "Admin" : "Teacher"}
              <span className="mx-1.5 text-neutral-300">·</span>
              {employmentLabel(user.employmentType)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <GhostBtn onClick={onCopyEmail} icon={<Copy className="size-3" />}>
            Email
          </GhostBtn>
          {user.allowlisted !== false ? (
            <>
              <GhostBtn onClick={onEdit} icon={<Pencil className="size-3" />}>
                Edit
              </GhostBtn>
              <GhostBtn
                onClick={onRemove}
                icon={<Trash2 className="size-3" />}
                danger
              >
                Remove
              </GhostBtn>
            </>
          ) : (
            <GhostBtn onClick={onEdit} icon={<UserPlus className="size-3" />}>
              Restore
            </GhostBtn>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Snapshot */}
        <div className="grid grid-cols-3 gap-2">
          <StatCell
            label="Upcoming"
            value={metrics.upcoming.length}
            icon={<CalendarDays className="size-3" />}
          />
          <StatCell
            label="Issues"
            value={metrics.openIssues.length}
            icon={<AlertTriangle className="size-3" />}
            warn={metrics.openIssues.length > 0}
          />
          <StatCell
            label="Last active"
            value={
              metrics.lastActiveAt
                ? relativeShort(metrics.lastActiveAt)
                : "—"
            }
            compact
          />
        </div>

        {/* Profile facts */}
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Profile
          </h4>
          <dl className="mt-2 space-y-2 text-[12.5px]">
            <Fact label="Title" value={user.title || "—"} />
            <Fact label="Department" value={user.department || "—"} />
            <Fact label="Phone" value={user.phone || "—"} />
            <Fact
              label="Access"
              value={
                user.allowlisted === false
                  ? "Revoked"
                  : user.pendingInvite
                    ? "Pending"
                    : "Allowed"
              }
            />
            <Fact label="Verified" value={verified ? "Yes" : "No"} />
          </dl>
        </section>

        {/* Upcoming */}
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Upcoming
          </h4>
          {metrics.upcoming.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-neutral-400">None</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {metrics.upcoming.slice(0, 5).map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg bg-neutral-50 px-2.5 py-2 text-[12px] text-neutral-700"
                >
                  <span className="font-medium text-neutral-900">
                    {cartMap.get(b.cartId)?.name ?? "Cart"}
                  </span>
                  <span className="text-neutral-400">
                    {" "}
                    · {b.period} · {fmtDate(b.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Issues */}
        {metrics.openIssues.length > 0 ? (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Open issues
            </h4>
            <ul className="mt-2 space-y-1">
              {metrics.openIssues.slice(0, 4).map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-lg border border-red-100 bg-red-50/50 px-2.5 py-2 text-[12px]"
                >
                  <span className="font-medium capitalize text-red-800">
                    {issue.severity}
                  </span>
                  <span className="text-neutral-500">
                    {" "}
                    · {cartMap.get(issue.cartId)?.name ?? "Cart"}
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-neutral-600">
                    {issue.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Activity */}
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Activity
          </h4>
          {metrics.activity.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-neutral-400">
              {user.pendingInvite
                ? "Waiting for first sign-in."
                : "None"}
            </p>
          ) : (
            <ol className="mt-2 space-y-0">
              {metrics.activity.slice(0, 12).map((item, i, arr) => (
                <li key={item.id} className="relative flex gap-2.5 pb-3">
                  {i < arr.length - 1 ? (
                    <span className="absolute left-[5px] top-4 bottom-0 w-px bg-neutral-100" />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-[1] mt-1 size-2.5 shrink-0 rounded-full",
                      item.kind === "issue"
                        ? "bg-red-400"
                        : item.kind === "swap"
                          ? "bg-amber-400"
                          : "bg-neutral-300",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-neutral-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11.5px] text-neutral-400">
                      {item.detail}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-neutral-300">
                      {relativeShort(item.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

/* ─── Atoms ─── */

function EmptyList({
  hasAny,
  onAdd,
  googleMode,
}: {
  hasAny: boolean
  onAdd: () => void
  googleMode: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <UserPlus className="size-4" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[13px] font-medium text-neutral-800">
          {hasAny ? "No matches" : "No staff"}
        </p>
        <p className="mt-1 max-w-[16rem] text-[12.5px] text-neutral-400">
          {hasAny
            ? "Try another search."
            : googleMode
              ? `Add @${SCHOOL_EMAIL_DOMAIN} emails.`
              : "Add the first person."}
        </p>
      </div>
      {!hasAny ? (
        <Button
          type="button"
          onClick={onAdd}
          className="mt-1 h-8 rounded-lg px-3 text-[12px]"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      ) : null}
    </div>
  )
}

function Avatar({
  user,
  size = "md",
}: {
  user: User
  size?: "md" | "lg"
}) {
  const dim = size === "lg" ? "size-11 text-[12px]" : "size-9 text-[11px]"
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(dim, "shrink-0 rounded-full object-cover")}
      />
    )
  }
  return (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-600",
      )}
    >
      {initials(user.name)}
    </span>
  )
}

function StatusDot({ status }: { status: StaffMetrics["status"] }) {
  const map: Record<
    StaffMetrics["status"],
    { label: string; className: string }
  > = {
    active: { label: "Active today", className: "bg-emerald-500" },
    pending: { label: "Pending invite", className: "bg-amber-400" },
    revoked: { label: "Revoked", className: "bg-red-400" },
    ok: { label: "Signed in", className: "bg-neutral-300" },
  }
  const s = map[status]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", s.className)} />
      <span>{s.label}</span>
    </span>
  )
}

function StatCell({
  label,
  value,
  icon,
  warn,
  compact,
}: {
  label: string
  value: number | string
  icon?: ReactNode
  warn?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        warn
          ? "border-red-100 bg-red-50/40"
          : "border-neutral-100 bg-neutral-50/50",
      )}
    >
      <div className="flex items-center gap-1 text-neutral-400">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 font-light tabular-nums tracking-tight",
          compact ? "text-[12px] font-medium" : "text-[1.125rem]",
          warn ? "text-red-700" : "text-neutral-900",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-neutral-800">
        {value}
      </dd>
    </div>
  )
}

function GhostBtn({
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
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium transition-colors",
        danger
          ? "border-red-100 bg-white text-red-600 hover:bg-red-50"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
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
        className="text-[11px] font-medium text-neutral-500"
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
        className="h-9 rounded-lg border-neutral-200 text-[13px]"
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
