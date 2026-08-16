import type { PresenceStatus } from "@/lib/staff/presence";
import { cn } from "@/lib/utils";

/**
 * Avatar corner status: green = in Cubicle, yellow = Cubicle open but
 * another browser tab is focused. Offline renders nothing.
 */
export function PresenceDot({
  status,
  size = "sm",
  className,
}: {
  status: PresenceStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  if (status === "offline") return null;

  return (
    <span
      aria-label={status === "online" ? "Online" : "Away"}
      className={cn(
        "absolute right-0 bottom-0 rounded-full ring-2 ring-white",
        size === "md" ? "size-2.5" : "size-2",
        status === "online" ? "bg-emerald-500" : "bg-amber-400",
        className,
      )}
    />
  );
}
