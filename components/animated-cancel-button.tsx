"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TextMorph } from "torph/react";

import * as AnimatedBorderButton from "@/components/ui/animated-border-button";
import SuccessIcon from "@/components/ui/icons/success";
import TrashIcon from "@/components/ui/icons/trash";
import { Spinner } from "@/components/ui/spinner";
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
      disabled={loading || success}
      className={cn("min-w-[7.5rem]", className)}
      aria-busy={loading}
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={success ? "success" : "cancel"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatedBorderButton.Icon
            as={success ? SuccessIcon : TrashIcon}
            size={size}
            className={cn(size === "medium" ? "size-5" : "size-4")}
            aria-hidden
          />
        </motion.div>
      </AnimatePresence>
      {loading ? (
        <Spinner className="size-3.5" />
      ) : (
        <TextMorph className="tabular-nums">{label}</TextMorph>
      )}
    </AnimatedBorderButton.Root>
  );
}
