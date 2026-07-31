import { cn } from "@/lib/utils";

/**
 * Post-auth page header — Tesla product: light display title,
 * one restrained line of context, no decorative chrome.
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
      <header className="mb-7 flex items-end justify-between gap-6 sm:mb-9">
        <div className="min-w-0 max-w-2xl">
          <h1 className="type-page-title text-neutral-950">
            {title}
          </h1>
          {description ? (
            <p className="type-body mt-2.5 max-w-md leading-relaxed text-neutral-400 sm:text-[13.5px]">
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
