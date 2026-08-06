"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { bookingHasShareInviteFor } from "@/lib/types"
import { acceptShareInvite, declineShareInvite } from "@/lib/actions"
import { usePlatformStore } from "@/lib/data/platform-store"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

function Avatar({
  name,
  src,
}: {
  name: string
  src?: string | null
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        draggable={false}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[12px] font-medium text-neutral-600"
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

function slotMeta(booking: Booking, cartName: string) {
  let when: string
  try {
    when = `${booking.period} · ${format(parseISO(booking.date), "EEE, MMM d")}`
  } catch {
    when = `${booking.period} · ${booking.date}`
  }
  return `${cartName} · ${when}`
}

/**
 * Dashboard share invites — corporate, action-first rows.
 */
export function ShareInvitesList({
  bookings,
  carts,
  userId,
}: {
  bookings: Booking[]
  carts: Cart[]
  userId: string
}) {
  const router = useRouter()
  const platform = usePlatformStore()
  const [busyId, setBusyId] = useState<string | null>(null)

  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const u of platform.users) {
      if (u.avatarUrl) map.set(u.id, u.avatarUrl)
    }
    return map
  }, [platform.users])

  const incoming = bookings.filter((b) => bookingHasShareInviteFor(b, userId))
  const outgoing = bookings.filter(
    (b) => b.teacherId === userId && Boolean(b.sharePendingId),
  )

  if (incoming.length === 0 && outgoing.length === 0) return null

  async function run(
    bookingId: string,
    action: "accept" | "decline" | "cancel",
  ) {
    setBusyId(bookingId)
    try {
      const res =
        action === "accept"
          ? await acceptShareInvite(bookingId)
          : await declineShareInvite(bookingId)
      if (res && "error" in res && res.error) {
        toast({
          title:
            action === "accept"
              ? "Could not accept"
              : action === "cancel"
                ? "Could not cancel"
                : "Could not decline",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title:
          action === "accept"
            ? "Share accepted"
            : action === "cancel"
              ? "Invite cancelled"
              : "Invite declined",
      })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const blocked = busyId !== null

  return (
    <div className="flex flex-col gap-2.5">
      {/* Incoming — needs action */}
      {incoming.map((booking) => {
        const cartName = cartMap.get(booking.cartId)?.name ?? "Cart"
        const name = booking.teacherName
        const avatarSrc =
          avatarByUserId.get(booking.teacherId) ??
          booking.lastEditedByAvatarUrl
        const busy = busyId === booking.id

        return (
          <article
            key={booking.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-red-200/90 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              "border-l-[3px] border-l-red-500",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={name} src={avatarSrc} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug tracking-[-0.01em] text-neutral-950">
                  <span className="font-semibold">{name}</span>
                  <span className="font-normal text-neutral-500">
                    {" "}
                    wants to share a cart with you
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[12px] tabular-nums text-neutral-400">
                  {slotMeta(booking, cartName)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <button
                type="button"
                disabled={blocked}
                onClick={() => void run(booking.id, "decline")}
                className={cn(
                  "h-9 rounded-lg border border-neutral-200 bg-white px-3",
                  "text-[12.5px] font-medium text-neutral-600",
                  "transition-colors hover:bg-neutral-50 hover:text-neutral-950",
                  "disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/15",
                )}
              >
                {busy ? "…" : "Decline"}
              </button>
              <button
                type="button"
                disabled={blocked}
                onClick={() => void run(booking.id, "accept")}
                className={cn(
                  "h-9 rounded-lg bg-red-600 px-3",
                  "text-[12.5px] font-medium text-white",
                  "transition-colors hover:bg-red-700",
                  "disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600/30",
                )}
              >
                {busy ? "…" : "Accept"}
              </button>
            </div>
          </article>
        )
      })}

      {/* Outgoing — waiting */}
      {outgoing.map((booking) => {
        const cartName = cartMap.get(booking.cartId)?.name ?? "Cart"
        const invitee = booking.sharePendingName?.trim() || "Colleague"
        const inviteeAvatar =
          (booking.sharePendingId
            ? avatarByUserId.get(booking.sharePendingId)
            : undefined) ?? booking.sharePendingAvatarUrl
        const busy = busyId === booking.id

        return (
          <article
            key={booking.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={invitee} src={inviteeAvatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug tracking-[-0.01em] text-neutral-950">
                  <span className="font-normal text-neutral-500">
                    Waiting on{" "}
                  </span>
                  <span className="font-semibold">{invitee}</span>
                </p>
                <p className="mt-0.5 truncate text-[12px] tabular-nums text-neutral-400">
                  {slotMeta(booking, cartName)}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={blocked}
              onClick={() => void run(booking.id, "cancel")}
              className={cn(
                "h-9 w-full shrink-0 rounded-lg border border-neutral-200 bg-white px-3 sm:w-auto",
                "text-[12.5px] font-medium text-neutral-600",
                "transition-colors hover:bg-neutral-50 hover:text-neutral-950",
                "disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/15",
              )}
            >
              {busy ? "…" : "Cancel"}
            </button>
          </article>
        )
      })}
    </div>
  )
}
