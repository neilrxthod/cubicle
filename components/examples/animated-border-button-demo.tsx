"use client";

/**
 * Standalone playground for the Morphin-style cancel control.
 * Product usage lives in `AnimatedCancelButton` (manage booking + my bookings).
 */
import { AnimatedCancelButton } from "@/components/animated-cancel-button";

export default function AnimatedBorderButtonDemo() {
  return (
    <section className="flex min-h-[12rem] items-center justify-center gap-4 px-6">
      <AnimatedCancelButton
        idleLabel="Remove"
        successLabel="Success"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 2000));
          return { ok: true as const };
        }}
      />
    </section>
  );
}
