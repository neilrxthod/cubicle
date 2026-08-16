"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart, SwapRequest } from "@/lib/types"
import { acceptSwap, declineSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { resolveOfferedBooking } from "@/lib/booking/swap-rules"
import { usePlatformStore } from "@/lib/data/platform-store"
import { useUserPresence } from "@/lib/staff/presence"
import { PresenceDot } from "@/components/presence-dot"
import { cn } from "@/lib/utils"
import {
  inviteAcceptClassName,
  inviteDeclineClassName,
} from "@/lib/ui/invite-actions"
import { InviteActionBusy } from "@/components/ui/invite-action-busy"

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
  userId,
}: {
  name: string
  src?: string | null
  userId?: string
}) {
  const presence = useUserPresence(userId)
  return (
    <span className="relative shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="size-10 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-[12px] font-medium text-neutral-600"
          aria-hidden
        >
          {initials(name)}
        </span>
      )}
      <PresenceDot status={presence} size="md" />
    </span>
  )
}

function formatWhen(booking: Booking, counterPeriod?: string) {
  let day: string
  try {
    day = format(parseISO(booking.date), "EEE, MMM d")
  } catch {
    day = booking.date
  }
  if (counterPeriod && counterPeriod !== booking.period) {
    return `${counterPeriod} ⇄ ${booking.period} · ${day}`
  }
  return `${booking.period} · ${day}`
}

/**
 * Dashboard swap invites — same action-first card pattern as share invites.
 */
export function SwapRequestsList({
  requests,
  bookings,
  carts,
  /** Incoming = owner accept/decline. Outgoing = requester cancel. */
  variant = "incoming",
}: {
  requests: SwapRequest[]
  bookings: Booking[]
  carts: Cart[]
  variant?: "incoming" | "outgoing"
}) {
  const router = useRouter()
  const platform = usePlatformStore()
  const [busy, setBusy] = useState<{
    id: string
    action: "accept" | "decline"
  } | null>(null)

  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const bookingMap = new Map(bookings.map((b) => [b.id, b]))
  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const u of platform.users) {
      if (u.avatarUrl) map.set(u.id, u.avatarUrl)
    }
    return map
  }, [platform.users])

  if (requests.length === 0) return null

  const isOutgoing = variant === "outgoing"

  async function run(
    id: string,
    kind: "accept" | "decline",
    action: () => Promise<{ ok: boolean; error?: string }>,
    okTitle: string,
  ) {
    setBusy({ id, action: kind })
    try {
      const res = await action()
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not update swap",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: okTitle })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const blocked = busy !== null

  return (
    <div className="flex flex-col gap-2.5">
      {requests.map((req) => {
        const booking = bookingMap.get(req.bookingId)
        const thisBusy = busy?.id === req.id
        const accepting = busy?.id === req.id && busy.action === "accept"
        const declining = busy?.id === req.id && busy.action === "decline"

        // Target slot gone — still allow cancel when you sent it
        if (!booking) {
          if (!isOutgoing) return null
          return (
            <article
              key={req.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
                "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-neutral-950">
                  <span className="font-semibold">Swap request</span>
                  <span className="font-normal text-neutral-500">
                    {" "}
                    — slot no longer available
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={blocked}
                onClick={() =>
                  void run(
                    req.id,
                    "decline",
                    () => declineSwap(req.id),
                    "Request cancelled",
                  )
                }
                className={inviteDeclineClassName(
                  cn(
                    "h-9 w-full min-w-[5.5rem] rounded-lg px-3 text-[12.5px] sm:w-auto",
                    declining && "disabled:opacity-100",
                  ),
                )}
              >
                {declining ? <InviteActionBusy /> : "Cancel"}
              </button>
            </article>
          )
        }

        const theirCart = cartMap.get(booking.cartId)
        const counterparty = resolveOfferedBooking(bookings, req, booking)
        const offeredCart = counterparty
          ? cartMap.get(counterparty.cartId)
          : undefined
        const isExchange = Boolean(counterparty)

        const peerName = isOutgoing
          ? booking.teacherName
          : req.requesterName
        const peerId = isOutgoing ? booking.teacherId : req.requesterId
        const peerAvatar = avatarByUserId.get(peerId)

        // Compact route line: Cart A → Cart B (or handoff)
        const fromCart = isOutgoing
          ? isExchange
            ? (offeredCart?.name ?? "Your cart")
            : "Handoff"
          : isExchange
            ? (offeredCart?.name ?? "Their cart")
            : "Handoff"
        const toCart = theirCart?.name ?? (isOutgoing ? "Their cart" : "Your cart")
        const when = formatWhen(booking, counterparty?.period)
        const routeLine = isExchange
          ? `${fromCart} ⇄ ${toCart} · ${when}`
          : `${toCart} · ${when}`

        const headline = isOutgoing ? (
          <>
            <span className="font-normal text-neutral-500">Waiting on </span>
            <span className="font-semibold">{peerName}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">{peerName}</span>
            <span className="font-normal text-neutral-500">
              {isExchange
                ? " wants to exchange carts"
                : " wants a handoff"}
            </span>
          </>
        )

        return (
          <article
            key={req.id}
            aria-busy={thisBusy}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
              "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              thisBusy && "pointer-events-none",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={peerName} src={peerAvatar} userId={peerId} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug tracking-[-0.01em] text-neutral-950">
                  {headline}
                </p>
                <p className="mt-0.5 truncate text-[12px] tabular-nums text-neutral-400">
                  {routeLine}
                </p>
                {req.reason ? (
                  <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                    {req.reason}
                  </p>
                ) : null}
              </div>
            </div>

            {isOutgoing ? (
              <button
                type="button"
                disabled={blocked}
                aria-busy={declining}
                onClick={() =>
                  void run(
                    req.id,
                    "decline",
                    () => declineSwap(req.id),
                    "Request cancelled",
                  )
                }
                className={inviteDeclineClassName(
                  cn(
                    "h-9 w-full min-w-[5.5rem] rounded-lg px-3 text-[12.5px] sm:w-auto sm:shrink-0",
                    declining && "disabled:opacity-100",
                  ),
                )}
              >
                {declining ? <InviteActionBusy /> : "Cancel"}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                <button
                  type="button"
                  disabled={blocked}
                  aria-busy={declining}
                  onClick={() =>
                    void run(
                      req.id,
                      "decline",
                      () => declineSwap(req.id),
                      "Swap declined",
                    )
                  }
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
                  onClick={() =>
                    void run(
                      req.id,
                      "accept",
                      () => acceptSwap(req.id),
                      isExchange ? "Carts exchanged" : "Slot handed off",
                    )
                  }
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
            )}
          </article>
        )
      })}
    </div>
  )
}
