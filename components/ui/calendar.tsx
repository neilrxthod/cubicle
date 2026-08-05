"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { DayPicker, type DayContentProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /**
   * When set, the selected day shows a pencil control on the date number.
   * Used by admins to edit booking locks for that day.
   */
  onEditDay?: (date: Date) => void;
};

/**
 * Classic calendar weekday labels: Su Mo Tu We Th Fr Sa
 * (real wall / desk calendar format, week starts Sunday).
 */
function formatWeekdayName(date: Date) {
  const labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
  return labels[date.getDay()] ?? "";
}

function DayNumber({
  date,
  activeModifiers,
  onEditDay,
}: DayContentProps & { onEditDay?: (date: Date) => void }) {
  const dayNum = date.getDate();
  const selected = Boolean(activeModifiers.selected);
  const isToday = Boolean(activeModifiers.today);

  return (
    <span
      className={cn(
        "relative flex h-full w-full flex-col items-start p-1",
        "text-left",
      )}
    >
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center",
          "text-[12px] leading-none tabular-nums tracking-tight",
          isToday && !selected && "font-semibold",
        )}
      >
        {dayNum}
      </span>

      {selected && onEditDay ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Edit locks for ${date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}`}
          title="Edit day locks"
          className={cn(
            "absolute right-0.5 top-0.5 z-10",
            "flex size-4 items-center justify-center rounded-sm",
            "bg-white text-neutral-950 ring-1 ring-neutral-950/20",
            "transition-colors hover:bg-neutral-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditDay(date);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onEditDay(date);
            }
          }}
        >
          <Pencil className="size-2.5" strokeWidth={2.25} />
        </span>
      ) : null}
    </span>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  modifiers,
  modifiersClassNames,
  onEditDay,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={0}
      className={cn(
        "w-[min(100%,18.5rem)] select-none bg-white p-0 text-neutral-950",
        className,
      )}
      formatters={{
        formatWeekdayName,
        formatCaption: (date) =>
          date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
        formatDay: (date) => String(date.getDate()),
        ...formatters,
      }}
      modifiers={{
        weekend: { dayOfWeek: [0, 6] },
        ...modifiers,
      }}
      modifiersClassNames={{
        weekend:
          "text-neutral-500 aria-selected:text-white aria-selected:hover:text-white",
        ...modifiersClassNames,
      }}
      classNames={{
        months: "flex flex-col",
        month: "w-full space-y-0",
        /* Month bar — classic calendar title strip */
        caption: cn(
          "relative flex h-11 items-center justify-center",
          "border-b border-neutral-200 bg-neutral-50/80 px-10",
        ),
        caption_label:
          "text-[13px] font-semibold tracking-[-0.02em] text-neutral-950",
        nav: "absolute inset-x-0 flex items-center justify-between px-1.5",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 shrink-0 rounded-md bg-transparent p-0",
          "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950",
          "transition-colors",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        /* Full calendar grid */
        table: "w-full border-collapse",
        head_row: "flex w-full border-b border-neutral-200",
        head_cell: cn(
          "flex h-8 flex-1 items-center justify-center",
          "border-r border-neutral-100 last:border-r-0",
          "bg-white text-[10px] font-semibold uppercase tracking-[0.12em]",
          "text-neutral-500 select-none",
        ),
        row: "flex w-full border-b border-neutral-100 last:border-b-0",
        cell: cn(
          "relative h-10 flex-1 p-0 text-center",
          "border-r border-neutral-100 last:border-r-0",
          "focus-within:relative focus-within:z-20",
          /* Range selection fills contiguous cells */
          "[&:has([aria-selected])]:bg-neutral-100",
          "[&:has([aria-selected].day-outside)]:bg-neutral-50",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:bg-neutral-100 [&:has(>.day-range-start)]:bg-neutral-100"
            : undefined,
        ),
        day: cn(
          /* Full cell hit target — real calendar squares, not pill buttons */
          "flex h-10 w-full items-stretch justify-stretch rounded-none border-0 bg-transparent p-0",
          "font-normal text-neutral-800 aria-selected:opacity-100",
          "hover:bg-neutral-100 hover:text-neutral-950",
          "focus-visible:bg-neutral-100 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-40",
          "transition-colors",
          onEditDay && "aria-selected:overflow-visible",
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-neutral-950 text-white",
          "hover:bg-neutral-900 hover:text-white",
          "focus:bg-neutral-950 focus:text-white",
          "aria-selected:bg-neutral-950 aria-selected:text-white",
        ),
        day_today: cn(
          "bg-white font-semibold text-neutral-950",
          /* Today marker: solid top rule like a desk calendar */
          "shadow-[inset_0_2px_0_0_#0a0a0a]",
          "aria-selected:bg-neutral-950 aria-selected:text-white",
          "aria-selected:shadow-none",
        ),
        day_outside: cn(
          "day-outside text-neutral-300",
          "aria-selected:bg-neutral-200 aria-selected:text-neutral-500",
        ),
        day_disabled: cn(
          "text-neutral-300 opacity-50",
          "hover:bg-transparent hover:text-neutral-300",
        ),
        day_range_middle: cn(
          "aria-selected:bg-neutral-100",
          "aria-selected:text-neutral-950",
          "aria-selected:rounded-none",
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: iconClassName, ...iconProps }) => (
          <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        ),
        IconRight: ({ className: iconClassName, ...iconProps }) => (
          <ChevronRight
            className={cn("h-4 w-4", iconClassName)}
            {...iconProps}
          />
        ),
        DayContent: (dayProps: DayContentProps) => (
          <DayNumber {...dayProps} onEditDay={onEditDay} />
        ),
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
