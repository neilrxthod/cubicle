"use client";

import { PERIODS } from "@/lib/cubicle/periods";
import type { CartDayView } from "@/lib/cubicle/selectors";
import { CartStatusBadge, SlotChip } from "./status";
import { cn } from "@/lib/utils";

export function ScheduleGrid({
  views,
  date,
  interactive = false,
  selectedCartId,
  selectedPeriodId,
  onSelect,
}: {
  views: CartDayView[];
  date: string;
  interactive?: boolean;
  selectedCartId?: string;
  selectedPeriodId?: number;
  onSelect?: (cartId: string, periodId: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-black/[0.05]">
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-[12px] font-medium text-neutral-400">
              Cart
            </th>
            {PERIODS.map((period) => (
              <th
                key={period.id}
                className="px-2 py-3 text-center text-[11.5px] font-medium text-neutral-400"
              >
                <div>P{period.id}</div>
                <div className="mt-0.5 font-normal text-neutral-300">
                  {period.start}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {views.map(({ cart, periods }) => (
            <tr
              key={cart.id}
              className="border-b border-black/[0.04] last:border-0"
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-3">
                <div className="min-w-[140px]">
                  <p className="text-[13.5px] font-medium tracking-[-0.01em] text-neutral-950">
                    {cart.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-neutral-400">
                    {cart.location} · {cart.laptopCount}
                  </p>
                  <div className="mt-1.5">
                    <CartStatusBadge status={cart.status} />
                  </div>
                </div>
              </td>
              {periods.map((slot) => {
                const selected =
                  selectedCartId === cart.id &&
                  selectedPeriodId === slot.periodId;
                const canSelect =
                  interactive && slot.status === "available" && onSelect;

                return (
                  <td key={slot.periodId} className="px-1.5 py-2 text-center">
                    {canSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(cart.id, slot.periodId)}
                        className={cn(
                          "mx-auto flex h-9 w-full max-w-[3.25rem] items-center justify-center rounded-lg text-[11px] font-medium transition-all",
                          selected
                            ? "bg-neutral-950 text-white"
                            : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100",
                        )}
                        title={`Book ${cart.name} · Period ${slot.periodId}`}
                      >
                        {selected ? "✓" : "Free"}
                      </button>
                    ) : slot.status === "booked" && slot.booking ? (
                      <div
                        className="mx-auto max-w-[4.5rem] rounded-lg bg-neutral-100 px-1.5 py-1.5"
                        title={`${slot.booking.teacherName} · ${slot.booking.className}`}
                      >
                        <p className="truncate text-[10.5px] font-medium text-neutral-700">
                          {slot.booking.teacherName.split(" ").slice(-1)[0]}
                        </p>
                        <p className="truncate text-[10px] text-neutral-400">
                          {slot.booking.className}
                        </p>
                      </div>
                    ) : (
                      <SlotChip status={slot.status} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-black/[0.04] px-4 py-3 text-[12px] text-neutral-400">
        {date}
        {interactive ? " · Tap a free slot to select" : " · Live occupancy"}
      </p>
    </div>
  );
}
