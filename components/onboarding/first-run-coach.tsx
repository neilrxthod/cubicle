"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import {
  dismissFirstRunCoach,
  shouldShowFirstRunCoach,
} from "@/lib/onboarding/storage";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One-time post-onboarding tip on the schedule board.
 * Triggered by firstRun=1 or stored first-run flag.
 */
export function FirstRunCoach({ user }: { user: SessionUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("firstRun") === "1";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const keys = [user.id, user.email];
    const stored = shouldShowFirstRunCoach(...keys);
    if (fromQuery || stored) {
      setOpen(true);
      if (fromQuery && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("firstRun");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    }
  }, [fromQuery, user.id, user.email, router]);

  function dismiss() {
    dismissFirstRunCoach(user.id, user.email);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.05)]",
        )}
        role="status"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <p className="min-w-0 flex-1 text-[13.5px] font-light tracking-[-0.02em] text-neutral-950">
            {user.role === "admin"
              ? "Workspace ready"
              : "Tap a free slot to book"}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Dismiss"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
