"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TextMorph } from "torph/react";

import * as AnimatedBorderButton from "@/components/ui/animated-border-button";
import SuccessIcon from "@/components/ui/icons/success";
import TrashIcon from "@/components/ui/icons/trash";
import { cn } from "@/lib/utils";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string }
  | { error?: string }
  | void
  | null;

function isErrorResult(res: ActionResult): res is { error: string } {
  if (!res || typeof res !== "object") return false;
  if ("ok" in res && res.ok === false && "error" in res && res.error) {
    return true;
  }
  if ("error" in res && typeof res.error === "string" && res.error) {
    return true;
  }
  return false;
}

type Phase = "idle" | "armed" | "loading" | "success";

const EASE = [0.22, 1, 0.36, 1] as const;

type IssueDeleteButtonProps = {
  onConfirm: () => Promise<ActionResult>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
  /** Auto-collapse armed state if unused (ms). */
  armTimeoutMs?: number;
  successHoldMs?: number;
};

/**
 * Two-step destructive control: Delete → Confirm delete.
 * Corporate, minimal motion with Morphin-style border while deleting.
 */
export function IssueDeleteButton({
  onConfirm,
  onSuccess,
  onError,
  disabled = false,
  className,
  armTimeoutMs = 4500,
  successHoldMs = 720,
}: IssueDeleteButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "armed") return;
    armTimer.current = setTimeout(() => setPhase("idle"), armTimeoutMs);
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, [phase, armTimeoutMs]);

  useEffect(() => {
    if (phase !== "success") return;
    successTimer.current = setTimeout(() => {
      onSuccessRef.current?.();
    }, successHoldMs);
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [phase, successHoldMs]);

  function clearArmTimer() {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  }

  function arm() {
    if (disabled || phase !== "idle") return;
    setPhase("armed");
  }

  function disarm() {
    if (phase !== "armed") return;
    clearArmTimer();
    setPhase("idle");
  }

  async function confirm() {
    if (disabled || phase !== "armed") return;
    clearArmTimer();
    setPhase("loading");
    try {
      const res = await onConfirm();
      if (isErrorResult(res)) {
        onError?.(res.error);
        setPhase("idle");
        return;
      }
      setPhase("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not delete issue.";
      onError?.(message);
      setPhase("idle");
    }
  }

  const locked = phase === "loading" || phase === "success" || disabled;

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center justify-end",
        className,
      )}
      data-phase={phase}
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" ? (
          <motion.button
            key="idle"
            type="button"
            disabled={locked}
            onClick={arm}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: EASE }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200/90 bg-white",
              "px-2.5 text-[12.5px] font-medium tracking-[-0.01em] text-neutral-500",
              "shadow-none transition-[color,background-color,border-color,box-shadow] duration-150",
              "hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <TrashIcon className="size-3.5 opacity-70" />
            <span>Delete</span>
          </motion.button>
        ) : null}

        {phase === "armed" ? (
          <motion.div
            key="armed"
            role="group"
            aria-label="Confirm delete"
            initial={{ opacity: 0, scale: 0.96, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            transition={{ duration: 0.18, ease: EASE }}
            className={cn(
              "inline-flex h-8 items-center overflow-hidden rounded-md",
              "border border-neutral-200/90 bg-neutral-50/80",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
            )}
          >
            <button
              type="button"
              onClick={disarm}
              className={cn(
                "h-full px-2.5 text-[12.5px] font-medium tracking-[-0.01em] text-neutral-500",
                "transition-colors duration-150 hover:bg-white hover:text-neutral-800",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/10",
              )}
            >
              Keep
            </button>
            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-neutral-200/90"
            />
            <button
              type="button"
              onClick={() => void confirm()}
              className={cn(
                "inline-flex h-full items-center gap-1.5 px-2.5",
                "text-[12.5px] font-medium tracking-[-0.01em] text-red-600",
                "transition-colors duration-150 hover:bg-red-50/90 hover:text-red-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600/15",
              )}
            >
              <TrashIcon className="size-3.5" />
              <span>Confirm</span>
            </button>
          </motion.div>
        ) : null}

        {phase === "loading" || phase === "success" ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: EASE }}
          >
            <AnimatedBorderButton.Root
              type="button"
              variant={phase === "success" ? "success" : "error"}
              mode="animatedBorder"
              size="xsmall"
              disabled
              animateBorder={phase === "loading"}
              showAnimatedBorder
              animatedBorderStyle={phase === "loading" ? "dashed" : "solid"}
              animatedBorderStrokeWidth={1.5}
              className={cn(
                "min-w-[6.75rem] rounded-md !text-[12.5px] font-medium tracking-[-0.01em]",
                phase === "loading" &&
                  "bg-white text-neutral-600 hover:bg-white",
                phase === "success" &&
                  "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
              )}
              aria-busy={phase === "loading"}
              aria-live="polite"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.9 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  className="inline-flex"
                >
                  <AnimatedBorderButton.Icon
                    as={phase === "success" ? SuccessIcon : TrashIcon}
                    size="xsmall"
                    className="size-3.5"
                    aria-hidden
                  />
                </motion.div>
              </AnimatePresence>
              <TextMorph className="tabular-nums">
                {phase === "success" ? "Deleted" : "Deleting…"}
              </TextMorph>
            </AnimatedBorderButton.Root>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
