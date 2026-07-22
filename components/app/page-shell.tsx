import { cn } from "@/lib/utils";

/**
 * Shared page header for dashboard routes.
 * Typography matches StatBar / Reports & Analytics (font-light titles).
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
      <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="type-page-title">{title}</h1>
          {description ? (
            <p className="type-body mt-1.5 leading-snug">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex h-9 shrink-0 items-center justify-end">
            {action}
          </div>
        ) : null}
      </header>
      <div className={cn(contentClassName)}>{children}</div>
    </div>
  );
}
