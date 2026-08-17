"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TextMorph } from "torph/react";

import * as AnimatedBorderButton from "@/components/ui/animated-border-button";
import SuccessIcon from "@/components/ui/icons/success";
import TrashIcon from "@/components/ui/icons/trash";
import { motionSafe } from "@/lib/motion/platform";
import { cn } from "@/lib/utils";

const GLYPH_TRANSITION = {
  type: "spring" as const,
  duration: 0.34,
  bounce: 0,
};

function CancelSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("animate-spin", className)}
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        className="opacity-25"
      />
      <path
        d="M13.5 8a5.5 5.5 0 0 0-5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

type AnimatedCancelButtonProps = {
  /** Async cancel / remove action. Return an error object to stay in idle state. */
  onConfirm: () => Promise<ActionResult>;
  /** Called after the success flash (e.g. close dialog, refresh). */
  onSuccess?: () => void;
  /** Called when the action returns an error string. */
  onError?: (message: string) => void;
  idleLabel?: string;
  successLabel?: string;
  size?: "medium" | "small" | "xsmall";
  className?: string;
  /** How long to show the success state before onSuccess (ms). */
  successHoldMs?: number;
};

/**
 * Destructive confirm control with Morphin-style animated dashed border
 * while the action runs, then a brief success flash.
 */
export function AnimatedCancelButton({
  onConfirm,
  onSuccess,
  onError,
  idleLabel = "Cancel",
  successLabel = "Canceled",
  size = "medium",
  className,
  successHoldMs = 900,
}: AnimatedCancelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    successTimer.current = setTimeout(() => {
      onSuccessRef.current?.();
    }, successHoldMs);
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [success, successHoldMs]);

  async function handleClick() {
    if (loading || success) return;

    setLoading(true);
    const started = Date.now();
    try {
      const res = await onConfirm();
      const remain = 1500 - (Date.now() - started);
      if (remain > 0) {
        await new Promise((resolve) => setTimeout(resolve, remain));
      }
      if (isErrorResult(res)) {
        onError?.(res.error);
        setLoading(false);
        return;
      }
      setLoading(false);
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not cancel booking.";
      onError?.(message);
      setLoading(false);
    }
  }

  const label = success ? successLabel : idleLabel;
  const glyphClass = size === "medium" ? "size-5" : "size-4";
  const phase = success ? "success" : loading ? "loading" : "idle";

  return (
    <AnimatedBorderButton.Root
      type="button"
      variant={success ? "success" : "error"}
      mode="animatedBorder"
      size={size}
      onClick={handleClick}
      animateBorder={loading}
      showAnimatedBorder={loading || success}
      animatedBorderStyle={loading ? "dashed" : "solid"}
      animatedBorderStrokeWidth={1}
      disabled={loading || success}
      className={cn("min-w-[7.5rem] disabled:opacity-100", className)}
      style={{
        transitionProperty: "color, background-color, border-color",
        transitionDuration: "320ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      aria-busy={loading}
      aria-live="polite"
      aria-label={
        success ? successLabel : loading ? "Canceling booking" : idleLabel
      }
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
          glyphClass,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={phase}
            className="inline-flex items-center justify-center will-change-transform"
            initial={{ opacity: 0, y: "-60%", filter: "blur(3px)" }}
            animate={{ opacity: 1, y: "0%", filter: "blur(0px)" }}
            exit={{ opacity: 0, y: "60%", filter: "blur(3px)" }}
            transition={motionSafe(GLYPH_TRANSITION)}
          >
            {loading ? (
              <CancelSpinner className={glyphClass} />
            ) : (
              <AnimatedBorderButton.Icon
                as={success ? SuccessIcon : TrashIcon}
                size={size}
                className={glyphClass}
                aria-hidden
              />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <TextMorph
        className="tabular-nums"
        duration={320}
        ease="cubic-bezier(0.16, 1, 0.3, 1)"
      >
        {label}
      </TextMorph>
    </AnimatedBorderButton.Root>
  );
}
