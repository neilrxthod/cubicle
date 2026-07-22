import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-neutral-950 sm:text-[1.625rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <p className="text-[12px] font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-neutral-950">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[12.5px] text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/[0.05] px-5 py-4">
      <div>
        <h2 className="text-[14.5px] font-semibold tracking-[-0.015em] text-neutral-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] text-neutral-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-[14.5px] font-medium tracking-[-0.01em] text-neutral-950">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-neutral-700">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "w-full h-11 rounded-xl border border-black/[0.08] bg-[#fafafa] px-3.5 text-[14.5px] tracking-[-0.011em] text-neutral-900 outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-neutral-400 hover:bg-white hover:border-black/[0.12] focus:bg-white focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/[0.08]";

export const selectClassName = inputClassName;

export const textareaClassName =
  "w-full min-h-[100px] resize-y rounded-xl border border-black/[0.08] bg-[#fafafa] px-3.5 py-3 text-[14.5px] tracking-[-0.011em] text-neutral-900 outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-neutral-400 hover:bg-white hover:border-black/[0.12] focus:bg-white focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/[0.08]";

export const buttonPrimaryClassName =
  "inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-[13.5px] font-medium tracking-[-0.01em] text-white transition-[background-color,transform,opacity] duration-150 hover:bg-neutral-800 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

export const buttonSecondaryClassName =
  "inline-flex h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-[13.5px] font-medium tracking-[-0.01em] text-neutral-800 transition-[background-color,border-color,transform,opacity] duration-150 hover:bg-neutral-50 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

export const buttonGhostClassName =
  "inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-50";
