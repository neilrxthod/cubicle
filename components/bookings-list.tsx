"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePlatformStore } from "@/lib/data/platform-store"
import { isVerifiedStaff } from "@/lib/staff/employment"
import { VerifiedBadge } from "@/components/verified-badge"

export function BookingsList({
  title,
  bookings,
  carts,
  emptyLabel,
  emptyAction,
  canCancel = false,
}: {
  title: string
  bookings: Booking[]
  carts: Cart[]
  emptyLabel: string
  emptyAction?: { href: string; label: string }
  canCancel?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const platform = usePlatformStore()
  const verifiedIds = new Set(
    platform.users.filter((u) => isVerifiedStaff(u)).map((u) => u.id),
  )

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-neutral-100 px-4">
        <h2 className="type-section-title">{title}</h2>
        <span className="text-[12px] font-medium tabular-nums text-neutral-400">
          {bookings.length}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-[13px] text-neutral-400">{emptyLabel}</p>
          {emptyAction ? (
            <Link
              href={emptyAction.href}
              className="inline-flex h-8 items-center rounded-lg bg-neutral-950 px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {emptyAction.label}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul>
          {bookings.map((b, index) => {
            const cart = cartMap.get(b.cartId)
            const dt = parseISO(b.date)
            const classLabel = b.className?.trim()
            const subjectLabel = b.subject?.trim()
            return (
              <li
                key={b.id}
                className={cn(
                  "grid gap-3 px-4 py-3.5 sm:grid-cols-[7rem_3rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5",
                  index > 0 && "border-t border-neutral-100",
                  "transition-colors hover:bg-neutral-50/80",
                )}
              >
                <div className="min-w-0">
                  <span className="type-body-strong block">
                    {format(dt, "MMM d, yyyy")}
                  </span>
                  <span className="block text-[12px] text-neutral-400">
                    {format(dt, "EEE")}
                  </span>
                </div>
                <span className="inline-flex h-7 w-fit items-center justify-center rounded-md bg-neutral-100 px-2 text-[11px] font-semibold text-neutral-800">
                  {b.period}
                </span>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1 truncate text-[13px] text-neutral-950">
                    <span className="font-semibold">{cart?.name ?? "Cart"}</span>
                    {verifiedIds.has(b.teacherId) ? (
                      <VerifiedBadge size="xs" className="shrink-0" />
                    ) : null}
                    {classLabel ? (
                      <span className="text-neutral-500"> · {classLabel}</span>
                    ) : null}
                    {subjectLabel ? (
                      <span className="text-neutral-500"> · {subjectLabel}</span>
                    ) : null}
                  </p>
                  {b.notes ? (
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                      {b.notes}
                    </p>
                  ) : null}
                </div>
                {canCancel ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await cancelBooking(b.id)
                        if (res && "error" in res && res.error) {
                          toast({
                            title: "Could not cancel",
                            description: res.error,
                            variant: "destructive",
                          })
                          return
                        }
                        toast({ title: "Canceled" })
                        router.refresh()
                      })
                    }
                    className="h-8 shrink-0 rounded-lg bg-neutral-950 px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : (
                  <span className="hidden sm:block" aria-hidden />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
