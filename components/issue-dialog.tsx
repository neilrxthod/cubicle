"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportIssue } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Cart } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES = ["low", "medium", "high"] as const;

/** Dialog panel is instant (no exit animation). */
const CLOSE_MS = 0;

/** Minimal report sheet — title, two fields, actions. */
export function IssueDialog({
  cart,
  carts,
  onClose,
}: {
  cart?: Cart | null;
  carts?: Cart[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] =
    useState<(typeof SEVERITIES)[number]>("medium");
  const [cartId, setCartId] = useState(cart?.id ?? carts?.[0]?.id ?? "");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCart =
    cart ?? carts?.find((entry) => entry.id === cartId) ?? null;
  const canPickCart = !cart && Boolean(carts?.length);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function requestClose() {
    if (!open) return;
    setOpen(false);
    if (CLOSE_MS <= 0) {
      onClose();
      return;
    }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
    }, CLOSE_MS);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="w-[min(100%,20rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-surface)] sm:max-w-xs"
      >
        <DialogHeader className="space-y-0 px-5 pt-5 pb-0 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Report issue
          </DialogTitle>
          <DialogDescription className="sr-only">
            High severity places the cart in maintenance.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4 px-5 pt-3 pb-5"
          action={(formData) => {
            setError(null);
            const id = cart?.id ?? cartId;
            if (!id) {
              setError("Select a cart.");
              return;
            }
            formData.set("cartId", id);
            formData.set("severity", severity);
            startTransition(async () => {
              const res = await reportIssue(formData);
              if (res && "error" in res && res.error) {
                setError(res.error);
                return;
              }
              toast({
                title: "Issue reported",
                description: selectedCart?.name,
              });
              router.refresh();
              requestClose();
            });
          }}
        >
          {canPickCart ? (
            <select
              value={cartId}
              onChange={(e) => setCartId(e.target.value)}
              aria-label="Cart"
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-950 outline-none focus:border-neutral-400"
            >
              {carts?.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex rounded-lg bg-neutral-100 p-0.5">
            {SEVERITIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSeverity(level)}
                className={cn(
                  "h-8 flex-1 rounded-md text-[12.5px] font-medium capitalize transition-colors",
                  severity === level
                    ? level === "high"
                      ? "bg-red-600 text-white"
                      : "bg-white text-neutral-950 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {level}
              </button>
            ))}
          </div>

          <textarea
            name="description"
            rows={3}
            required
            aria-label="Description"
            placeholder="Describe the problem"
            className="min-h-[5rem] w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />

          {error ? (
            <p role="alert" className="text-[12.5px] text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            <DialogCancel onClick={requestClose}>Cancel</DialogCancel>
            <button
              type="submit"
              disabled={pending || !(cart?.id ?? cartId)}
              className="h-9 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              {pending ? "Sending…" : "Report"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
