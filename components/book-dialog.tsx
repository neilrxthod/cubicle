"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Check, Search, User, X } from "lucide-react";
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
import { usePresenceMap, type PresenceStatus } from "@/lib/staff/presence";
import { PresenceDot } from "@/components/presence-dot";
import {
  getOnboarding,
  isAssignmentComplete,
} from "@/lib/onboarding/storage";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import {
  BOOKING_PURPOSES,
  getBookingPurposeOption,
  type BookingPurposeId,
  type Cart,
  type Period,
  type User as StaffUser,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
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

  function resolveSubject() {
    if (!session) return "";
    const prefs = getOnboarding(session.id || session.email);
    const loads = (prefs.teachingAssignments ?? []).filter(
      isAssignmentComplete,
    );
    const match = loads.find((a) => a.periods.includes(period));
    return match?.subject.trim() || loads[0]?.subject.trim() || "";
  }

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

    const teachingSubject = resolveSubject();
    const otherNote = custom.trim();

    if (purposeId === "class") {
      if (teachingSubject) {
        formData.set("subject", teachingSubject);
        formData.set("className", teachingSubject);
      } else {
        formData.set("className", purpose.label);
        formData.set("subject", purpose.label);
      }
    } else if (purposeId === "other" && otherNote) {
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
        router.refresh();
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
      router.refresh();
      onClose();
    });
  }

  const meta = [
    period,
    dateLabel,
    purposeId !== "class" ? purpose.label : null,
    selectedPartner ? `with ${selectedPartner.name.split(/\s+/)[0]}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <>
    <Dialog open={!slotLimit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className="w-[min(100%,27rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-surface)] sm:max-w-[27rem]"
      >
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Book {cart.name}?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-neutral-400">
            {meta}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 pt-5">
          <div className="flex flex-nowrap gap-1.5">
            {BOOKING_PURPOSES.map((p) => {
              const selected = purposeId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPurposeId(p.id);
                    if (p.id !== "other") setCustom("");
                    setError(null);
                  }}
                  className={cn(
                    "h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                    selected
                      ? p.id === "ap_exam"
                        ? "bg-violet-700 text-white"
                        : "bg-neutral-950 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {purposeId === "other" ? (
            <Input
              id="book-custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="What for? (optional)"
              disabled={pending}
              autoComplete="off"
              className="-mt-2 h-9 rounded-lg border-neutral-200 bg-white text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-300"
            />
          ) : null}

          {colleagues.length > 0 ? (
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
          ) : null}

          {error ? (
            <p className="text-[12.5px] font-medium text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-5">
          <DialogCancel onClick={onClose}>Cancel</DialogCancel>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            aria-label={pending ? "Booking" : "Book"}
            onClick={handleBook}
            className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-full bg-neutral-950 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
    <div className="flex flex-col gap-3">
      {showSearch ? youButton : null}
      {showSearch ? (
        <div className="relative">
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
              className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-neutral-400 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className="max-h-[11.5rem] overflow-y-auto overscroll-contain"
        role="listbox"
        aria-label="Share with colleague"
      >
        {empty ? (
          <p className="py-6 text-center text-[12.5px] text-neutral-400">
            No match
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-3.5 gap-y-3">
            {showSearch ? null : youButton}
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
        "flex w-[3.25rem] shrink-0 flex-col items-center gap-[5px] outline-none",
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
          "max-w-[3.25rem] truncate text-center text-[11px] leading-tight tracking-[-0.02em]",
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
