"use client"

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"

import {
  createTeacherCredentials,
  deleteTeacherCredentials,
  resetTeacherPassword,
  updateTeacherCredentials,
} from "@/lib/actions"
import type { User } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TeacherDialogState =
  | { mode: "create" }
  | { mode: "edit"; teacher: User }

type CredentialNotice = {
  mode: "created" | "reset"
  teacherName: string
  email: string
  password: string
}

type SortKey = "name" | "email"

export function TeacherCredentialsPanel({ teachers }: { teachers: User[] }) {
  const router = useRouter()
  const [dialogState, setDialogState] = useState<TeacherDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [notice, setNotice] = useState<CredentialNotice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(() => new Set())
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const sortedTeachers = useMemo(
    () =>
      [...teachers].sort((a, b) => {
        const first = sortKey === "email" ? a.email : a.name
        const second = sortKey === "email" ? b.email : b.name
        return first.localeCompare(second)
      }),
    [sortKey, teachers],
  )

  const filteredTeachers = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return sortedTeachers

    return sortedTeachers.filter((teacher) =>
      `${teacher.name} ${teacher.email}`.toLowerCase().includes(term),
    )
  }, [query, sortedTeachers])

  function openCreateDialog() {
    setError(null)
    setDialogState({ mode: "create" })
  }

  function openEditDialog(teacher: User) {
    setError(null)
    setDialogState({ mode: "edit", teacher })
  }

  function closeDialog() {
    setError(null)
    setDialogState(null)
  }

  async function copyText(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title })
    } catch {
      toast({
        title: "Could not copy",
        description: "Copy the credentials manually instead.",
        variant: "destructive",
      })
    }
  }

  function copyVisibleLogins() {
    if (filteredTeachers.length === 0) {
      toast({ title: "No logins to copy", description: "Adjust the search to include at least one teacher." })
      return
    }

    const text = filteredTeachers.map(formatTeacherLogin).join("\n\n")
    void copyText(text, `${filteredTeachers.length} login${filteredTeachers.length === 1 ? "" : "s"} copied`)
  }

  function exportVisibleLogins() {
    if (filteredTeachers.length === 0) {
      toast({ title: "No logins to export", description: "Adjust the search to include at least one teacher." })
      return
    }

    const csv = [
      ["Teacher", "Email", "Password"].join(","),
      ...filteredTeachers.map((teacher) =>
        [teacher.name, teacher.email, teacher.password].map(escapeCsvValue).join(","),
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "teacher-credentials.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: "Credentials exported" })
  }

  function togglePasswordVisibility(teacherId: string) {
    setRevealedPasswords((current) => {
      const next = new Set(current)
      if (next.has(teacherId)) {
        next.delete(teacherId)
      } else {
        next.add(teacherId)
      }
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialogState) return

    const formData = new FormData(event.currentTarget)
    const pendingKey = dialogState.mode === "edit" ? dialogState.teacher.id : "create"
    setBusyKey(pendingKey)
    setError(null)

    startTransition(async () => {
      if (dialogState.mode === "create") {
        const res = await createTeacherCredentials(formData)
        setBusyKey(null)

        if ("error" in res && res.error) {
          setError(res.error)
          return
        }

        const teacher = "data" in res ? res.data : undefined
        if (!teacher) {
          setError("Could not generate teacher credentials.")
          return
        }

        setNotice({
          mode: "created",
          teacherName: teacher.name,
          email: teacher.email,
          password: teacher.password,
        })
        toast({
          title: "Teacher credentials generated",
          description: `${teacher.name} can sign in with the new login details.`,
        })
        closeDialog()
        router.refresh()
        return
      }

      const res = await updateTeacherCredentials(dialogState.teacher.id, formData)
      setBusyKey(null)

      if ("error" in res && res.error) {
        setError(res.error)
        return
      }

      toast({
        title: "Teacher updated",
        description: "The login email and display name were saved.",
      })
      closeDialog()
      router.refresh()
    })
  }

  function handleResetPassword(teacher: User) {
    setBusyKey(teacher.id)
    setError(null)

    startTransition(async () => {
      const res = await resetTeacherPassword(teacher.id)
      setBusyKey(null)

      if ("error" in res && res.error) {
        toast({
          title: "Could not reset password",
          description: res.error,
          variant: "destructive",
        })
        return
      }

      const password = "data" in res ? res.data?.password : undefined
      if (!password) {
        toast({
          title: "Could not reset password",
          description: "The new password was not returned.",
          variant: "destructive",
        })
        return
      }

      setNotice({
        mode: "reset",
        teacherName: teacher.name,
        email: teacher.email,
        password,
      })
      toast({
        title: "Password regenerated",
        description: `${teacher.name} now has a new login password.`,
      })
      router.refresh()
    })
  }

  function handleDeleteTeacher() {
    if (!deleteTarget) return

    const teacher = deleteTarget
    setBusyKey(`delete:${teacher.id}`)
    setDeleteError(null)

    startTransition(async () => {
      try {
        const res = await deleteTeacherCredentials(teacher.id)

        if ("error" in res && res.error) {
          setDeleteError(res.error)
          toast({
            title: "Could not remove login",
            description: res.error,
            variant: "destructive",
          })
          return
        }

        toast({ title: "Teacher login removed", description: `${teacher.name} can no longer sign in.` })
        setDeleteTarget(null)
        setNotice((current) => (current?.email === teacher.email ? null : current))
        router.refresh()
      } catch (err) {
        const message = getDeleteFailureMessage(err)
        setDeleteError(message)
        toast({
          title: "Could not remove login",
          description: message,
          variant: "destructive",
        })
      } finally {
        setBusyKey(null)
      }
    })
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-foreground sm:text-[30px]">
              Teacher credentials
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {sortedTeachers.length} {sortedTeachers.length === 1 ? "teacher" : "teachers"} / {sortedTeachers.length}{" "}
              {sortedTeachers.length === 1 ? "login" : "logins"}
            </p>
          </div>

          <Button
            type="button"
            onClick={openCreateDialog}
            className="h-10 w-full rounded-full px-4 text-[12px] font-semibold shadow-sm sm:w-auto"
          >
            <Plus className="size-4" />
            Create
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              className="h-10 rounded-full border-border/70 bg-background pl-9 pr-3 text-[13px] shadow-none focus-visible:border-border/70 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex items-center gap-2 md:justify-end">
            <DropdownMenu modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-full border-border/70 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border/70"
                      aria-label="Sort teachers"
                    >
                      <SlidersHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sort teachers</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="email">Email</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <IconButton label="Copy visible logins" className="size-10" onClick={copyVisibleLogins}>
              <Copy className="size-4" />
            </IconButton>

            <IconButton label="Export credentials CSV" className="size-10" onClick={exportVisibleLogins}>
              <Download className="size-4" />
            </IconButton>
          </div>
        </div>
      </div>

      {notice && (
        <div className="m-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 sm:m-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex h-6 items-center rounded-full border border-emerald-200 bg-white px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
                {notice.mode === "created" ? "Credentials ready" : "Password reset"}
              </p>
              <h3 className="mt-1 text-[16px] font-semibold text-foreground">{notice.teacherName}</h3>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">{notice.email}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-[12px] font-semibold tracking-[0.04em] tabular-nums text-foreground">
                {notice.password}
              </div>
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-full px-4 font-semibold"
                onClick={() => copyText(notice.password, "Password copied")}
                aria-label="Copy password"
              >
                Copy password
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 px-5 py-5 sm:px-6 sm:py-6">
        {sortedTeachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 px-6 py-10 text-center text-[13px] text-muted-foreground">
            No teachers yet. Create the first login above to get started.
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 px-6 py-10 text-center text-[13px] text-muted-foreground">
            No teachers match your search.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTeachers.map((teacher) => {
              const isBusy = busyKey === teacher.id || busyKey === `delete:${teacher.id}`
              const isPasswordVisible = revealedPasswords.has(teacher.id)

              return (
                <div
                  key={teacher.id}
                  className={cn(
                    "rounded-xl border border-border/70 bg-background px-4 py-4 transition hover:border-foreground/15 hover:bg-muted/20",
                    isBusy && "opacity-70",
                  )}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                        {getInitials(teacher.name)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{teacher.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                          <p className="truncate">{teacher.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
                      <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/20 p-1">
                        <span className="inline-flex h-8 min-w-32 items-center px-3 text-[12px] font-semibold tracking-[0.04em] tabular-nums text-foreground">
                          {isPasswordVisible ? teacher.password : maskPassword(teacher.password)}
                        </span>
                        <IconButton
                          label={isPasswordVisible ? "Hide" : "Show"}
                          disabled={isBusy}
                          onClick={() => togglePasswordVisibility(teacher.id)}
                        >
                          {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </IconButton>
                        <IconButton label="Copy password" disabled={isBusy} onClick={() => copyText(teacher.password, "Password copied")}>
                          <Copy className="size-4" />
                        </IconButton>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-10 rounded-full border-border/70 shadow-none"
                            disabled={isBusy}
                            aria-label={`Actions for ${teacher.name}`}
                            title="More actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => copyText(teacher.email, "Email copied")}>
                            <Mail className="size-4" />
                            Copy email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyText(formatTeacherLogin(teacher), "Login copied")}>
                            <Copy className="size-4" />
                            Copy login
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(teacher)}>
                            <RefreshCw className="size-4" />
                            Reset password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteTarget(teacher)
                            }}
                          >
                            <Trash2 className="size-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="overflow-hidden rounded-3xl border border-border/80 bg-background p-0 shadow-xl sm:max-w-xl">
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <DialogTitle>
              {dialogState?.mode === "create" ? "Create teacher login" : "Edit teacher login"}
            </DialogTitle>
          </DialogHeader>

          <form
            key={dialogState?.mode === "edit" ? dialogState.teacher.id : "create"}
            onSubmit={handleSubmit}
            className="grid gap-5 px-6 py-6"
          >
            <div className="grid gap-4">
              <Field
                label="Name"
                name="name"
                type="text"
                defaultValue={dialogState?.mode === "edit" ? dialogState.teacher.name : ""}
                placeholder="Ms. Sarah Chen"
                autoComplete="name"
                required
              />
            </div>

            {error && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={closeDialog} className="h-9 rounded-full px-4 text-muted-foreground">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-full px-5"
                disabled={busyKey === (dialogState?.mode === "edit" ? dialogState.teacher.id : "create")}
              >
                {dialogState?.mode === "create" ? (
                  busyKey === "create" ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="size-4" />
                      Creating
                    </span>
                  ) : (
                    "Create"
                  )
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteError(null)
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="overflow-hidden rounded-2xl border border-border bg-background p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              <DialogTitle className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                Delete credentials
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-6">
            {deleteTarget && (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                  {getInitials(deleteTarget.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground">{deleteTarget.name}</h3>
                  <p className="mt-1 truncate text-[13px] text-muted-foreground">{deleteTarget.email}</p>
                </div>
              </div>
            )}

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              This removes sign-in access for this teacher. Existing booking history stays in the system.
            </p>

            {deleteError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                {deleteError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteTarget(null)
                }}
                className="rounded-full px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-full px-4"
                disabled={deleteTarget ? busyKey === `delete:${deleteTarget.id}` : false}
                onClick={handleDeleteTeacher}
              >
                {deleteTarget && busyKey === `delete:${deleteTarget.id}` ? "Deleting..." : "Delete credentials"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("size-8 rounded-full border-border/70 bg-background text-muted-foreground shadow-none", className)}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function formatTeacherLogin(teacher: User) {
  return `Email: ${teacher.email}\nPassword: ${teacher.password}`
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function maskPassword(password: string) {
  return "*".repeat(Math.max(password.length, 8))
}

function getDeleteFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (!message || message.toLowerCase().includes("fetch")) {
    return "We couldn't delete these credentials. Check your connection and try again."
  }

  return message
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="h-11 rounded-xl border border-border/50 bg-muted/20 px-3 text-[14px] text-foreground placeholder:text-muted-foreground/50 shadow-none outline-none transition-[border-color,background-color] focus-visible:border-foreground/50 focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  )
}

