"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { requestSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Booking } from "@/lib/types"
import { format, parseISO } from "date-fns"
import { usePlatformStore } from "@/lib/data/platform-store"
import {
  SWAP_OFFER_HANDOFF,
  SWAP_REASON_MAX,
  defaultOfferedBookingId,
  listOfferableBookings,
} from "@/lib/booking/swap-rules"
import { getSession } from "@/lib/auth/session"
import { SwapCartRoute } from "@/components/swap-cart-route"

export function SwapRequestDialog({
  booking,
  onClose,
}: {
  booking: Booking
  onClose: () => void
}) {
  const router = useRouter()
  const platform = usePlatformStore()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const session = getSession()
  const targetCart = platform.carts.find((c) => c.id === booking.cartId)

  const offerable = useMemo(() => {
    if (!session?.id) return [] as Booking[]
    return listOfferableBookings(platform.bookings, session.id, booking)
  }, [session?.id, platform.bookings, booking])

  const cartById = useMemo(
    () => new Map(platform.carts.map((c) => [c.id, c])),
    [platform.carts],
  )

  const defaultOffer =
    offerable.length > 0
      ? (defaultOfferedBookingId(offerable, booking.period) ??
        offerable[0]!.id)
      : SWAP_OFFER_HANDOFF

  const [offeredId, setOfferedId] = useState(defaultOffer)

  // Keep selection valid if bookings change while the dialog is open.
  useEffect(() => {
    if (offerable.length === 0) {
      setOfferedId(SWAP_OFFER_HANDOFF)
      return
    }
    const stillValid =
      offeredId !== SWAP_OFFER_HANDOFF &&
      offerable.some((b) => b.id === offeredId)
    if (!stillValid) {
      setOfferedId(
        defaultOfferedBookingId(offerable, booking.period) ?? offerable[0]!.id,
      )
    }
  }, [offerable, offeredId, booking.period])

  const selectedOffer =
    offeredId === SWAP_OFFER_HANDOFF
      ? undefined
      : offerable.find((b) => b.id === offeredId)

  const isExchange = Boolean(selectedOffer)
  const offeredCart = selectedOffer
    ? cartById.get(selectedOffer.cartId)
    : undefined

  const whenLabel = isExchange
    ? selectedOffer!.period === booking.period
      ? `${booking.period} · ${format(parseISO(booking.date), "EEE, MMM d")}`
      : `${selectedOffer!.period} ⇄ ${booking.period} · ${format(parseISO(booking.date), "EEE, MMM d")}`
    : `${booking.period} · ${format(parseISO(booking.date), "EEE, MMM d")}`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-[28rem]">
        <DialogHeader className="space-y-1.5 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Cart transfer
          </p>
          <DialogTitle className="text-[17px] tracking-tight">
            {isExchange ? "Request cart exchange" : "Request cart handoff"}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-neutral-500">
            {isExchange ? (
              <>
                Select which of your carts to offer {booking.teacherName}. You
                both keep your class details — only cart assignments move.
              </>
            ) : (
              <>
                Ask {booking.teacherName} to give you this slot. No cart from
                you is offered, so this is a one-way handoff.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 border-b border-border/50 bg-[#f7f7f8] px-5 py-4 sm:px-6">
          {/* Corporate cart selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="offered-cart"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500"
            >
              Your cart to offer
            </label>
            <Select
              value={offeredId}
              onValueChange={setOfferedId}
              disabled={offerable.length === 0}
            >
              <SelectTrigger
                id="offered-cart"
                size="default"
                className="h-11 w-full rounded-lg border-neutral-200 bg-white px-3.5 text-[13.5px] font-medium text-neutral-900 shadow-none hover:border-neutral-300 focus-visible:border-neutral-400 data-[size=default]:h-11"
              >
                <SelectValue placeholder="Select a cart" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="z-[80] rounded-lg border-neutral-200 shadow-lg"
              >
                {offerable.map((b) => {
                  const c = cartById.get(b.cartId)
                  const classLabel = b.className?.trim()
                  const label = [
                    c?.name ?? "Cart",
                    b.period,
                    classLabel || undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      className="cursor-pointer rounded-md py-2.5 pl-3 pr-8 text-[13px] font-medium"
                    >
                      {label}
                    </SelectItem>
                  )
                })}
                <SelectItem
                  value={SWAP_OFFER_HANDOFF}
                  className="cursor-pointer rounded-md py-2.5 pl-3 pr-8 text-[13px]"
                >
                  Handoff only — no cart offered
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-snug text-neutral-400">
              {offerable.length > 1
                ? `${offerable.length} of your carts are booked this day — pick which one to exchange.`
                : offerable.length === 1
                  ? "You have one cart booked this day. Change to handoff if you prefer not to offer it."
                  : "You have no cart booked this day, so only a handoff is available."}
            </p>
          </div>

          <SwapCartRoute
            mode={isExchange ? "exchange" : "handoff"}
            meta={whenLabel}
            from={{
              eyebrow: isExchange ? "You give" : "You have",
              cartName: isExchange
                ? (offeredCart?.name ?? "Your cart")
                : "No cart",
              detail: isExchange
                ? [
                    selectedOffer?.period,
                    selectedOffer?.className?.trim() || session?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "This period",
            }}
            to={{
              eyebrow: isExchange ? "You get" : "You want",
              cartName: targetCart?.name ?? "Their cart",
              detail: [
                booking.period,
                booking.className?.trim() || booking.teacherName,
              ]
                .filter(Boolean)
                .join(" · "),
            }}
          />
        </div>

        <form
          className="flex flex-col gap-5 px-5 py-5 sm:px-6"
          action={(formData) => {
            setError(null)
            formData.set("bookingId", booking.id)
            formData.set("offeredBookingId", offeredId)
            startTransition(async () => {
              const res = await requestSwap(formData)
              if (res && "error" in res && res.error) {
                setError(res.error)
                return
              }
              toast({
                title: "Swap request sent",
                description: isExchange
                  ? `${offeredCart?.name ?? "Your cart"} ⇄ ${targetCart?.name ?? "their cart"}`
                  : `Handoff request → ${targetCart?.name ?? "their cart"}`,
              })
              router.refresh()
              onClose()
            })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reason"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500"
            >
              Business reason
            </label>
            <textarea
              id="reason"
              name="reason"
              placeholder={
                isExchange
                  ? "Why you need their cart"
                  : "Why you need this slot"
              }
              required
              maxLength={SWAP_REASON_MAX}
              rows={3}
              className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-[13.5px] tracking-[-0.011em] text-foreground placeholder:text-neutral-400 outline-none transition focus:border-neutral-400"
            />
            <p className="text-[11px] text-neutral-400">
              Same day · max {SWAP_REASON_MAX} characters
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-neutral-950 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
