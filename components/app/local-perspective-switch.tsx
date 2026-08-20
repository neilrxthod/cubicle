"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isLocalPerspectiveSwitcherEnabled,
  switchLocalPerspective,
} from "@/lib/auth/local-demo";
import type { Role, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Local sandbox only — flip between Demo Teacher and Demo Admin.
 * Hidden in production / remote.
 */
export function LocalPerspectiveSwitch({
  user,
  className,
}: {
  user: SessionUser;
  className?: string;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  if (!isLocalPerspectiveSwitcherEnabled()) return null;

  function handlePerspective(role: Role) {
    if (switching) return;
    if (user.role === role) {
      router.push(role === "admin" ? "/admin" : "/");
      return;
    }
    setSwitching(true);
    const result = switchLocalPerspective(role);
    setSwitching(false);
    if (!result.ok) return;
    router.push(role === "admin" ? "/admin" : "/");
  }

  return (
    <div
      role="group"
      aria-label="Local perspective"
      className={cn(
        "flex h-8 items-center rounded-md border border-black/[0.08] bg-neutral-50 p-0.5",
        className,
      )}
    >
      {(
        [
          { role: "teacher" as const, label: "Teacher" },
          { role: "admin" as const, label: "Admin" },
        ] as const
      ).map((opt) => {
        const active = user.role === opt.role;
        return (
          <button
            key={opt.role}
            type="button"
            disabled={switching}
            aria-pressed={active}
            title={`View as ${opt.label} (local only)`}
            onClick={() => handlePerspective(opt.role)}
            className={cn(
              "inline-flex h-7 items-center rounded-[5px] px-2 sm:px-2.5",
              "text-[11px] font-medium tracking-[-0.01em] motion-micro",
              active
                ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-neutral-500 hover:text-neutral-800",
              "disabled:pointer-events-none disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
