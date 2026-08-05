"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function formatWeekdayName(date: Date) {
  const labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
  return labels[date.getDay()] ?? "";
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={0}
      className={cn(
        // Landscape sheet: wide, low height — fills parent width.
        "w-full min-w-0 max-w-full select-none bg-white px-2.5 py-2 text-neutral-950 sm:px-3 sm:py-2.5",
        className,
      )}
      formatters={{
        formatWeekdayName,
        formatCaption: (date) =>
          date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
        ...formatters,
      }}
      classNames={{
        months: "flex w-full min-w-0 flex-col",
        month: "flex w-full min-w-0 flex-col gap-1.5",
        caption: "relative flex h-8 items-center justify-center px-8",
        caption_label:
          "truncate text-[13px] font-medium tracking-[-0.02em] text-neutral-950",
        nav: "absolute inset-x-0 flex items-center justify-between",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 shrink-0 rounded-md bg-transparent p-0 text-neutral-400",
          "transition-colors hover:bg-black/[0.04] hover:text-neutral-950",
          "focus-visible:ring-1 focus-visible:ring-black/10",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        table: "w-full min-w-0 border-collapse",
        head_row: "mb-0.5 flex w-full min-w-0 gap-0.5",
        head_cell: cn(
          "flex h-6 min-w-0 flex-1 items-center justify-center",
          "text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400",
          "select-none",
        ),
        row: "mt-0.5 flex w-full min-w-0 gap-0.5",
        cell: cn(
          // Wide short cells → horizontal rectangular grid.
          "relative h-8 min-w-0 flex-1 p-0 text-center text-sm sm:h-9",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-neutral-100",
          "[&:has([aria-selected].day-outside)]:bg-neutral-50",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          // Fill the wide cell as a short rectangle (not a circle).
          "h-full w-full rounded-md p-0 font-normal tabular-nums tracking-tight",
          "text-[12px] text-neutral-800 aria-selected:opacity-100 sm:text-[13px]",
          "hover:bg-black/[0.05] hover:text-neutral-950",
          "focus-visible:bg-black/[0.05] focus-visible:ring-1 focus-visible:ring-black/10",
          "transition-colors duration-150",
        ),
        day_range_start: "day-range-start rounded-md",
        day_range_end: "day-range-end rounded-md",
        day_selected: cn(
          "bg-neutral-950 text-white",
          "hover:bg-neutral-900 hover:text-white",
          "focus:bg-neutral-950 focus:text-white",
          "aria-selected:bg-neutral-950 aria-selected:text-white",
        ),
        day_today: cn(
          "relative font-medium text-neutral-950",
          "bg-neutral-100",
          "ring-1 ring-inset ring-neutral-300",
          "aria-selected:bg-neutral-950 aria-selected:text-white",
          "aria-selected:ring-0",
        ),
        day_outside: cn(
          "day-outside text-neutral-300",
          "aria-selected:bg-neutral-100 aria-selected:text-neutral-400",
        ),
        day_disabled: cn(
          "text-neutral-300 opacity-40",
          "hover:bg-transparent hover:text-neutral-300",
        ),
        day_range_middle: cn(
          "aria-selected:rounded-none",
          "aria-selected:bg-neutral-100",
          "aria-selected:text-neutral-950",
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: iconClassName, ...iconProps }) => (
          <ChevronLeft
            className={cn("size-4", iconClassName)}
            strokeWidth={1.75}
            {...iconProps}
          />
        ),
        IconRight: ({ className: iconClassName, ...iconProps }) => (
          <ChevronRight
            className={cn("size-4", iconClassName)}
            strokeWidth={1.75}
            {...iconProps}
          />
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
