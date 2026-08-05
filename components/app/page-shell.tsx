import { cn } from "@/lib/utils";

/**
 * Post-auth page header — Tesla product: light display title,
 * one restrained line of context, no decorative chrome.
 * Stacks cleanly on narrow viewports; expands on wide ones.
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
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  narrow?: boolean;
}) {
  const showHeader = Boolean(title || description || action);

  return (
    <div
      className={cn(
        "w-full min-w-0",
        narrow ? "mx-auto max-w-3xl" : "max-w-none",
        className,
      )}
    >
      {showHeader ? (
        <header className="mb-6 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-2xl">
            {title ? (
              <h1 className="type-page-title break-words text-neutral-950">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="type-body mt-2.5 max-w-md leading-relaxed text-neutral-400 sm:text-[13.5px]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:pb-0.5">
              {action}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn("min-w-0 w-full", contentClassName)}>{children}</div>
    </div>
  );
}
