"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePlatformStore } from "@/lib/data/platform-store"
import { isVerifiedStaff } from "@/lib/staff/employment"
import { VerifiedBadge } from "@/components/verified-badge"

function dayLabel(date: Date) {
  if (isToday(date)) return "Today"
  if (isTomorrow(date)) return "Tomorrow"
  return format(date, "EEE")
}

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
  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const platform = usePlatformStore()
  const verifiedIds = new Set(
    platform.users.filter((u) => isVerifiedStaff(u)).map((u) => u.id),
  )

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
      <header className="flex h-10 items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 sm:px-5">
        <h2 className="type-section-title text-neutral-950">{title}</h2>
        <span className="text-[12px] tabular-nums text-neutral-400">
          {bookings.length}
        </span>
      </header>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-[13px] text-neutral-400">{emptyLabel}</p>
          {emptyAction ? (
            <Link
              href={emptyAction.href}
              className="text-[12.5px] font-medium text-neutral-950 underline-offset-4 hover:underline"
            >
              {emptyAction.label}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--hairline)]">
          {bookings.map((b) => {
            const cart = cartMap.get(b.cartId)
            const dt = parseISO(b.date)
            const meta = [
              dayLabel(dt),
              b.period,
              b.className?.trim(),
              b.subject?.trim(),
            ]
              .filter(Boolean)
              .join(" · ")

            return (
              <li
                key={b.id}
                className={cn(
                  "grid grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5",
                )}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium tracking-[-0.01em] tabular-nums text-neutral-950">
                    {format(dt, "MMM d, yyyy")}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                      {cart?.name ?? "Cart"}
                    </span>
                    {verifiedIds.has(b.teacherId) ? (
                      <VerifiedBadge size="xs" className="shrink-0" />
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                    {meta}
                    {b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>

                {canCancel ? (
                  <div className="flex justify-start sm:justify-end">
                    <CancelAction
                      bookingId={b.id}
                      onDone={() => router.refresh()}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CancelAction({
  bookingId,
  onDone,
}: {
  bookingId: string
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await cancelBooking(bookingId)
          if (res && "error" in res && res.error) {
            toast({
              title: "Could not cancel",
              description: res.error,
              variant: "destructive",
            })
            return
          }
          toast({ title: "Canceled" })
          onDone()
        })
      }
      className={cn(
        "h-8 px-1 text-[12.5px] font-medium text-neutral-400 transition-colors",
        "hover:text-neutral-950",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {pending ? "Canceling…" : "Cancel"}
    </button>
  )
}
