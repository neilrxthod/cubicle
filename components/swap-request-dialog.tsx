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
import { cn } from "@/lib/utils"

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
  const [reason, setReason] = useState("")

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

  const dateLabel = format(parseISO(booking.date), "EEE, MMM d")
  const whenLabel = isExchange
    ? selectedOffer!.period === booking.period
      ? `${booking.period} · ${dateLabel}`
      : `${selectedOffer!.period} ⇄ ${booking.period} · ${dateLabel}`
    : `${booking.period} · ${dateLabel}`

  function submit() {
    setError(null)
    const formData = new FormData()
    formData.set("bookingId", booking.id)
    formData.set("offeredBookingId", offeredId)
    formData.set("reason", reason.trim())
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
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className={cn(
          "gap-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-0 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)]",
          "w-[calc(100%-1.5rem)] max-w-[40rem] sm:max-w-[44rem]",
        )}
      >
        {/* Compact header — single row on sm+ */}
        <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-black/[0.06] px-4 py-3.5 pr-12 sm:px-5">
          <div className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950">
              {isExchange ? "Request exchange" : "Request handoff"}
              <span className="ml-2 text-[13px] font-normal text-neutral-400">
                {whenLabel}
              </span>
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-snug text-neutral-500">
              {isExchange
                ? `Offer a cart to ${booking.teacherName}. Class details stay — only carts move.`
                : `Ask ${booking.teacherName} for this slot (one-way, no cart offered).`}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Horizontal body */}
        <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
          {/* You give */}
          <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5 sm:px-5 sm:py-4">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-neutral-400 uppercase">
              {isExchange ? "You give" : "You offer"}
            </p>
            <Select
              value={offeredId}
              onValueChange={setOfferedId}
              disabled={offerable.length === 0}
            >
              <SelectTrigger
                size="default"
                className={cn(
                  "h-10 w-full rounded-lg border-neutral-200 bg-neutral-50/80 px-3",
                  "text-[13px] font-medium text-neutral-900 shadow-none",
                  "hover:border-neutral-300 focus-visible:border-neutral-400",
                  "data-[size=default]:h-10",
                )}
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
                  const label = [c?.name ?? "Cart", b.period, classLabel]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      className="cursor-pointer rounded-md py-2 pl-3 pr-8 text-[13px] font-medium"
                    >
                      {label}
                    </SelectItem>
                  )
                })}
                <SelectItem
                  value={SWAP_OFFER_HANDOFF}
                  className="cursor-pointer rounded-md py-2 pl-3 pr-8 text-[13px]"
                >
                  Handoff only — no cart
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="truncate text-[11.5px] text-neutral-400">
              {isExchange
                ? [selectedOffer?.period, selectedOffer?.className?.trim()]
                    .filter(Boolean)
                    .join(" · ") || session?.name
                : "No cart offered"}
            </p>
          </div>

          {/* Arrow */}
          <div
            className="flex items-center justify-center border-black/[0.05] px-2 sm:border-x sm:px-3"
            aria-hidden
          >
            <span className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-[14px] text-neutral-600">
              {isExchange ? "⇄" : "→"}
            </span>
          </div>

          {/* You get */}
          <div className="flex min-w-0 flex-col gap-2 border-t border-black/[0.05] px-4 py-3.5 sm:border-t-0 sm:px-5 sm:py-4">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-emerald-700/70 uppercase">
              You get
            </p>
            <div className="flex h-10 items-center rounded-lg border border-emerald-200/70 bg-emerald-50/40 px-3">
              <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                {targetCart?.name ?? "Cart"}
                <span className="ml-1.5 font-normal text-neutral-500">
                  {booking.period}
                </span>
              </p>
            </div>
            <p className="truncate text-[11.5px] text-neutral-400">
              {[booking.className?.trim(), booking.teacherName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Reason + actions — single horizontal strip */}
        <div className="border-t border-black/[0.06] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <input
                id="reason"
                name="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value.slice(0, SWAP_REASON_MAX))
                  if (error) setError(null)
                }}
                placeholder={
                  isExchange
                    ? "Why you need their cart…"
                    : "Why you need this slot…"
                }
                required
                maxLength={SWAP_REASON_MAX}
                autoComplete="off"
                className={cn(
                  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3",
                  "text-[13px] tracking-[-0.01em] text-neutral-900 placeholder:text-neutral-400",
                  "outline-none transition focus:border-neutral-400",
                )}
              />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="h-10 rounded-lg px-3.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={submit}
                className="h-10 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-2 truncate text-[12px] font-medium text-red-600"
            >
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
