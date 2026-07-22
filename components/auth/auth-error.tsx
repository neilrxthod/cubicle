"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Quiet auth error — fade + slight rise, no heavy chrome.
 */
export function AuthError({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, y: -4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "text-center text-[12.5px] font-medium leading-snug tracking-[-0.01em] text-red-600",
            className,
          )}
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Subtle horizontal shake for invalid legal / form fields.
 * Pass a new `shakeKey` each time you want to re-trigger.
 */
export function AuthShake({
  active,
  shakeKey,
  children,
  className,
}: {
  active: boolean;
  shakeKey: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      key={active ? `shake-${shakeKey}` : "steady"}
      className={className}
      initial={false}
      animate={
        active
          ? {
              x: [0, -6, 5, -3, 2, 0],
              transition: { duration: 0.38, ease: "easeOut" },
            }
          : { x: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
