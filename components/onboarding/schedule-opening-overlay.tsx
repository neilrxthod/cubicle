"use client";

import { motion } from "motion/react";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { EASE_OUT_EXPO } from "@/lib/motion/platform";

/** Visible opening beat. Bar finishes before this. */
export const OPEN_HOLD_MS = 800;
/** Never stay on setup longer than this after Open schedule. */
export const OPEN_DEADLINE_MS = 2000;

const BAR_DURATION_S = 0.62;
const BAR_DELAY_S = 0.05;

/**
 * Opening beat after setup.
 * `play` fills the bar. `play={false}` holds the finished frame
 * so the next route does not flash a spinner.
 */
export function ScheduleOpeningOverlay({ play = true }: { play?: boolean }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Opening your schedule"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#f4f4f5]"
      initial={play ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={play ? { opacity: 0 } : undefined}
      transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
    >
      <div className="flex flex-col items-center gap-8">
        <motion.div
          initial={play ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO, delay: 0.02 }}
        >
          <CubicleWordmark size="lg" href={null} />
        </motion.div>
        <div className="h-[2px] w-28 overflow-hidden rounded-full bg-neutral-200">
          <motion.div
            className="h-full w-full origin-left rounded-full bg-neutral-950"
            initial={play ? { scaleX: 0 } : false}
            animate={{ scaleX: 1 }}
            transition={
              play
                ? {
                    duration: BAR_DURATION_S,
                    ease: EASE_OUT_EXPO,
                    delay: BAR_DELAY_S,
                  }
                : { duration: 0 }
            }
          />
        </div>
      </div>
    </motion.div>
  );
}
