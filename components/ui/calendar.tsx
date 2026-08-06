"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Fixed day cell — 7 × 2.5rem = true month grid width. */
const DAY = "2.5rem";

function formatWeekdayName(date: Date) {
  const labels = ["S", "M", "T", "W", "T", "F", "S"] as const;
  return labels[date.getDay()] ?? "";
}

/**
 * Real month calendar (7 equal columns), corporate & minimal.
 * Fixed cell sizes — never collapses into a stacked date list.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  styles,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={0}
      className={cn(
        "rdp select-none bg-white p-4 text-neutral-950",
        // 7 days × 2.5rem + horizontal padding (p-4 × 2)
        "w-[calc(7*2.5rem+2rem)]",
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
        months: "flex w-full flex-col",
        month: "w-full space-y-3",
        caption: "relative flex h-8 w-full items-center justify-center",
        caption_label:
          "text-[13.5px] font-medium tracking-[-0.02em] text-neutral-950",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        nav_button: cn(
          "inline-flex size-7 items-center justify-center rounded-md",
          "text-neutral-400 motion-micro",
          "hover:bg-neutral-100 hover:text-neutral-950",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/12",
          "disabled:pointer-events-none disabled:opacity-30",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",
        // Flex + fixed cell width = calendar weeks, not a vertical stack.
        head_row: "flex w-full",
        head_cell: cn(
          "flex items-center justify-center",
          "text-[11px] font-medium tracking-[0.04em] text-neutral-400",
          "select-none",
        ),
        row: "mt-1 flex w-full",
        cell: cn(
          "relative p-0 text-center text-[13px]",
          "focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? [
                "[&:has(>.day-range-end)]:rounded-r-md",
                "[&:has(>.day-range-start)]:rounded-l-md",
                "first:[&:has([aria-selected])]:rounded-l-md",
                "last:[&:has([aria-selected])]:rounded-r-md",
                "[&:has([aria-selected])]:bg-neutral-100",
              ].join(" ")
            : "",
        ),
        day: cn(
          "inline-flex items-center justify-center rounded-full p-0",
          "text-[13px] font-normal tabular-nums tracking-tight text-neutral-800",
          "motion-micro",
          "hover:bg-neutral-100 hover:text-neutral-950",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/12",
          "aria-selected:opacity-100",
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-neutral-950 text-white shadow-sm",
          "hover:bg-neutral-900 hover:text-white",
          "focus:bg-neutral-950 focus:text-white",
          "aria-selected:bg-neutral-950 aria-selected:text-white",
        ),
        day_today: cn(
          "font-semibold text-neutral-950",
          "bg-neutral-100",
          "aria-selected:bg-neutral-950 aria-selected:text-white aria-selected:font-medium",
        ),
        day_outside: cn(
          "day-outside text-neutral-300",
          "aria-selected:bg-neutral-100 aria-selected:text-neutral-400",
        ),
        day_disabled: cn(
          "cursor-not-allowed text-neutral-300 opacity-40",
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
      styles={{
        head_cell: { width: DAY, height: "2rem", ...styles?.head_cell },
        cell: { width: DAY, height: DAY, ...styles?.cell },
        day: { width: DAY, height: DAY, ...styles?.day },
        ...styles,
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
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
