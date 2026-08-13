"use client";

import { Suspense, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { LocalPerspectiveSwitch } from "@/components/app/local-perspective-switch";
import { TeacherMobileBookings } from "@/components/app/teacher-mobile-bookings";
import { TeacherMobileIssues } from "@/components/app/teacher-mobile-issues";
import { TeacherMobileSchedule } from "@/components/app/teacher-mobile-schedule";
import { TeacherMobileSettings } from "@/components/app/teacher-mobile-settings";
import { TeacherMobileShares } from "@/components/app/teacher-mobile-shares";
import { TeacherMobileSwaps } from "@/components/app/teacher-mobile-swaps";
import { TeacherMobileTabBar } from "@/components/app/teacher-mobile-tab-bar";
import { CartBrandMark } from "@/components/admin/laptop-brand-toggle";
import { CubicleWordmark } from "@/components/auth/wordmark";

import { BookDialog } from "@/components/book-dialog";
import { IssueDialog } from "@/components/issue-dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useQrCamera } from "@/hooks/use-qr-camera";
import { signOutAction } from "@/lib/actions";
import {
  getCurrentPeriod,
  getNextPeriod,
  getPeriodSchedule,
  getSchoolDate,
  SCHOOL_TIMEZONE,
} from "@/lib/calendar/period-schedule";
import { isLocalDevRuntime } from "@/lib/data/durability";
import { usePlatformStore } from "@/lib/data/platform-store";
import {
  cartQrPayload,
  laptopQrPayload,
  parseCubicleQrPayload,
} from "@/lib/labels/codes";
import {
  bookingHasShareInviteFor,
  bookingInvolvesUser,
  laptopBrandLabel,
  sortCarts,
  type Booking,
  type Cart,
  type Period,
  type SessionUser,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ScanHit =
  | { kind: "cart"; cart: Cart }
  | { kind: "laptop"; cart: Cart; code: string }
  | { kind: "missing"; title: string };

type SimTarget = {
  key: string;
  label: string;
  detail: string;
  payload: string;
};

function resolveHit(raw: string, carts: Cart[]): ScanHit | "foreign" {
  const target = parseCubicleQrPayload(raw);
  if (!target) return "foreign";
  if (target.type === "cart") {
    const cart = carts.find((entry) => entry.id === target.cartId);
    return cart ? { kind: "cart", cart } : { kind: "missing", title: "Unknown cart" };
  }
  const cart = carts.find((entry) =>
    (entry.laptopCodes ?? []).includes(target.code),
  );
  return cart
    ? { kind: "laptop", cart, code: target.code }
    : { kind: "missing", title: target.code };
}

function Corner({
  pos,
  locked,
  className,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  locked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute size-11",
        pos[0] === "t" ? "top-0" : "bottom-0",
        pos[1] === "l" ? "left-0" : "right-0",
        pos === "tl" && "rounded-tl-[22px]",
        pos === "tr" && "rounded-tr-[22px]",
        pos === "bl" && "rounded-bl-[22px]",
        pos === "br" && "rounded-br-[22px]",
        pos[0] === "t" ? "border-t-[3px]" : "border-b-[3px]",
        pos[1] === "l" ? "border-l-[3px]" : "border-r-[3px]",
        locked ? "border-white" : "border-white/90",
        className,
      )}
    />
  );
}

function occupancy(
  cart: Cart,
  bookings: Booking[],
  date: string,
  period: Period | null,
) {
  if (!period) return null;
  return (
    bookings.find(
      (entry) =>
        entry.cartId === cart.id &&
        entry.date === date &&
        entry.period === period,
    ) ?? null
  );
}

function firstName(user: SessionUser) {
  return user.firstName || user.name.split(/\s+/)[0] || "there";
}

function schoolDayLabel(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
  }).format(now);
  const rest = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    month: "long",
    day: "numeric",
  }).format(now);
  return { weekday, rest };
}

type MobileView =
  | "home"
  | "scan"
  | "bookings"
  | "schedule"
  | "issues"
  | "shares"
  | "swaps"
  | "profile";

function TeacherScanHome({
  user,
  onScan,
  onOpen,
}: {
  user: SessionUser;
  onScan: () => void;
  onOpen: (view: Exclude<MobileView, "home" | "scan" | "profile">) => void;
}) {
  const { bookings, issues, swapRequests, carts } = usePlatformStore();
  const today = getSchoolDate();
  const period = getCurrentPeriod() ?? getNextPeriod();
  const day = schoolDayLabel();

  const mineToday = bookings
    .filter(
      (booking) =>
        bookingInvolvesUser(booking, user.id) && booking.date === today,
    )
    .sort((a, b) => a.period.localeCompare(b.period));
  const nowBooking = period
    ? mineToday.find((booking) => booking.period === period) ?? mineToday[0]
    : mineToday[0];
  const nowCart = nowBooking
    ? carts.find((cart) => cart.id === nowBooking.cartId)
    : null;

  const bookingCount = bookings.filter((booking) =>
    bookingInvolvesUser(booking, user.id),
  ).length;
  const issueCount = issues.filter(
    (issue) => issue.reportedById === user.id && issue.status === "open",
  ).length;
  const shareCount = bookings.filter((booking) =>
    bookingHasShareInviteFor(booking, user.id),
  ).length;
  const swapCount = swapRequests.filter((request) => {
    if (request.status !== "pending") return false;
    const booking = bookings.find((entry) => entry.id === request.bookingId);
    return booking?.teacherId === user.id;
  }).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7]">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.15rem,env(safe-area-inset-top))]">
        <CubicleWordmark size="sm" href={null} className="font-bold" />
        <div className="flex items-center gap-3">
          <LocalPerspectiveSwitch user={user} />
          <button
            type="button"
            onClick={() => void signOutAction()}
            className="text-[15px] font-medium tracking-[-0.02em] text-neutral-400 active:text-neutral-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[22.5rem] flex-1 flex-col overflow-y-auto px-5 pb-4 pt-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          {day.weekday}
        </p>
        <h1 className="mt-0.5 text-[34px] font-semibold leading-none tracking-[-0.04em] text-neutral-950">
          {day.rest}
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          {period
            ? `${getPeriodSchedule(period).label} · ${getPeriodSchedule(period).start}–${getPeriodSchedule(period).end}`
            : `Hi, ${firstName(user)}`}
        </p>

        <button
          type="button"
          onClick={onScan}
          className={cn(
            "mt-7 flex w-full items-center gap-3.5 rounded-[12px] bg-neutral-950 px-3.5 py-3.5 text-left text-white",
            "transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "active:scale-[0.985]",
          )}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-white/10">
            <QrCode className="size-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold tracking-[-0.02em]">
              Scan QR code
            </span>
            <span className="mt-0.5 block text-[13px] text-white/55">
              Cart or laptop label
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-white/35" strokeWidth={2} />
        </button>

        {nowBooking && nowCart ? (
          <button
            type="button"
            onClick={() => onOpen("bookings")}
            className="mt-3.5 flex w-full items-center justify-between rounded-[12px] bg-white px-4 py-3.5 text-left active:bg-neutral-50"
          >
            <span className="min-w-0">
              <span className="block text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                Now
              </span>
              <span className="mt-0.5 block truncate text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">
                {nowCart.name}
              </span>
              <span className="mt-0.5 block text-[13px] text-neutral-400">
                {nowBooking.period}
                {nowCart.location ? ` · ${nowCart.location}` : ""}
              </span>
            </span>
            <ChevronRight className="size-5 text-neutral-300" strokeWidth={2} />
          </button>
        ) : null}

        <div className="mt-3.5 flex flex-col gap-3">
          <HomeGroup
            rows={[
              {
                label: "Bookings",
                detail: bookingCount ? String(bookingCount) : undefined,
                onClick: () => onOpen("bookings"),
              },
              { label: "Schedule", onClick: () => onOpen("schedule") },
              {
                label: "Issues",
                detail: issueCount ? String(issueCount) : undefined,
                onClick: () => onOpen("issues"),
              },
            ]}
          />
          <HomeGroup
            rows={[
              {
                label: "Shares",
                detail: shareCount ? String(shareCount) : undefined,
                onClick: () => onOpen("shares"),
              },
              {
                label: "Swaps",
                detail: swapCount ? String(swapCount) : undefined,
                onClick: () => onOpen("swaps"),
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

function HomeGroup({
  rows,
}: {
  rows: Array<{ label: string; detail?: string; onClick: () => void }>;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white">
      {rows.map((row, index) => (
        <div key={row.label}>
          {index > 0 ? <div className="ml-4 h-px bg-neutral-100" /> : null}
          <HomeRow
            label={row.label}
            detail={row.detail}
            onClick={row.onClick}
          />
        </div>
      ))}
    </div>
  );
}

function HomeRow({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[3.25rem] w-full items-center gap-3 px-4 text-left active:bg-neutral-50"
    >
      <span className="min-w-0 flex-1 text-[17px] tracking-[-0.02em] text-neutral-950">
        {label}
      </span>
      {detail ? (
        <span className="tabular-nums text-[17px] text-neutral-400">{detail}</span>
      ) : null}
      <ChevronRight className="size-5 text-neutral-300" strokeWidth={2} />
    </button>
  );
}

/**
 * Teacher phone home — SCAN first, then camera (or local simulator).
 */
const PUSH_VIEWS = new Set<MobileView>([
  "bookings",
  "schedule",
  "issues",
  "shares",
  "swaps",
]);

export function TeacherQrScanner({ user }: { user: SessionUser }) {
  const [view, setView] = useState<MobileView>("home");
  const goHome = () => setView("home");
  const showTabs = view === "home" || view === "profile";
  const isPush = PUSH_VIEWS.has(view);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f2f2f7]">
      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={
              isPush
                ? { x: 28, opacity: 0 }
                : { opacity: 0 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              isPush
                ? { x: 16, opacity: 0 }
                : { opacity: 0 }
            }
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {view === "scan" ? (
              <TeacherScanCamera user={user} onBack={goHome} />
            ) : view === "bookings" ? (
              <TeacherMobileBookings user={user} onBack={goHome} />
            ) : view === "schedule" ? (
              <Suspense fallback={<div className="min-h-dvh bg-[#f2f2f7]" />}>
                <TeacherMobileSchedule user={user} onBack={goHome} />
              </Suspense>
            ) : view === "issues" ? (
              <TeacherMobileIssues user={user} onBack={goHome} />
            ) : view === "shares" ? (
              <TeacherMobileShares user={user} onBack={goHome} />
            ) : view === "swaps" ? (
              <TeacherMobileSwaps user={user} onBack={goHome} />
            ) : view === "profile" ? (
              <TeacherMobileSettings
                user={user}
                onBack={goHome}
                embedded
              />
            ) : (
              <TeacherScanHome
                user={user}
                onScan={() => setView("scan")}
                onOpen={(next) => setView(next)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {showTabs ? (
        <TeacherMobileTabBar
          tab={view === "profile" ? "profile" : "home"}
          onHome={goHome}
          onScan={() => setView("scan")}
          onProfile={() => setView("profile")}
        />
      ) : null}
      <Toaster />
    </div>
  );
}

function TeacherScanCamera({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const simulate = isLocalDevRuntime();
  const { carts, bookings } = usePlatformStore();
  const [hit, setHit] = useState<ScanHit | null>(null);
  const [locking, setLocking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  const ordered = useMemo(() => sortCarts(carts), [carts]);
  const date = getSchoolDate();
  const currentPeriod = getCurrentPeriod();
  const bookPeriod = currentPeriod ?? getNextPeriod();

  const targets = useMemo((): SimTarget[] => {
    const list: SimTarget[] = [];
    for (const cart of ordered) {
      list.push({
        key: `cart:${cart.id}`,
        label: cart.name,
        detail: cart.location || "Cart",
        payload: cartQrPayload(cart.id),
      });
      for (const code of cart.laptopCodes ?? []) {
        list.push({
          key: `laptop:${code}`,
          label: code,
          detail: cart.name,
          payload: laptopQrPayload(code),
        });
      }
    }
    return list;
  }, [ordered]);

  function acceptCode(raw: string) {
    const next = resolveHit(raw, carts);
    if (next === "foreign") {
      setHint("Not a Cubicle label");
      return;
    }
    setHint(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
    setHit(next);
  }

  const camera = useQrCamera({
    enabled: !simulate,
    paused: Boolean(hit) || locking,
    onCode: acceptCode,
  });

  function simulateScan(payload: string) {
    if (locking || hit) return;
    setHint(null);
    setLocking(true);
    window.setTimeout(() => {
      setLocking(false);
      acceptCode(payload);
    }, 620);
  }

  function resetScan() {
    setHit(null);
    setBookOpen(false);
    setIssueOpen(false);
    setHint(null);
  }

  const resultCart =
    hit && hit.kind !== "missing" ? hit.cart : null;
  const slot = resultCart
    ? occupancy(resultCart, bookings, date, bookPeriod)
    : null;

  const dateLabel = (() => {
    try {
      return format(parseISO(date), "EEE, MMM d");
    } catch {
      return date;
    }
  })();

  const liveHint = simulate
    ? "Simulator · tap a label to scan"
    : camera.status === "starting"
      ? "Starting camera…"
      : camera.status === "denied"
        ? "Camera is off. Turn it on in Settings."
        : camera.status === "unsupported"
          ? "Camera isn’t available on this device."
          : "Align a Cubicle QR code in the frame";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black text-white">
      {!simulate ? (
        <video
          ref={camera.videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
          autoPlay
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-neutral-950" />
      )}

      <header className="relative z-20 flex items-center justify-between gap-3 px-4 pt-[max(1.15rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 rounded-full py-1 pr-2 text-[16px] font-medium tracking-[-0.02em] text-white"
        >
          <ChevronLeft className="size-5" strokeWidth={2.25} />
          Back
        </button>
        <LocalPerspectiveSwitch user={user} />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center px-5 pt-8">
        <div
          className={cn(
            "relative size-[min(72vw,17.5rem)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            locking && "scale-[0.985]",
          )}
        >
          <div className="absolute inset-0 rounded-[12px] border border-white/35" />
          <Corner pos="tl" locked={locking || Boolean(hit)} />
          <Corner pos="tr" locked={locking || Boolean(hit)} />
          <Corner pos="bl" locked={locking || Boolean(hit)} />
          <Corner pos="br" locked={locking || Boolean(hit)} />
          {simulate && !hit ? (
            <button
              type="button"
              disabled={locking || targets.length === 0}
              onClick={() => {
                const pick = targets[0];
                if (pick) simulateScan(pick.payload);
              }}
              className="absolute inset-0 rounded-[28px]"
              aria-label="Simulate a scan"
            />
          ) : null}
        </div>

        <p className="mt-6 max-w-[16rem] text-center text-[13px] font-medium tracking-[-0.01em] text-white/70">
          {hint ?? liveHint}
        </p>

        {simulate && !hit ? (
          <div className="mt-8 w-full max-w-[22rem] flex-1 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
              Simulator
            </p>
            <ul className="flex flex-col overflow-hidden rounded-[16px] bg-white/[0.08]">
              {targets.length === 0 ? (
                <li className="px-4 py-5 text-center text-[13px] text-white/45">
                  Add a cart in Inventory first.
                </li>
              ) : (
                targets.map((target, index) => (
                  <li
                    key={target.key}
                    className={index > 0 ? "border-t border-white/[0.08]" : undefined}
                  >
                    <button
                      type="button"
                      disabled={locking}
                      onClick={() => simulateScan(target.payload)}
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left active:bg-white/[0.06] disabled:opacity-50"
                    >
                      <span className="truncate text-[15px] font-medium tracking-[-0.02em] text-white">
                        {target.label}
                      </span>
                      <span className="shrink-0 text-[12px] text-white/40">
                        {target.detail}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {!hit ? (
        <div className="relative z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 text-center">
          <button
            type="button"
            onClick={() => void signOutAction()}
            className="text-[13px] text-white/40 transition-colors hover:text-white/70"
          >
            Sign out
          </button>
        </div>
      ) : null}

      <AnimatePresence>
      {hit ? (
        <motion.div
          key="scan-sheet"
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex flex-col overflow-hidden rounded-t-[12px] border-t border-neutral-200 bg-white text-neutral-950">
            <div className="flex justify-center pt-2.5">
              <span className="h-1 w-10 rounded-full bg-neutral-200" />
            </div>
            <div className="flex flex-col gap-5 px-5 pb-5 pt-3">
              {hit.kind === "missing" ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                    Unknown label
                  </p>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em]">
                    {hit.title}
                  </h2>
                  <p className="text-[13px] leading-relaxed text-neutral-500">
                    This code isn’t on the board yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                    {hit.kind === "laptop" ? "Laptop" : "Cart"}
                  </p>
                  <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.03em]">
                    {hit.kind === "laptop" ? hit.code : hit.cart.name}
                    <CartBrandMark
                      brand={hit.cart.laptopBrand}
                      className="size-5"
                      logoClassName="size-4"
                    />
                  </h2>
                  <p className="text-[13px] text-neutral-500">
                    {hit.kind === "laptop"
                      ? [hit.cart.name, hit.cart.location]
                          .filter(Boolean)
                          .join(" · ")
                      : [
                          hit.cart.location,
                          hit.cart.laptopBrand
                            ? laptopBrandLabel(hit.cart.laptopBrand)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No location"}
                  </p>
                  {hit.cart.status === "maintenance" ? (
                    <p className="mt-2 text-[13px] font-medium text-neutral-950">
                      In maintenance
                    </p>
                  ) : bookPeriod ? (
                    <p className="mt-2 text-[13px] text-neutral-600">
                      {getPeriodSchedule(bookPeriod).label}
                      {currentPeriod ? "" : ` · ${getPeriodSchedule(bookPeriod).start}`}
                      <span className="text-neutral-300"> · </span>
                      {slot
                        ? slot.teacherId === user.id
                          ? "Yours"
                          : slot.teacherName
                        : "Free"}
                      <span className="text-neutral-300"> · </span>
                      {dateLabel}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-neutral-500">
                      School day is over · {dateLabel}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {resultCart &&
                resultCart.status !== "maintenance" &&
                bookPeriod &&
                !slot ? (
                  <Button type="button" onClick={() => setBookOpen(true)}>
                    Book {getPeriodSchedule(bookPeriod).label}
                  </Button>
                ) : null}
                {resultCart ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIssueOpen(true)}
                  >
                    Report issue
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={resetScan}>
                  Scan again
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
      </AnimatePresence>

      {bookOpen && resultCart && bookPeriod ? (
        <BookDialog
          cart={resultCart}
          period={bookPeriod}
          date={date}
          onClose={() => setBookOpen(false)}
        />
      ) : null}
      {issueOpen && resultCart ? (
        <IssueDialog cart={resultCart} onClose={() => setIssueOpen(false)} />
      ) : null}
    </div>
  );
}
