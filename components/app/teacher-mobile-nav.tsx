"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * iOS-style top bar — back on the left, title optically centered.
 */
export function TeacherMobileNav({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-11 items-center justify-between bg-[#f2f2f7] px-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-w-[4.5rem] items-center gap-0.5 rounded-full py-1 pr-2 text-[17px] font-medium tracking-[-0.02em] text-neutral-950"
      >
        <ChevronLeft className="size-5" strokeWidth={2.25} />
        Back
      </button>
      <h1 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">
        {title}
      </h1>
      <div className={cn("flex min-w-[4.5rem] justify-end", !trailing && "opacity-0")}>
        {trailing ?? <span aria-hidden>Back</span>}
      </div>
    </header>
  );
}
