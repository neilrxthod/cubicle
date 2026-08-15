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
import { User } from "lucide-react";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBooking } from "@/lib/actions";
import { getSessionSnapshot } from "@/lib/auth/session";
import {
  getOnboarding,
  isAssignmentComplete,
} from "@/lib/onboarding/storage";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
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

  const session = getSessionSnapshot();
  const purpose = getBookingPurposeOption(purposeId);

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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Book {cart.name}?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-neutral-400">
            {period}
            <span className="text-neutral-300"> · </span>
            {dateLabel}
            {purposeId !== "class" ? (
              <>
                <span className="text-neutral-300"> · </span>
                <span className="text-neutral-600">{purpose.label}</span>
              </>
            ) : null}
            {selectedPartner ? (
              <>
                <span className="text-neutral-300"> · </span>
                <span className="text-neutral-600">
                  with {selectedPartner.name.split(/\s+/)[0]}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          {/* Purpose — all roles */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
              Purpose
            </p>
            <div className="flex flex-wrap gap-1.5">
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
                        : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
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
                className="mt-1 h-9 rounded-lg border-neutral-200 bg-white text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-300"
              />
            ) : null}
          </div>

          {/* Share row */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
              Invite to share
            </p>
            <p className="text-[11px] leading-snug text-neutral-400">
              They must accept before the cart is shared.
            </p>
            {colleagues.length > 0 ? (
              <div
                className="flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="listbox"
                aria-label="Share with colleague"
              >
                <ShareIconButton
                  selected={shareWithId === null}
                  disabled={pending}
                  label="Just me"
                  onClick={() => {
                    setShareWithId(null);
                    setError(null);
                  }}
                  face={
                    <span
                      className={cn(
                        "flex size-full items-center justify-center",
                        shareWithId === null
                          ? "bg-neutral-950 text-white"
                          : "bg-neutral-100 text-neutral-500",
                      )}
                    >
                      <User className="size-4" strokeWidth={1.75} />
                    </span>
                  }
                  caption={
                    <span
                      className={cn(
                        "max-w-[3rem] truncate text-center text-[10px] font-medium leading-tight",
                        shareWithId === null
                          ? "text-neutral-950"
                          : "text-neutral-400",
                      )}
                    >
                      You
                    </span>
                  }
                />

                {colleagues.map((u) => {
                  const selected = shareWithId === u.id;
                  const first = u.name.trim().split(/\s+/)[0] || u.name;
                  return (
                    <ShareIconButton
                      key={u.id}
                      selected={selected}
                      disabled={pending}
                      label={u.name}
                      onClick={() => togglePartner(u.id)}
                      face={
                        u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatarUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            draggable={false}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex size-full items-center justify-center text-[11px] font-medium",
                              selected
                                ? "bg-neutral-950 text-white"
                                : "bg-neutral-100 text-neutral-600",
                            )}
                          >
                            {initials(u.name)}
                          </span>
                        )
                      }
                      caption={
                        <span
                          className={cn(
                            "max-w-[3rem] truncate text-center text-[10px] font-medium leading-tight",
                            selected ? "text-neutral-950" : "text-neutral-400",
                          )}
                        >
                          {first}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-neutral-400">
                No other staff signed in yet — only you can be on this slot.
              </p>
            )}
          </div>

          {error ? (
            <p className="text-[12.5px] font-medium text-red-600">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <DialogCancel onClick={onClose}>Cancel</DialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                const formData = new FormData();
                formData.set("cartId", cart.id);
                formData.set("date", date);
                formData.set("period", period);

                const teachingSubject = resolveSubject();
                const otherNote = custom.trim();

                if (purposeId === "class") {
                  // Regular class — keep teaching subject when known
                  if (teachingSubject) {
                    formData.set("subject", teachingSubject);
                    formData.set("className", teachingSubject);
                  } else {
                    formData.set("className", purpose.label);
                    formData.set("subject", purpose.label);
                  }
                } else if (purposeId === "other" && otherNote) {
                  // Store label so board can tag "Other"; keep free text in notes
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
                  const res = await createBooking(formData);
                  if (res && "error" in res && res.error) {
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
                        selectedPartner
                          ? `invite → ${selectedPartner.name}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    });
                  }
                  router.refresh();
                  onClose();
                });
              }}
              className="h-9 rounded-lg bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Booking…" : "Book"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  label,
  onClick,
  face,
  caption,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  face: ReactNode;
  caption?: ReactNode;
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
        "flex w-12 shrink-0 flex-col items-center gap-1 outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2",
      )}
    >
      <span
        className={cn(
          "box-border flex size-11 shrink-0 items-center justify-center rounded-full p-[2px] transition-[background-color,transform]",
          selected ? "bg-neutral-950" : "bg-transparent",
          "active:scale-[0.97]",
        )}
      >
        <span
          className={cn(
            "size-full overflow-hidden rounded-full",
            !selected && "ring-1 ring-inset ring-black/[0.1]",
          )}
        >
          {face}
        </span>
      </span>
      {caption}
    </button>
  );
}
