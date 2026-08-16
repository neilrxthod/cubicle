"use client";

import { Suspense, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { AdminMobileSection } from "@/components/app/admin-mobile-section";
import { MobileQrCodes } from "@/components/app/mobile-qr-codes";
import { MobileReports } from "@/components/app/mobile-reports";
import { MobileStaff } from "@/components/app/mobile-staff";
import { MobileReservations } from "@/components/app/mobile-reservations";
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
import {
  getCurrentPeriod,
  getNextPeriod,
  getPeriodSchedule,
  getSchoolDate,
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

/** Viewfinder: thin ring + thick corners share one rounded-rect path. */
function ScanReticle({ locked }: { locked: boolean }) {
  const size = 280;
  const stroke = 3;
  const inset = stroke / 2;
  const radius = 22;
  const arm = 36;
  const x0 = inset;
  const y0 = inset;
  const x1 = size - inset;
  const y1 = size - inset;

  const corners = [
    `M ${x0} ${y0 + arm} L ${x0} ${y0 + radius} Q ${x0} ${y0} ${x0 + radius} ${y0} L ${x0 + arm} ${y0}`,
    `M ${x1 - arm} ${y0} L ${x1 - radius} ${y0} Q ${x1} ${y0} ${x1} ${y0 + radius} L ${x1} ${y0 + arm}`,
    `M ${x0} ${y1 - arm} L ${x0} ${y1 - radius} Q ${x0} ${y1} ${x0 + radius} ${y1} L ${x0 + arm} ${y1}`,
    `M ${x1 - arm} ${y1} L ${x1 - radius} ${y1} Q ${x1} ${y1} ${x1} ${y1 - radius} L ${x1} ${y1 - arm}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
    >
      <rect
        x={inset}
        y={inset}
        width={size - stroke}
        height={size - stroke}
        rx={radius}
        ry={radius}
        fill="none"
        stroke="white"
        strokeOpacity={locked ? 0.18 : 0.3}
        strokeWidth={1.15}
      />
      <path
        d={corners}
        fill="none"
        stroke="white"
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeLinejoin="round"
        opacity={locked ? 1 : 0.96}
      />
    </svg>
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

type MobileView =
  | "home"
  | "scan"
  | "bookings"
  | "schedule"
  | "issues"
  | "shares"
  | "swaps"
  | "profile"
  | "admin-carts"
  | "admin-labels"
  | "admin-bookings"
  | "admin-reports"
  | "admin-staff";

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

  const mineToday = bookings
    .filter(
      (booking) =>
        bookingInvolvesUser(booking, user.id) && booking.date === today,
    )
    .sort((a, b) => a.period.localeCompare(b.period));
  const nowBooking = period
    ? (mineToday.find((booking) => booking.period === period) ?? mineToday[0])
    : mineToday[0];
  const nowCart = nowBooking
    ? carts.find((cart) => cart.id === nowBooking.cartId)
    : null;

  const bookingCount = bookings.filter((booking) =>
    bookingInvolvesUser(booking, user.id),
  ).length;
  const issueCount = issues.filter(
    (issue) =>
      issue.status === "open" &&
      (user.role === "admin" || issue.reportedById === user.id),
  ).length;
  const shareCount = bookings.filter((booking) =>
    bookingHasShareInviteFor(booking, user.id),
  ).length;
  const swapCount = swapRequests.filter((request) => {
    if (request.status !== "pending") return false;
    const booking = bookings.find((entry) => entry.id === request.bookingId);
    return booking?.teacherId === user.id;
  }).length;

  const teacherRows: HomeRowItem[] = [
    ...(nowCart
      ? [
          {
            label: "Now",
            detail: nowCart.name,
            onClick: () => onOpen("bookings"),
          },
        ]
      : []),
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
  ];

  const adminRows: HomeRowItem[] = [
    { label: "Inventory", onClick: () => onOpen("admin-carts") },
    { label: "QR Codes", onClick: () => onOpen("admin-labels") },
    { label: "Reservations", onClick: () => onOpen("admin-bookings") },
    { label: "Reports", onClick: () => onOpen("admin-reports") },
    { label: "Staff", onClick: () => onOpen("admin-staff") },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7]">
      <header className="shrink-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-11 items-center justify-between px-4">
          <CubicleWordmark size="sm" href={null} />
          <LocalPerspectiveSwitch user={user} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-2">
        <button
          type="button"
          onClick={onScan}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-neutral-950 text-white",
            "text-[17px] font-semibold tracking-[-0.02em]",
            "transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "active:scale-[0.985]",
          )}
        >
          <QrCode className="size-[18px]" strokeWidth={1.75} />
          Scan
        </button>

        <HomeGroup className="mt-6" rows={teacherRows} />

        {user.role === "admin" ? (
          <HomeGroup title="Admin" className="mt-7" rows={adminRows} />
        ) : null}
      </main>
    </div>
  );
}

type HomeRowItem = {
  label: string;
  detail?: string;
  onClick: () => void;
};

function HomeGroup({
  title,
  rows,
  className,
}: {
  title?: string;
  rows: HomeRowItem[];
  className?: string;
}) {
  return (
    <section className={className}>
      {title ? (
        <h2 className="px-4 pb-1.5 text-[13px] font-normal text-neutral-400">
          {title}
        </h2>
      ) : null}
      <div className="overflow-hidden rounded-[10px] bg-white">
        {rows.map((row, index) => (
          <HomeRow
            key={row.label}
            label={row.label}
            detail={row.detail}
            onClick={row.onClick}
            divided={index > 0}
          />
        ))}
      </div>
    </section>
  );
}

function HomeRow({
  label,
  detail,
  onClick,
  divided,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-11 w-full items-center gap-2 px-4 text-left active:bg-neutral-50",
        divided &&
          "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-neutral-200/80",
      )}
    >
      <span className="min-w-0 flex-1 text-[17px] tracking-[-0.02em] text-neutral-950">
        {label}
      </span>
      {detail ? (
        <span className="shrink-0 tabular-nums text-[17px] text-neutral-400">
          {detail}
        </span>
      ) : null}
      <ChevronRight
        className="-mr-1 size-[18px] shrink-0 text-neutral-300"
        strokeWidth={2}
      />
    </button>
  );
}

/**
 * Phone app — SCAN first, then camera (or local simulator).
 * Teachers and admins share this shell; admins also get inventory tools.
 */
const PUSH_VIEWS = new Set<MobileView>([
  "bookings",
  "schedule",
  "issues",
  "shares",
  "swaps",
  "admin-carts",
  "admin-labels",
  "admin-bookings",
  "admin-reports",
  "admin-staff",
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
            ) : view === "admin-carts" ? (
              <AdminMobileSection
                title="Inventory"
                tab="carts"
                onBack={goHome}
              />
            ) : view === "admin-labels" ? (
              <MobileQrCodes onBack={goHome} />
            ) : view === "admin-bookings" ? (
              <MobileReservations
                user={user}
                onBack={goHome}
                scope="school"
              />
            ) : view === "admin-reports" ? (
              <MobileReports onBack={goHome} />
            ) : view === "admin-staff" ? (
              <MobileStaff onBack={goHome} />
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

  const { videoRef, status: cameraStatus } = useQrCamera({
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
    : cameraStatus === "starting"
      ? "Starting camera…"
      : cameraStatus === "denied"
        ? "Camera is off. Turn it on in Settings."
        : cameraStatus === "unsupported"
          ? "Camera isn’t available on this device."
          : "Align a Cubicle seal in the frame";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black text-white">
      {!simulate ? (
        <video
          ref={videoRef}
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

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-5">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className={cn(
              "relative size-[min(72vw,17.5rem)] overflow-visible rounded-[22px]",
              "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              locking && "scale-[0.985]",
            )}
            style={{ boxShadow: "0 0 0 200vmax rgba(0,0,0,0.5)" }}
          >
            <ScanReticle locked={locking || Boolean(hit)} />
            {simulate && !hit ? (
              <button
                type="button"
                disabled={locking || targets.length === 0}
                onClick={() => {
                  const pick = targets[0];
                  if (pick) simulateScan(pick.payload);
                }}
                className="absolute inset-0 rounded-[22px]"
                aria-label="Simulate a scan"
              />
            ) : null}
          </div>

          <p className="relative z-[1] mt-7 max-w-[17rem] text-center text-[13px] font-medium tracking-[-0.015em] text-white/75">
            {hint ?? liveHint}
          </p>
        </div>

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
