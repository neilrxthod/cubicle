"use client";

import { useEffect, useRef, useState } from "react";
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

type IssueDeleteButtonProps = {
  onConfirm: () => Promise<ActionResult>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
  /** Auto-reset confirm step if unused (ms). */
  armTimeoutMs?: number;
};

const btn =
  "h-7 rounded-md px-2 text-[12.5px] font-medium tracking-[-0.01em] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 disabled:pointer-events-none disabled:opacity-40";

/**
 * Two-step delete: Delete → Confirm. No icons, no chrome.
 */
export function IssueDeleteButton({
  onConfirm,
  onSuccess,
  onError,
  disabled = false,
  className,
  armTimeoutMs = 4000,
}: IssueDeleteButtonProps) {
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!armed || loading) return;
    armTimer.current = setTimeout(() => setArmed(false), armTimeoutMs);
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, [armed, loading, armTimeoutMs]);

  function cancel() {
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(false);
  }

  async function runDelete() {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const res = await onConfirm();
      if (isErrorResult(res)) {
        onError?.(res.error);
        setArmed(false);
        return;
      }
      onSuccess?.();
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Could not delete issue.",
      );
      setArmed(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center px-2 text-[12.5px] text-neutral-400",
          className,
        )}
      >
        Deleting…
      </span>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={cn(
          btn,
          "text-neutral-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100/80",
          className,
        )}
      >
        Delete
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={cancel}
        className={cn(
          btn,
          "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
        )}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void runDelete()}
        className={cn(
          btn,
          "text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100/80",
          "focus-visible:ring-red-600/15",
        )}
      >
        Confirm
      </button>
    </div>
  );
}
