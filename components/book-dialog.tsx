"use client";

import {
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
import type { Cart, Period, User as StaffUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One-tap book. Optional share via colleague avatar icons. */
export function BookDialog({
  cart,
  period,
  date,
  onClose,
}: {
  cart: Cart;
  period: Period;
  date: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const platform = usePlatformStore();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  /** null = just me; string = colleague id */
  const [shareWithId, setShareWithId] = useState<string | null>(null);

  const session = getSessionSnapshot();
  const isAdmin = session?.role === "admin";

  // All signed-in staff (teachers + admins) — not pending invites.
  // Share is available to every role that can book, not admin-only.
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
    const loads = (prefs.teachingAssignments ?? []).filter(isAssignmentComplete);
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
          {isAdmin ? (
            <div className="space-y-1.5">
              <label
                htmlFor="book-custom"
                className="text-[11px] font-medium tracking-[0.04em] text-neutral-400"
              >
                Custom
              </label>
              <Input
                id="book-custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Optional label"
                disabled={pending}
                autoComplete="off"
                className="h-9 rounded-lg border-neutral-200 bg-white text-[13px] tracking-[-0.01em] shadow-none placeholder:text-neutral-300"
              />
            </div>
          ) : null}

          {/* Share row for every role that can book — icon picker */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
              Share with
            </p>
            {colleagues.length > 0 ? (
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                            "mt-1 max-w-[2.75rem] truncate text-center text-[10px] font-medium leading-tight",
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
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                const formData = new FormData();
                formData.set("cartId", cart.id);
                formData.set("date", date);
                formData.set("period", period);
                const label = custom.trim();
                const subject = resolveSubject();
                if (isAdmin && label) {
                  formData.set("className", label);
                  formData.set("notes", label);
                } else if (subject) {
                  formData.set("subject", subject);
                  formData.set("className", subject);
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
                      title: selectedPartner
                        ? "Cart booked & shared"
                        : "Cart booked",
                      description: selectedPartner
                        ? `${cart.name} · ${period} · with ${selectedPartner.name}`
                        : `${cart.name} · ${period}`,
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
        "flex w-11 shrink-0 flex-col items-center outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2",
        "rounded-lg",
      )}
    >
      <span
        className={cn(
          "size-10 overflow-hidden rounded-full transition-[box-shadow,transform]",
          selected
            ? "ring-2 ring-neutral-950 ring-offset-2 ring-offset-white"
            : "ring-1 ring-black/[0.08]",
          "active:scale-[0.97]",
        )}
      >
        {face}
      </span>
      {caption ?? null}
    </button>
  );
}
