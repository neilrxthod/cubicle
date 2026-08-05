"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
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
import { toast } from "@/hooks/use-toast";
import type { Cart, Period } from "@/lib/types";

/** One-tap book. Subject comes from onboarding loads for this period.
 *  Admins get an optional Custom label field. */
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const session = getSessionSnapshot();
  const isAdmin = session?.role === "admin";

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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-xs">
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Book {cart.name}?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-neutral-400">
            {period}
            <span className="text-neutral-300"> · </span>
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 pb-5 pt-4">
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

          {error ? (
            <p className="text-[12.5px] text-red-600">{error}</p>
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
                  toast({
                    title: "Cart booked",
                    description: `${cart.name} · ${period}`,
                  });
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
