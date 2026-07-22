import { cn } from "@/lib/utils";

/**
 * Linear / Vercel–style settings surfaces.
 * Quiet labels, hairline cards, no heavy chrome.
 */
export function SettingsSection({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      {title ? (
        <h2 className="mb-2 px-1 text-[12px] font-medium tracking-[-0.01em] text-neutral-400">
          {title}
        </h2>
      ) : null}
      <div className="overflow-hidden rounded-[14px] border border-black/[0.06] bg-white">
        {children}
      </div>
    </section>
  );
}

export function SettingsDivider() {
  return (
    <div
      className="ml-4 h-px bg-black/[0.05] sm:ml-5"
      role="separator"
      aria-hidden
    />
  );
}

export function SettingsRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>
  );
}

export function SettingsToggleRow({
  title,
  description,
  control,
  className,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 px-4 py-3.5 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium tracking-[-0.01em] text-neutral-900">
          {title}
        </p>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function SettingsField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[11.5px] font-medium tracking-[-0.01em] text-neutral-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SettingsMetaRow({
  label,
  value,
  trailing,
}: {
  label: string;
  value: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <span className="shrink-0 text-[13px] text-neutral-400">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <span className="truncate text-right text-[13px] font-medium tracking-[-0.01em] text-neutral-900">
          {value}
        </span>
        {trailing}
      </div>
    </div>
  );
}

/** Soft field — startup product default */
export const settingsInputClass =
  "h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#fafafa] px-3 text-[13.5px] tracking-[-0.011em] text-neutral-900 outline-none transition-[border-color,background-color,box-shadow] placeholder:text-neutral-400 hover:border-black/[0.12] hover:bg-white focus:border-black/[0.16] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] focus:ring-0";
