"use client"

import type { ReactNode } from "react"
import { format, parseISO } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { bookingClassLabel } from "@/lib/booking/slot-rules"
import { usePlatformStore } from "@/lib/data/platform-store"
import { getBookingPurpose, type Booking, type Cart } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatStamp(iso: string | undefined) {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "MMM d, yyyy")
  } catch {
    return iso
  }
}

function formatDay(iso: string) {
  try {
    return format(parseISO(iso), "EEE, MMM d")
  } catch {
    return iso
  }
}

function formatBookedTime(iso: string | undefined) {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "h:mm a")
  } catch {
    return iso
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

function Face({
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
        className="size-7 rounded-full object-cover"
      />
    )
  }
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-medium tracking-[-0.02em] text-neutral-600">
      {initials(name)}
    </span>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 py-2">
      <p className="pt-0.5 text-[11px] font-medium tracking-[0.06em] text-neutral-400 uppercase">
        {label}
      </p>
      <div className="min-w-0 text-[13px] tracking-[-0.01em] text-neutral-950">
        {children}
      </div>
    </div>
  )
}

/**
 * Admin-only booking inspector. Read-only details, no cancel chrome.
 */
export function BookingInfoDialog({
  booking,
  cart,
  onClose,
}: {
  booking: Booking
  cart?: Cart
  onClose: () => void
}) {
  const platform = usePlatformStore()
  const teacher = platform.users.find((u) => u.id === booking.teacherId)
  const shareUser = booking.sharedWithId
    ? platform.users.find((u) => u.id === booking.sharedWithId)
    : undefined
  const pendingUser = booking.sharePendingId
    ? platform.users.find((u) => u.id === booking.sharePendingId)
    : undefined

  const purpose = getBookingPurpose(booking)
  const classLabel = bookingClassLabel(booking)
  const notes = booking.notes?.trim()
  const cartName = cart?.name ?? "Cart"
  const teacherName = teacher?.name || booking.teacherName
  const teacherSrc = teacher?.avatarUrl
  const shareName =
    shareUser?.name || booking.sharedWithName || undefined
  const shareSrc = shareUser?.avatarUrl || booking.sharedWithAvatarUrl
  const pendingName =
    pendingUser?.name || booking.sharePendingName || undefined

  const purposeIsClass = !purpose || purpose.id === "class"
  const showClass =
    purposeIsClass && classLabel && classLabel.toLowerCase() !== "class"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className="w-[min(100%,22.5rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-soft)] sm:max-w-[22.5rem]"
      >
        <DialogHeader className="space-y-0 border-b border-[var(--hairline)] px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950">
            Booking details
          </DialogTitle>
          <DialogDescription className="sr-only">
            {cartName}, {booking.period}, {formatDay(booking.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          <div className="divide-y divide-[var(--hairline)] px-5 py-1">
            <Row label="Cart">
              <p className="font-medium">{cartName}</p>
            </Row>
            <Row label="Date">
              <p>{formatDay(booking.date)}</p>
            </Row>
            <Row label="Period">
              <p className="tabular-nums font-medium">{booking.period}</p>
            </Row>
          </div>

          <div aria-hidden className="h-px bg-neutral-200" />

          <div className="divide-y divide-[var(--hairline)] px-5 py-1">
            <Row label="Teacher">
              <div className="flex min-w-0 items-center gap-2">
                <Face name={teacherName} src={teacherSrc} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{teacherName}</p>
                  {teacher?.email ? (
                    <p className="truncate text-[12px] text-neutral-400">
                      {teacher.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </Row>
            <Row label="Share">
              {shareName ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Face name={shareName} src={shareSrc} />
                  <p className="truncate">{shareName}</p>
                </div>
              ) : pendingName ? (
                <p className="text-sky-700">Invite pending · {pendingName}</p>
              ) : (
                <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-teal-800 transition-colors hover:bg-teal-100 hover:text-teal-900">
                  Just the teacher
                </span>
              )}
            </Row>
          </div>

          <div aria-hidden className="h-px bg-neutral-200" />

          <div className="divide-y divide-[var(--hairline)] px-5 py-1">
            <Row label="Purpose">
              {purpose ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em]",
                    purpose.capsuleClass,
                  )}
                >
                  {purpose.label}
                </span>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
              {showClass ? (
                <p className="mt-1 text-[12.5px] text-neutral-500">
                  {classLabel}
                </p>
              ) : null}
            </Row>
            {notes ? (
              <Row label="Note">
                <p className="whitespace-pre-wrap text-neutral-700">{notes}</p>
              </Row>
            ) : null}
          </div>

          <div aria-hidden className="h-px bg-neutral-200" />

          <div className="divide-y divide-[var(--hairline)] px-5 py-1">
            <Row label="Booked">
              <p className="tabular-nums text-neutral-600">
                {formatStamp(booking.createdAt)}
              </p>
            </Row>
            <Row label="Time">
              <p className="tabular-nums font-medium">
                {formatBookedTime(booking.createdAt)}
              </p>
            </Row>
            {booking.lastEditedAt &&
            booking.lastEditedAt !== booking.createdAt ? (
              <Row label="Edited">
                <p className="tabular-nums text-neutral-600">
                  {booking.lastEditedByName
                    ? `${booking.lastEditedByName} · `
                    : null}
                  {formatStamp(booking.lastEditedAt)}
                </p>
              </Row>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
