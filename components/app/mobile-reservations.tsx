"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cancelBooking } from "@/lib/actions";
import { bookingClassLabel } from "@/lib/booking/slot-rules";
import {
  getPeriodSchedule,
  getSchoolDate,
} from "@/lib/calendar/period-schedule";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import {
  bookingInvolvesUser,
  type Booking,
  type Cart,
  type SessionUser,
  type User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "mine" | "school";
type Segment = "today" | "upcoming" | "past";

type DayGroup = {
  key: string;
  label: string;
  items: Booking[];
};

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "?");
  return letters.toUpperCase();
}

function dayHeading(dateKey: string) {
  const date = parseISO(dateKey);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

function periodClock(period: Booking["period"]) {
  const schedule = getPeriodSchedule(period);
  return `${schedule.start}–${schedule.end}`;
}

function matchesQuery(booking: Booking, cart: Cart | undefined, query: string) {
  if (!query) return true;
  const hay = [
    cart?.name,
    cart?.location,
    booking.period,
    booking.teacherName,
    booking.className,
    booking.subject,
    booking.sharedWithName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export function MobileReservations({
  user,
  onBack,
  scope,
}: {
  user: SessionUser;
  onBack: () => void;
  scope: Scope;
}) {
  const { bookings, carts, users } = usePlatformStore();
  const today = getSchoolDate();
  const [segment, setSegment] = useState<Segment>("upcoming");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cartById = useMemo(
    () => new Map(carts.map((cart) => [cart.id, cart])),
    [carts],
  );
  const userById = useMemo(
    () => new Map(users.map((entry) => [entry.id, entry])),
    [users],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((booking) =>
        scope === "mine" ? bookingInvolvesUser(booking, user.id) : true,
      )
      .filter((booking) => {
        if (segment === "today") return booking.date === today;
        if (segment === "upcoming") return booking.date >= today;
        return booking.date < today;
      })
      .filter((booking) =>
        matchesQuery(booking, cartById.get(booking.cartId), q),
      )
      .sort((a, b) =>
        segment === "past"
          ? b.date.localeCompare(a.date) || b.period.localeCompare(a.period)
          : a.date.localeCompare(b.date) || a.period.localeCompare(b.period),
      );
  }, [bookings, scope, user.id, segment, today, query, cartById]);

  const groups = useMemo(() => {
    const next: DayGroup[] = [];
    const byDay = new Map<string, Booking[]>();
    for (const booking of visible) {
      const list = byDay.get(booking.date) ?? [];
      list.push(booking);
      byDay.set(booking.date, list);
    }
    for (const [key, items] of byDay) {
      next.push({ key, label: dayHeading(key), items });
    }
    return next;
  }, [visible]);

  const selected = selectedId
    ? (bookings.find((booking) => booking.id === selectedId) ?? null)
    : null;

  const title = scope === "school" ? "Reservations" : "Bookings";
  const empty =
    segment === "today"
      ? "Nothing today"
      : segment === "upcoming"
        ? "No upcoming reservations"
        : "No past reservations";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title={title} onBack={onBack} />

      <div className="shrink-0 px-5 pb-2 pt-1">
        <div
          role="tablist"
          aria-label="Reservation range"
          className="grid grid-cols-3 rounded-[9px] bg-black/[0.06] p-0.5"
        >
          {(
            [
              { id: "today", label: "Today" },
              { id: "upcoming", label: "Upcoming" },
              { id: "past", label: "Past" },
            ] as const
          ).map((item) => {
            const active = segment === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(item.id)}
                className={cn(
                  "h-[30px] rounded-[7px] text-[13px] font-medium tracking-[-0.01em]",
                  active
                    ? "bg-white text-neutral-950 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                    : "text-neutral-500",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex h-9 items-center gap-2 rounded-[10px] bg-black/[0.06] px-2.5">
          <Search className="size-4 text-neutral-400" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {empty}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-neutral-400">
              {scope === "school"
                ? "Reservations for the school will show up here."
                : "Your cart reservations will show up here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
                  {group.label}
                </h2>
                <ul className="overflow-hidden rounded-[12px] bg-white">
                  {group.items.map((booking, index) => (
                    <ReservationRow
                      key={booking.id}
                      booking={booking}
                      cart={cartById.get(booking.cartId)}
                      teacher={userById.get(booking.teacherId)}
                      showTeacher={scope === "school"}
                      first={index === 0}
                      onOpen={() => setSelectedId(booking.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      {selected ? (
        <ReservationSheet
          booking={selected}
          cart={cartById.get(selected.cartId)}
          teacher={userById.get(selected.teacherId)}
          viewerId={user.id}
          canCancel={
            user.role === "admin" || selected.teacherId === user.id
          }
          adminCancel={
            user.role === "admin" && selected.teacherId !== user.id
          }
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function ReservationRow({
  booking,
  cart,
  teacher,
  showTeacher,
  first,
  onOpen,
}: {
  booking: Booking;
  cart?: Cart;
  teacher?: User;
  showTeacher: boolean;
  first: boolean;
  onOpen: () => void;
}) {
  const paused = cart?.status === "maintenance";
  const subject = bookingClassLabel(booking);

  return (
    <li className={first ? undefined : "border-t border-neutral-100"}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 px-3 py-3 text-left active:bg-neutral-50"
      >
        <span
          aria-hidden
          className={cn(
            "my-0.5 w-[3px] shrink-0 rounded-full",
            paused ? "bg-orange-500" : "bg-[#007aff]",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">
              {cart?.name ?? "Cart"}
            </span>
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-neutral-400">
              {booking.period}
            </span>
          </span>
          <span className="mt-0.5 block text-[13px] tabular-nums text-neutral-500">
            {periodClock(booking.period)}
            {cart?.location ? ` · ${cart.location}` : ""}
          </span>
          {showTeacher || subject ? (
            <span className="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-400">
              {showTeacher ? (
                <>
                  <Avatar className="size-4">
                    {teacher?.avatarUrl ? (
                      <AvatarImage
                        src={teacher.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <AvatarFallback className="bg-neutral-200 text-[8px] font-medium text-neutral-600">
                      {initials(booking.teacherName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{booking.teacherName}</span>
                </>
              ) : null}
              {showTeacher && subject ? (
                <span className="text-neutral-200">·</span>
              ) : null}
              {subject ? <span className="truncate">{subject}</span> : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function ReservationSheet({
  booking,
  cart,
  teacher,
  viewerId,
  canCancel,
  adminCancel,
  onClose,
}: {
  booking: Booking;
  cart?: Cart;
  teacher?: User;
  viewerId: string;
  canCancel: boolean;
  adminCancel: boolean;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const subject = bookingClassLabel(booking);
  const shared =
    booking.sharedWithId === viewerId
      ? `With ${booking.teacherName}`
      : booking.sharedWithName
        ? `Shared with ${booking.sharedWithName}`
        : null;
  const paused = cart?.status === "maintenance";

  function handleCancel() {
    startTransition(async () => {
      const started = Date.now();
      const res = await cancelBooking(
        booking.id,
        adminCancel ? { reason: "admin" } : undefined,
      );
      const remain = 1500 - (Date.now() - started);
      if (remain > 0) {
        await new Promise((resolve) => setTimeout(resolve, remain));
      }
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not cancel",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Reservation canceled" });
      onClose();
    });
  }

  return (
    <div className="absolute inset-0 z-30">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="overflow-hidden rounded-[14px] bg-[#f2f2f7] shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <div className="px-5 pb-2 pt-3">
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              {paused ? "Paused cart" : "Reservation"}
            </p>
            <h2 className="mt-0.5 text-[28px] font-semibold leading-tight tracking-[-0.04em] text-neutral-950">
              {cart?.name ?? "Cart"}
            </h2>
            <p className="mt-1 text-[15px] text-neutral-500">
              {getPeriodSchedule(booking.period).label} ·{" "}
              {periodClock(booking.period)}
            </p>
          </div>

          <dl className="mx-3 mb-3 overflow-hidden rounded-[12px] bg-white">
            <MetaRow label="Date" value={format(parseISO(booking.date), "EEEE, MMM d")} />
            <MetaRow
              label="Teacher"
              value={booking.teacherName}
              leading={
                <Avatar className="size-6">
                  {teacher?.avatarUrl ? (
                    <AvatarImage
                      src={teacher.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-neutral-200 text-[9px] font-medium text-neutral-600">
                    {initials(booking.teacherName)}
                  </AvatarFallback>
                </Avatar>
              }
            />
            {subject ? <MetaRow label="Class" value={subject} /> : null}
            {cart?.location ? (
              <MetaRow label="Location" value={cart.location} />
            ) : null}
            {shared ? <MetaRow label="Share" value={shared} /> : null}
          </dl>

          <div className="flex flex-col gap-2 px-3 pb-3">
            {canCancel ? (
              confirming ? (
                <div className="grid grid-cols-2 overflow-hidden rounded-[12px] bg-white">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                    className="h-12 text-[17px] text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleCancel}
                    className="h-12 border-l border-neutral-100 text-[17px] font-semibold text-red-600 active:bg-red-50 disabled:opacity-40"
                  >
                    {pending ? (
                      <Spinner className="mx-auto size-3.5 text-red-600" />
                    ) : (
                      "Cancel"
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(true)}
                  className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-red-600 active:bg-red-50 disabled:opacity-40"
                >
                  Cancel Reservation
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-semibold text-[#007aff] active:bg-neutral-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  leading,
}: {
  label: string;
  value: string;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-neutral-100 px-4 py-2.5 first:border-t-0">
      <dt className="shrink-0 text-[15px] text-neutral-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right text-[15px] tracking-[-0.01em] text-neutral-950">
        {leading}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
