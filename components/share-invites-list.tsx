"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { bookingHasShareInviteFor } from "@/lib/types"
import {
  acceptShareInvite,
  declineShareInvite,
  dismissShareDeclineNotice,
} from "@/lib/actions"
import { usePlatformStore } from "@/lib/data/platform-store"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  holdInviteBusy,
  inviteAcceptClassName,
  inviteDeclineClassName,
} from "@/lib/ui/invite-actions"
import { InviteActionBusy } from "@/components/ui/invite-action-busy"
import { BookingLimitDialog } from "@/components/booking-limit-dialog"
import {
  slotLimitNoticeFromError,
  type SlotLimitNotice,
} from "@/lib/booking/slot-rules"

type InviteBusyAction = "accept" | "decline" | "cancel" | "dismiss"

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
  const [busy, setBusy] = useState<{
    id: string
    action: InviteBusyAction
  } | null>(null)
  const [slotLimit, setSlotLimit] = useState<SlotLimitNotice | null>(null)

  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const u of platform.users) {
      if (u.avatarUrl) map.set(u.id, u.avatarUrl)
    }
    return map
  }, [platform.users])

  const incoming = bookings.filter(
    (b) =>
      bookingHasShareInviteFor(b, userId) ||
      (busy?.id === b.id &&
        (busy.action === "accept" || busy.action === "decline")),
  )
  const outgoing = bookings.filter(
    (b) => b.teacherId === userId && Boolean(b.sharePendingId),
  )
  const declined = bookings.filter(
    (b) =>
      b.teacherId === userId &&
      Boolean(b.shareDeclinedById) &&
      !b.sharePendingId,
  )

  if (
    incoming.length === 0 &&
    outgoing.length === 0 &&
    declined.length === 0
  ) {
    return null
  }

  async function run(bookingId: string, action: InviteBusyAction) {
    setBusy({ id: bookingId, action })
    const startedAt = Date.now()
    try {
      const res =
        action === "accept"
          ? await acceptShareInvite(bookingId)
          : action === "dismiss"
            ? await dismissShareDeclineNotice(bookingId)
            : await declineShareInvite(bookingId)
      if (res && "error" in res && res.error) {
        const limit = slotLimitNoticeFromError(res.error)
        if (limit) {
          setSlotLimit(limit)
          return
        }
        toast({
          title:
            action === "accept"
              ? "Could not accept"
              : action === "cancel"
                ? "Could not cancel"
                : action === "dismiss"
                  ? "Could not dismiss"
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
              : action === "dismiss"
                ? "Dismissed"
                : "Invite declined",
      })
      router.refresh()
    } finally {
      await holdInviteBusy(startedAt)
      setBusy(null)
    }
  }

  const blocked = busy !== null

  return (
    <div className="flex flex-col gap-2.5">
      {/* Incoming — needs action */}
      {incoming.map((booking) => {
        const cartName = cartMap.get(booking.cartId)?.name ?? "Cart"
        const name = booking.teacherName
        const avatarSrc =
          avatarByUserId.get(booking.teacherId) ??
          booking.lastEditedByAvatarUrl
        const thisBusy = busy?.id === booking.id
        const accepting = busy?.id === booking.id && busy.action === "accept"
        const declining = busy?.id === booking.id && busy.action === "decline"

        return (
          <article
            key={booking.id}
            aria-busy={thisBusy}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              thisBusy && "pointer-events-none",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3",
                thisBusy && "opacity-55",
              )}
            >
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
                aria-busy={declining}
                onClick={() => void run(booking.id, "decline")}
                className={inviteDeclineClassName(
                  cn(
                    "h-9 min-w-[5.5rem] rounded-lg px-3 text-[12.5px]",
                    declining
                      ? "disabled:opacity-100"
                      : thisBusy
                        ? "opacity-40 disabled:opacity-40"
                        : null,
                  ),
                )}
              >
                {declining ? <InviteActionBusy /> : "Decline"}
              </button>
              <button
                type="button"
                disabled={blocked}
                aria-busy={accepting}
                onClick={() => void run(booking.id, "accept")}
                className={inviteAcceptClassName(
                  cn(
                    "h-9 min-w-[5.5rem] rounded-lg px-3 text-[12.5px]",
                    accepting
                      ? "disabled:opacity-100"
                      : thisBusy
                        ? "opacity-40 disabled:opacity-40"
                        : null,
                  ),
                )}
              >
                {accepting ? (
                  <InviteActionBusy spinnerClassName="text-white" />
                ) : (
                  "Accept"
                )}
              </button>
            </div>
          </article>
        )
      })}

      {/* Declined — owner notified */}
      {declined.map((booking) => {
        const cartName = cartMap.get(booking.cartId)?.name ?? "Cart"
        const name =
          booking.shareDeclinedByName?.trim() || "Someone"
        const avatarSrc =
          (booking.shareDeclinedById
            ? avatarByUserId.get(booking.shareDeclinedById)
            : undefined) ?? booking.shareDeclinedByAvatarUrl
        const dismissing = busy?.id === booking.id && busy.action === "dismiss"

        return (
          <article
            key={`declined-${booking.id}`}
            aria-busy={dismissing}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              dismissing && "pointer-events-none",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={name} src={avatarSrc} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug tracking-[-0.01em] text-neutral-950">
                  <span className="font-semibold">{name}</span>
                  <span className="font-normal text-neutral-500">
                    {" "}
                    declined your cart share
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[12px] tabular-nums text-neutral-400">
                  {slotMeta(booking, cartName)}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={blocked}
              aria-busy={dismissing}
              onClick={() => void run(booking.id, "dismiss")}
              className={cn(
                "h-9 w-full min-w-[6.25rem] shrink-0 rounded-lg border border-neutral-200 bg-white px-3 sm:w-auto",
                "text-[12.5px] font-medium text-neutral-600",
                "transition-colors hover:bg-neutral-50 hover:text-neutral-950",
                dismissing ? "disabled:opacity-100" : "disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/15",
              )}
            >
              {dismissing ? <InviteActionBusy /> : "Dismiss"}
            </button>
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
        const cancelling = busy?.id === booking.id && busy.action === "cancel"

        return (
          <article
            key={booking.id}
            aria-busy={cancelling}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              cancelling && "pointer-events-none",
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
              aria-busy={cancelling}
              onClick={() => void run(booking.id, "cancel")}
              className={cn(
                "h-9 w-full min-w-[6.25rem] shrink-0 rounded-lg border border-neutral-200 bg-white px-3 sm:w-auto",
                "text-[12.5px] font-medium text-neutral-600",
                "transition-colors hover:bg-neutral-50 hover:text-neutral-950",
                cancelling ? "disabled:opacity-100" : "disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/15",
              )}
            >
              {cancelling ? <InviteActionBusy /> : "Cancel"}
            </button>
          </article>
        )
      })}
      <BookingLimitDialog
        notice={slotLimit}
        onClose={() => setSlotLimit(null)}
      />
    </div>
  )
}
