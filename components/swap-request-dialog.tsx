"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogCancel,
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
  isHandoffOfferId,
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

  const canExchange = offerable.length > 0
  const defaultOfferId = canExchange
    ? (defaultOfferedBookingId(offerable, booking.period) ?? offerable[0]!.id)
    : SWAP_OFFER_HANDOFF

  /** Mode first — handoff is a first-class choice, not buried in the cart list. */
  const [mode, setMode] = useState<"exchange" | "handoff">(
    canExchange ? "exchange" : "handoff",
  )
  const [exchangeBookingId, setExchangeBookingId] = useState(defaultOfferId)

  const selectedOffer =
    mode === "exchange"
      ? offerable.find((b) => b.id === exchangeBookingId) ??
        offerable.find((b) => b.id === defaultOfferId) ??
        offerable[0]
      : undefined

  const isHandoff = mode === "handoff" || !canExchange
  const isExchange = !isHandoff && Boolean(selectedOffer)
  const offeredCart = selectedOffer
    ? cartById.get(selectedOffer.cartId)
    : undefined

  const dateLabel = format(parseISO(booking.date), "EEE, MMM d")
  const whenLabel =
    isExchange && selectedOffer && selectedOffer.period !== booking.period
      ? `${selectedOffer.period} → ${booking.period} · ${dateLabel}`
      : `${booking.period} · ${dateLabel}`

  function submit() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Add a short reason.")
      return
    }
    setError(null)

    const offered =
      isHandoff || !selectedOffer
        ? SWAP_OFFER_HANDOFF
        : selectedOffer.id

    const formData = new FormData()
    formData.set("bookingId", booking.id)
    formData.set("offeredBookingId", offered)
    formData.set("reason", trimmed)

    startTransition(async () => {
      const res = await requestSwap(formData)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast({
        title: isExchange ? "Exchange requested" : "Handoff requested",
        description: isExchange
          ? `${offeredCart?.name ?? "Your cart"} → ${targetCart?.name ?? "their cart"}`
          : `${targetCart?.name ?? "Cart"} · ${booking.period}`,
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
          "gap-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-0",
          "shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)]",
          "w-[calc(100%-1.5rem)] max-w-[36rem] sm:max-w-[40rem]",
        )}
      >
        <DialogHeader className="space-y-0 border-b border-black/[0.06] px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="text-[14.5px] font-medium tracking-[-0.02em] text-neutral-950">
            {isHandoff ? "Handoff" : "Exchange"}
            <span className="ml-2 text-[12.5px] font-normal text-neutral-400">
              {whenLabel}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isHandoff
              ? `Request handoff from ${booking.teacherName}`
              : `Exchange carts with ${booking.teacherName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-4 py-3.5 sm:px-5">
          {/* Mode toggle — handoff always visible */}
          <div
            className="inline-flex rounded-lg bg-neutral-100 p-0.5"
            role="tablist"
            aria-label="Request type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isHandoff}
              disabled={!canExchange || pending}
              onClick={() => {
                setMode("exchange")
                setError(null)
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                !isHandoff
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800",
                (!canExchange || pending) && "opacity-40",
              )}
            >
              Exchange
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isHandoff}
              disabled={pending}
              onClick={() => {
                setMode("handoff")
                setError(null)
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                isHandoff
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800",
                pending && "opacity-40",
              )}
            >
              Handoff
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[10px] font-semibold tracking-[0.1em] text-neutral-400 uppercase">
                You give
              </p>
              {isHandoff ? (
                <div className="flex h-9 items-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 text-[13px] text-neutral-500">
                  No cart (handoff)
                </div>
              ) : (
                <Select
                  value={selectedOffer?.id ?? defaultOfferId}
                  onValueChange={(value) => {
                    if (isHandoffOfferId(value)) {
                      setMode("handoff")
                      return
                    }
                    setExchangeBookingId(value)
                    setMode("exchange")
                    setError(null)
                  }}
                  disabled={pending || !canExchange}
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      "h-9 w-full rounded-lg border-neutral-200 bg-white px-3",
                      "text-[13px] font-medium text-neutral-900 shadow-none",
                      "data-[size=default]:h-9",
                    )}
                  >
                    <SelectValue placeholder="Your cart" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[80] rounded-lg border-neutral-200 shadow-lg"
                  >
                    {offerable.map((b) => {
                      const c = cartById.get(b.cartId)
                      return (
                        <SelectItem
                          key={b.id}
                          value={b.id}
                          className="cursor-pointer rounded-md py-2 pl-3 pr-8 text-[13px] font-medium"
                        >
                          {[c?.name ?? "Cart", b.period]
                            .filter(Boolean)
                            .join(" · ")}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div
              className="flex items-center justify-center px-1 sm:pb-1"
              aria-hidden
            >
              <span className="flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-[13px] text-neutral-600">
                {isHandoff ? "→" : "⇄"}
              </span>
            </div>

            <div className="min-w-0 space-y-1.5">
              <p className="text-[10px] font-semibold tracking-[0.1em] text-emerald-700/70 uppercase">
                You get
              </p>
              <div className="flex h-9 items-center rounded-lg border border-emerald-200/70 bg-emerald-50/40 px-3">
                <p className="truncate text-[13px] font-medium text-neutral-950">
                  {targetCart?.name ?? "Cart"}
                  <span className="ml-1.5 font-normal text-neutral-500">
                    {booking.period}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-black/[0.06] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value.slice(0, SWAP_REASON_MAX))
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!pending && reason.trim()) submit()
                }
              }}
              placeholder="Reason…"
              maxLength={SWAP_REASON_MAX}
              autoComplete="off"
              className={cn(
                "h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3",
                "text-[13px] text-neutral-900 placeholder:text-neutral-400",
                "outline-none transition focus:border-neutral-400",
              )}
            />
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <DialogCancel onClick={onClose} disabled={pending}>
                Cancel
              </DialogCancel>
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={submit}
                className="h-9 rounded-lg bg-neutral-950 px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-2 text-[12px] font-medium leading-snug text-red-600"
            >
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
