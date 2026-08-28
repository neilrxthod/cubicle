"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Search, User, X } from "lucide-react";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookingLimitDialog } from "@/components/booking-limit-dialog";
import { createBooking } from "@/lib/actions";
import { slotLimitNoticeFromError } from "@/lib/booking/slot-rules";
import type { SlotLimitNotice } from "@/lib/booking/slot-rules";
import { getSessionSnapshot } from "@/lib/auth/session";
import { motionSafe, transitionFast } from "@/lib/motion/platform";
import { usePresenceMap, type PresenceStatus } from "@/lib/staff/presence";
import { PresenceDot } from "@/components/presence-dot";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import {
  getBookingPurposeOption,
  type BookingPurposeId,
  type Cart,
  type Period,
  type User as StaffUser,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Keep the sheet above the software keyboard. */
function useKeyboardLift() {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const overlap = Math.max(
        0,
        window.innerHeight - (viewport.height + viewport.offsetTop),
      );
      setLift(overlap > 48 ? overlap : 0);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);
  return lift;
}

/** 2×3: Extra / AP exam on row 2, Club / Other under them. */
const PURPOSE_GRID: BookingPurposeId[] = [
  "class",
  "spare",
  "extra",
  "ap_exam",
  "club",
  "other",
];

/** One-tap book. Purpose tag + optional share via colleague avatars. */
export function BookDialog({
  cart,
  period,
  date,
  onClose,
  onOpened,
}: {
  cart: Cart;
  period: Period;
  date: string;
  onClose: () => void;
  onOpened?: () => void;
}) {
  const platform = usePlatformStore();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [purposeId, setPurposeId] = useState<BookingPurposeId>("class");
  /** null = just me; string = colleague id */
  const [shareWithId, setShareWithId] = useState<string | null>(null);
  const [shareQuery, setShareQuery] = useState("");
  const [slotLimit, setSlotLimit] = useState<SlotLimitNotice | null>(null);

  const session = getSessionSnapshot();
  const purpose = getBookingPurposeOption(purposeId);
  const presenceByUser = usePresenceMap();
  const keyboardLift = useKeyboardLift();

  useEffect(() => {
    onOpened?.();
    // Only when the dialog chunk has mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colleagues = useMemo(() => {
    if (!session) return [] as StaffUser[];
    return platform.users
      .filter(
        (u) =>
          u.id !== session.id &&
          !u.pendingInvite &&
          u.allowlisted !== false &&
          Boolean(u.id) &&
          !u.id.startsWith("pending:"),
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [platform.users, session]);

  const selectedPartner = shareWithId
    ? colleagues.find((c) => c.id === shareWithId)
    : undefined;

  const shareQueryNorm = shareQuery.trim().toLowerCase();
  const filteredColleagues = useMemo(() => {
    if (!shareQueryNorm) return colleagues;
    return colleagues.filter((u) => {
      const name = u.name.toLowerCase();
      const email = u.email.toLowerCase();
      return name.includes(shareQueryNorm) || email.includes(shareQueryNorm);
    });
  }, [colleagues, shareQueryNorm]);

  const visibleColleagues = useMemo(() => {
    if (
      !selectedPartner ||
      filteredColleagues.some((c) => c.id === selectedPartner.id)
    ) {
      return filteredColleagues;
    }
    return [selectedPartner, ...filteredColleagues];
  }, [filteredColleagues, selectedPartner]);

  const dateLabel = (() => {
    try {
      return format(parseISO(date), "EEE, MMM d");
    } catch {
      return date;
    }
  })();

  function togglePartner(id: string) {
    setShareWithId((cur) => (cur === id ? null : id));
    setError(null);
  }

  function handleBook() {
    setError(null);
    const formData = new FormData();
    formData.set("cartId", cart.id);
    formData.set("date", date);
    formData.set("period", period);

    const otherNote = custom.trim();

    if (purposeId === "other" && otherNote) {
      formData.set("className", purpose.label);
      formData.set("subject", purpose.label);
      formData.set("notes", otherNote);
    } else {
      formData.set("className", purpose.label);
      formData.set("subject", purpose.label);
    }

    if (shareWithId) {
      formData.set("sharedWithId", shareWithId);
    }

    startTransition(async () => {
      const started = Date.now();
      const res = await createBooking(formData);
      const remain = 1500 - (Date.now() - started);
      if (remain > 0) {
        await new Promise((resolve) => setTimeout(resolve, remain));
      }
      if (res && "error" in res && res.error) {
        const limit = slotLimitNoticeFromError(res.error);
        if (limit) {
          setSlotLimit(limit);
          return;
        }
        setError(res.error);
        toast({
          title: "Could not book cart",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      if (res.ok && res.data?.shareSkipped) {
        toast({
          title: "Cart booked",
          description:
            "Share needs a DB update — run supabase/booking-share.sql in Supabase.",
        });
      } else {
        toast({
          title:
            purposeId !== "class"
              ? `${purpose.label} booked`
              : selectedPartner
                ? "Cart booked · invite sent"
                : "Cart booked",
          description: [
            cart.name,
            period,
            purposeId !== "class" ? purpose.label : null,
            selectedPartner ? `invite → ${selectedPartner.name}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
      onClose();
    });
  }

  const metaParts = [period, dateLabel];
  const partnerFirst =
    selectedPartner?.name.trim().split(/\s+/)[0] ?? selectedPartner?.name;

  const sheetStyle = {
    transform: keyboardLift
      ? `translateY(-${Math.round(Math.min(keyboardLift * 0.5, 180))}px)`
      : undefined,
  } satisfies CSSProperties;

  return (
    <>
    <Dialog open={!slotLimit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        style={sheetStyle}
        className={cn(
          "flex min-h-0 w-[min(calc(100vw-2rem),42rem)] flex-col gap-0 overflow-hidden rounded-2xl",
          "max-h-[min(88svh,calc(100dvh-2rem))] sm:max-w-[42rem]",
          "border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-soft)]",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-[var(--hairline)] px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950">
            Book {cart.name}
          </DialogTitle>
          <DialogDescription className="mt-1 flex min-w-0 items-center text-[12.5px] tracking-[-0.01em] text-neutral-500">
            {metaParts.map((part, i) => (
              <span key={part} className="inline-flex items-center">
                {i > 0 ? (
                  <ChevronRight
                    aria-hidden
                    className="mx-0.5 size-3.5 shrink-0 text-neutral-300"
                    strokeWidth={1.75}
                  />
                ) : null}
                <span className={part === period ? "tabular-nums" : undefined}>
                  {part}
                </span>
              </span>
            ))}
            {selectedPartner ? (
                <span className="inline-flex min-w-0 items-center">
                <ChevronRight
                  aria-hidden
                  className="mx-0.5 size-3.5 shrink-0 text-neutral-300"
                  strokeWidth={1.75}
                />
                <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-neutral-950 py-0.5 pl-0.5 pr-2 text-white">
                  <span className="size-5 shrink-0 overflow-hidden rounded-full bg-white">
                    <ShareFace user={selectedPartner} />
                  </span>
                  <span className="min-w-0 truncate">with {partnerFirst}</span>
                </span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row sm:overflow-hidden">
          <section className="shrink-0 px-5 py-4 sm:w-[17rem] sm:border-r sm:border-[var(--hairline)]">
            <p className="text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
              Purpose
            </p>
            <div
              className="mt-2.5 grid grid-cols-2 gap-1.5"
              role="listbox"
              aria-label="Purpose"
            >
              {PURPOSE_GRID.map((id) => {
                const p = getBookingPurposeOption(id);
                const selected = purposeId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={pending}
                    onClick={() => {
                      setPurposeId(p.id);
                      if (p.id !== "other") setCustom("");
                      setError(null);
                    }}
                    className={cn(
                      "h-8 w-full rounded-full px-2 text-[12.5px] font-medium tracking-[-0.01em] transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                      selected ? p.capsuleClassSelected : p.capsuleClass,
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {purposeId === "other" ? (
                <motion.div
                  key="other-note"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={motionSafe(transitionFast)}
                  className="overflow-hidden"
                >
                  <Input
                    id="book-custom"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="What for? (optional)"
                    disabled={pending}
                    autoComplete="off"
                    className="mt-2.5 h-9 rounded-lg border-neutral-200/80 bg-neutral-50 text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-400"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="mt-3 text-[12.5px] font-medium text-red-600">
                {error}
              </p>
            ) : null}
          </section>

          {colleagues.length > 0 ? (
            <section className="flex min-h-0 min-w-0 flex-1 flex-col px-5 py-4">
              <p className="shrink-0 text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
                Share
              </p>
              <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <ShareColleagueGrid
                  query={shareQuery}
                  onQueryChange={setShareQuery}
                  colleagues={visibleColleagues}
                  shareWithId={shareWithId}
                  youPresence={
                    session?.id
                      ? (presenceByUser.get(session.id) ?? "offline")
                      : "offline"
                  }
                  presenceByUser={presenceByUser}
                  pending={pending}
                  showSearch={colleagues.length > 6}
                  empty={
                    shareQueryNorm.length > 0 && visibleColleagues.length === 0
                  }
                  onJustMe={() => {
                    setShareWithId(null);
                    setError(null);
                  }}
                  onToggle={togglePartner}
                />
              </div>
            </section>
          ) : null}
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--hairline)] bg-white px-5 py-3"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <DialogCancel onClick={onClose}>Cancel</DialogCancel>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            aria-label={pending ? "Booking" : "Book"}
            onClick={handleBook}
            className="inline-flex h-9 min-w-[5.75rem] items-center justify-center rounded-full bg-neutral-950 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Spinner className="size-3.5 text-white" />
            ) : (
              "Book"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <BookingLimitDialog
      notice={slotLimit}
      onClose={() => {
        setSlotLimit(null);
        onClose();
      }}
    />
    </>
  );
}

function ShareFace({ user }: { user: StaffUser }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        draggable={false}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-full items-center justify-center bg-neutral-100 text-[11px] font-medium tracking-[-0.02em] text-neutral-600">
      {initials(user.name)}
    </span>
  );
}

function ShareColleagueGrid({
  query,
  onQueryChange,
  colleagues,
  shareWithId,
  youPresence,
  presenceByUser,
  pending,
  showSearch,
  empty,
  onJustMe,
  onToggle,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  colleagues: StaffUser[];
  shareWithId: string | null;
  youPresence: PresenceStatus;
  presenceByUser: Map<string, PresenceStatus>;
  pending: boolean;
  showSearch: boolean;
  empty: boolean;
  onJustMe: () => void;
  onToggle: (id: string) => void;
}) {
  const youButton = (
    <ShareIconButton
      selected={shareWithId === null}
      disabled={pending}
      presence={youPresence}
      label="Just me"
      onClick={onJustMe}
      face={
        <span className="flex size-full items-center justify-center bg-[#e5e5ea] text-neutral-500">
          <User className="size-[18px]" strokeWidth={1.75} />
        </span>
      }
      caption="You"
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      {showSearch ? (
        <div className="relative shrink-0">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
            strokeWidth={2}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Find someone"
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            className={cn(
              "h-8 w-full rounded-full border-0 bg-neutral-100 py-0 pl-8 pr-8",
              "text-[13px] tracking-[-0.01em] text-neutral-950 outline-none",
              "placeholder:text-neutral-400",
              "disabled:opacity-50",
              "[appearance:none] [&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-300 text-white transition-colors hover:bg-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              aria-label="Clear search"
            >
              <X className="size-2.5" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div role="listbox" aria-label="Share with colleague">
        {empty ? (
          <p className="py-8 text-center text-[12.5px] text-neutral-400">
            No match
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
            {youButton}
            {colleagues.map((u) => {
              const selected = shareWithId === u.id;
              return (
                <ShareIconButton
                  key={u.id}
                  selected={selected}
                  disabled={pending}
                  presence={presenceByUser.get(u.id) ?? "offline"}
                  label={u.name}
                  onClick={() => onToggle(u.id)}
                  face={<ShareFace user={u} />}
                  caption={u.name.trim().split(/\s+/)[0] || u.name}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function ShareIconButton({
  selected,
  disabled,
  presence = "offline",
  label,
  onClick,
  face,
  caption,
}: {
  selected: boolean;
  disabled?: boolean;
  presence?: PresenceStatus;
  label: string;
  onClick: () => void;
  face: ReactNode;
  caption: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-1 outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        "rounded-lg focus-visible:outline-none",
      )}
    >
      <span className="relative size-11 shrink-0">
        <span className="block size-11 overflow-hidden rounded-full">
          {face}
        </span>
        {!selected ? (
          <PresenceDot status={presence} size="md" />
        ) : null}
        {selected ? (
          <span className="absolute -right-px -bottom-px flex size-[18px] items-center justify-center rounded-full bg-neutral-950 ring-[2px] ring-white">
            <Check className="size-[10px] text-white" strokeWidth={2.75} />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "w-full truncate text-center text-[11px] leading-tight tracking-[-0.02em]",
          selected
            ? "font-medium text-neutral-950"
            : "font-normal text-[#8e8e93]",
        )}
      >
        {caption}
      </span>
    </button>
  );
}
