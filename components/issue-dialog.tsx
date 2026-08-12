"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportIssue } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Cart } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES = ["low", "medium", "high"] as const;
type Severity = (typeof SEVERITIES)[number];

/** Corporate triage tones — thumb fill + idle label. */
const SEVERITY_TONE: Record<
  Severity,
  { thumb: string; activeText: string; idleText: string }
> = {
  low: {
    thumb: "bg-emerald-600",
    activeText: "text-white",
    idleText: "text-neutral-500 hover:text-emerald-800",
  },
  medium: {
    thumb: "bg-amber-500",
    activeText: "text-white",
    idleText: "text-neutral-500 hover:text-amber-800",
  },
  high: {
    thumb: "bg-red-600",
    activeText: "text-white",
    idleText: "text-neutral-500 hover:text-red-700",
  },
};

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
            <Select
              value={cartId}
              onValueChange={(value) => {
                if (value) setCartId(value);
              }}
            >
              <SelectTrigger
                aria-label="Cart"
                size="default"
                className={cn(
                  "h-9 w-full rounded-lg border-neutral-200 bg-white px-3",
                  "text-[13px] font-medium text-neutral-950 shadow-none",
                  "data-[size=default]:h-9",
                  "focus-visible:border-neutral-400",
                )}
              >
                <SelectValue placeholder="Select cart" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={6}
                className={cn(
                  "z-[80] max-h-56 w-[var(--radix-select-trigger-width)]",
                  "overflow-hidden rounded-xl border border-neutral-200/90 bg-white p-0",
                  "shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]",
                  // Snappy corporate open/close (overrides global if needed)
                  "data-[state=open]:animate-in data-[state=closed]:animate-out",
                  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                  "data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]",
                  "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
                  "duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                )}
              >
                {carts?.map((entry) => (
                  <SelectItem
                    key={entry.id}
                    value={entry.id}
                    className={cn(
                      "cursor-pointer rounded-lg py-2 pl-3 pr-8 text-[13px] font-medium",
                      "focus:bg-neutral-100 focus:text-neutral-950",
                    )}
                  >
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <SeveritySlider value={severity} onChange={setSeverity} />

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

/**
 * Corporate severity control — segmented track with a sliding color thumb.
 * Low (green) · Medium (amber) · High (red).
 */
function SeveritySlider({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (next: Severity) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-0.5 text-[11px] font-medium tracking-[0.06em] text-neutral-400 uppercase">
        Severity
      </span>
      <div
        role="radiogroup"
        aria-label="Severity"
        className={cn(
          "grid grid-cols-3 gap-0.5 rounded-full p-1",
          "border border-neutral-200/80 bg-neutral-100/90",
        )}
      >
        {SEVERITIES.map((level) => {
          const selected = value === level;
          const tone = SEVERITY_TONE[level];
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(level)}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-full",
                "text-[12.5px] font-medium capitalize tracking-[-0.01em]",
                "outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                selected ? tone.activeText : tone.idleText,
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="issue-severity-thumb"
                  className={cn(
                    "absolute inset-0 z-0 rounded-full",
                    "shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.12)]",
                    tone.thumb,
                  )}
                  transition={{
                    type: "spring",
                    stiffness: 440,
                    damping: 36,
                    mass: 0.65,
                  }}
                />
              ) : null}
              <span className="relative z-[1]">{level}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
