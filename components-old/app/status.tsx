import { cn } from "@/lib/utils";
import type { CartStatus, IssueSeverity, IssueStatus } from "@/lib/cubicle/types";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium tracking-[-0.01em]";

export function Dot({ className }: { className?: string }) {
  return (
    <span className={cn("size-1.5 shrink-0 rounded-full", className)} />
  );
}

export function CartStatusBadge({ status }: { status: CartStatus }) {
  if (status === "ready") {
    return (
      <span className={cn(base, "bg-emerald-50 text-emerald-800")}>
        <Dot className="bg-emerald-500" />
        Ready
      </span>
    );
  }
  if (status === "maintenance") {
    return (
      <span className={cn(base, "bg-amber-50 text-amber-900")}>
        <Dot className="bg-amber-500" />
        Maintenance
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-neutral-100 text-neutral-600")}>
      <Dot className="bg-neutral-400" />
      Offline
    </span>
  );
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  if (status === "open") {
    return (
      <span className={cn(base, "bg-red-50 text-red-800")}>
        <Dot className="bg-red-500" />
        Open
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className={cn(base, "bg-amber-50 text-amber-900")}>
        <Dot className="bg-amber-500" />
        In progress
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-neutral-100 text-neutral-600")}>
      <Dot className="bg-neutral-400" />
      Resolved
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  if (severity === "high") {
    return (
      <span className={cn(base, "bg-red-50 text-red-800")}>High</span>
    );
  }
  if (severity === "medium") {
    return (
      <span className={cn(base, "bg-amber-50 text-amber-900")}>Medium</span>
    );
  }
  return (
    <span className={cn(base, "bg-neutral-100 text-neutral-600")}>Low</span>
  );
}

export function SlotChip({
  status,
}: {
  status: "available" | "booked" | "unavailable";
}) {
  if (status === "available") {
    return (
      <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md bg-emerald-50 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100">
        Free
      </span>
    );
  }
  if (status === "booked") {
    return (
      <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md bg-neutral-100 text-[11px] font-medium text-neutral-600 ring-1 ring-black/[0.04]">
        Busy
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md bg-neutral-50 text-[11px] font-medium text-neutral-400 ring-1 ring-black/[0.03]">
      —
    </span>
  );
}
