/**
 * Platform motion presets — short, GPU-friendly, freeze-resistant.
 * Prefer opacity + transform only. Avoid layout animations on large lists.
 */

import type { Transition, Variants } from "motion/react";

/** Standard product ease (Apple / Linear style). */
export const EASE_OUT_EXPO: [number, number, number, number] = [
  0.16, 1, 0.3, 1,
];

/** Slightly softer for hover / color. */
export const EASE_OUT_SOFT: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

/** Micro UI (toggles, icon swaps) */
export const DURATION_MICRO = 0.12;
/** Controls / cards enter */
export const DURATION_FAST = 0.16;
/** Dialogs / panels */
export const DURATION_PANEL = 0.18;

export const transitionMicro: Transition = {
  duration: DURATION_MICRO,
  ease: EASE_OUT_EXPO,
};

export const transitionFast: Transition = {
  duration: DURATION_FAST,
  ease: EASE_OUT_EXPO,
};

export const transitionPanel: Transition = {
  duration: DURATION_PANEL,
  ease: EASE_OUT_EXPO,
};

/** Fade + tiny rise — no scale layout thrash. */
export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
};

/** Fade only — safest for dense grids. */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Whether the user prefers reduced motion (client only). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Instant transition when reduced motion is on. */
export function motionSafe(
  transition: Transition = transitionFast,
): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0 };
  }
  return transition;
}
