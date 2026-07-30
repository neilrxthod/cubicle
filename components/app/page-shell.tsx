import { cn } from "@/lib/utils";

/**
 * Post-auth page header — Tesla-like: large quiet title, one restrained line of context.
 */
export function PageShell({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  narrow = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full",
        narrow ? "mx-auto max-w-3xl" : "max-w-none",
        className,
      )}
    >
      <header className="mb-6 flex items-end justify-between gap-6 sm:mb-8">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[1.75rem] font-medium leading-[1.1] tracking-[-0.045em] text-neutral-950 sm:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-[13px] font-normal leading-relaxed tracking-[-0.01em] text-neutral-400 sm:text-[13.5px]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center justify-end pb-0.5">
            {action}
          </div>
        ) : null}
      </header>
      <div className={cn(contentClassName)}>{children}</div>
    </div>
  );
}
