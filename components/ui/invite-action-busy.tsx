import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Quiet in-button wait — spinner + label, no layout jump. */
export function InviteActionBusy({
  children,
  className,
  spinnerClassName,
}: {
  children?: ReactNode
  className?: string
  spinnerClassName?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        className,
      )}
    >
      <Loader2
        className={cn(
          "size-3.5 shrink-0 animate-spin",
          spinnerClassName,
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      {children ? <span>{children}</span> : null}
    </span>
  )
}
