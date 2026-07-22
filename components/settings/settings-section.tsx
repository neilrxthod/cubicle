import { cn } from "@/lib/utils";

/**
 * Settings surface primitives — balanced density for admin & teacher.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
  action,
}: {
  id?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      {(title || action) && (
        <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[13px] font-semibold tracking-tight text-neutral-900">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsDivider() {
  return <div className="mx-4 h-px bg-neutral-100 sm:mx-5" role="separator" />;
}

export function SettingsRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-4 sm:px-5 sm:py-5", className)}>{children}</div>
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
        "flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="min-w-0 pr-2">
        <p className="text-[14px] font-medium tracking-[-0.01em] text-neutral-900">
          {title}
        </p>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
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
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-medium text-neutral-500"
        >
          {label}
        </label>
        {hint ? (
          <span className="text-[11px] tabular-nums text-neutral-400">
            {hint}
          </span>
        ) : null}
      </div>
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
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <span className="shrink-0 text-[13px] text-neutral-500">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <span className="truncate text-right text-[13.5px] font-medium text-neutral-900">
          {value}
        </span>
        {trailing}
      </div>
    </div>
  );
}

export const settingsInputClass =
  "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[14px] tracking-[-0.011em] text-neutral-900 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.045)] focus:ring-0";

export const settingsTextareaClass =
  "min-h-[72px] w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[14px] leading-relaxed tracking-[-0.011em] text-neutral-900 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.045)] focus:ring-0";
