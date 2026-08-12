"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Shared popover chrome for date pickers — stays inside the viewport
 * (horizontal month grid, never a tall clipped panel).
 */
export const calendarPopoverClassName = cn(
  "z-[60] w-auto max-w-[min(20.5rem,calc(100vw-1.25rem))] overflow-hidden p-0",
  "rounded-2xl border border-black/[0.08] bg-white",
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.1)]",
);

function formatWeekdayName(date: Date) {
  const labels = ["S", "M", "T", "W", "T", "F", "S"] as const;
  return labels[date.getDay()] ?? "";
}

/**
 * Horizontal month calendar: 7 equal fluid columns.
 * Scales with the container (and viewport) instead of a fixed vertical stack.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={0}
      className={cn(
        "rdp cubicle-calendar select-none bg-white text-neutral-950",
        // Fluid width: fills popover up to a comfortable month width.
        "w-full min-w-0 max-w-[min(20rem,calc(100vw-2rem))]",
        "p-3 sm:p-3.5",
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
        month: "w-full min-w-0 space-y-2.5 sm:space-y-3",
        caption:
          "relative flex h-8 w-full items-center justify-center px-9 sm:px-10",
        caption_label:
          "truncate text-[13px] font-medium tracking-[-0.02em] text-neutral-950 sm:text-[13.5px]",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        nav_button: cn(
          "inline-flex size-7 items-center justify-center rounded-full",
          "text-neutral-400",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "hover:bg-neutral-100 hover:text-neutral-950",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
          "disabled:pointer-events-none disabled:opacity-30",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full min-w-0 border-collapse",
        // CSS grid in globals keeps weeks horizontal at every width.
        head_row: "w-full",
        head_cell: cn(
          "text-center text-[10.5px] font-medium tracking-[0.06em] text-neutral-400",
          "select-none sm:text-[11px]",
        ),
        row: "w-full",
        cell: cn(
          "relative p-0 text-center text-[13px]",
          "focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? [
                "[&:has(>.day-range-end)]:rounded-r-full",
                "[&:has(>.day-range-start)]:rounded-l-full",
                "first:[&:has([aria-selected])]:rounded-l-full",
                "last:[&:has([aria-selected])]:rounded-r-full",
                "[&:has([aria-selected])]:bg-neutral-100",
              ].join(" ")
            : "",
        ),
        day: cn(
          "inline-flex items-center justify-center rounded-full p-0",
          "text-[12.5px] font-normal tabular-nums tracking-tight text-neutral-800 sm:text-[13px]",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "hover:bg-neutral-100 hover:text-neutral-950",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
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
