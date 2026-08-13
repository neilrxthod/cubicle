"use client";

import { useMemo, useTransition } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { cancelBooking } from "@/lib/actions";
import { getSchoolDate } from "@/lib/calendar/period-schedule";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
import { bookingInvolvesUser, type Booking, type SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export function TeacherMobileBookings({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const { bookings, carts } = usePlatformStore();
  const today = getSchoolDate();

  const { upcoming, past } = useMemo(() => {
    const mine = bookings
      .filter((booking) => bookingInvolvesUser(booking, user.id))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.period.localeCompare(b.period),
      );
    return {
      upcoming: mine.filter((booking) => booking.date >= today),
      past: mine.filter((booking) => booking.date < today),
    };
  }, [bookings, user.id, today]);

  const cartName = (cartId: string) =>
    carts.find((cart) => cart.id === cartId)?.name ?? "Cart";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title="Bookings" onBack={onBack} />
      <main className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pb-8 pt-4">
        <BookingGroup
          title="Upcoming"
          bookings={upcoming}
          empty="No upcoming bookings"
          cartName={cartName}
          viewerId={user.id}
        />
        <BookingGroup
          title="Past"
          bookings={past}
          empty="No past bookings"
          cartName={cartName}
          viewerId={user.id}
        />
      </main>
    </div>
  );
}

function BookingGroup({
  title,
  bookings,
  empty,
  cartName,
  viewerId,
}: {
  title: string;
  bookings: Booking[];
  empty: string;
  cartName: (id: string) => string;
  viewerId: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        {title}
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-[12px] bg-white px-4 py-8 text-center text-[15px] text-neutral-400">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[12px] bg-white">
          {bookings.map((booking, index) => {
            const dt = parseISO(booking.date);
            const shared =
              booking.sharedWithId === viewerId
                ? `With ${booking.teacherName}`
                : booking.sharedWithName
                  ? `Shared with ${booking.sharedWithName}`
                  : null;
            const canCancel = booking.teacherId === viewerId;
            return (
              <li
                key={booking.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5",
                  index > 0 && "border-t border-neutral-100",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] tracking-[-0.02em] text-neutral-950">
                    {cartName(booking.cartId)}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-400">
                    {[
                      dayLabel(dt),
                      booking.period,
                      booking.className?.trim() || booking.subject?.trim(),
                      shared,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canCancel ? <CancelBooking id={booking.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CancelBooking({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await cancelBooking(id);
          if (res && "error" in res && res.error) {
            toast({
              title: "Could not cancel",
              description: res.error,
              variant: "destructive",
            });
            return;
          }
          toast({ title: "Booking canceled" });
        })
      }
      className="shrink-0 text-[15px] font-medium text-red-600 disabled:opacity-40"
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
