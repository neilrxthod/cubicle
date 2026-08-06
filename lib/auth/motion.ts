import type { Variants } from "motion/react";
import {
  DURATION_FAST,
  DURATION_MICRO,
  EASE_OUT_EXPO,
} from "@/lib/motion/platform";

/**
 * Auth screens — short stagger, tween only (no spring bounce/lag).
 */
export const authContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
      duration: DURATION_MICRO,
      ease: EASE_OUT_EXPO,
    },
  },
};

export const authItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION_FAST,
      ease: EASE_OUT_EXPO,
    },
  },
};
