"use client";

import { House, QrCode, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function TeacherMobileTabBar({
  tab,
  onHome,
  onScan,
  onProfile,
}: {
  tab: "home" | "profile";
  onHome: () => void;
  onScan: () => void;
  onProfile: () => void;
}) {
  return (
    <nav
      aria-label="App"
      className="border-t border-neutral-200/80 bg-white px-4 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-3">
        <TabButton
          label="Home"
          active={tab === "home"}
          onClick={onHome}
          icon={<House className="size-5" strokeWidth={tab === "home" ? 2.25 : 1.75} />}
        />
        <TabButton
          label="Scan"
          active={false}
          onClick={onScan}
          icon={<QrCode className="size-5" strokeWidth={1.75} />}
        />
        <TabButton
          label="Profile"
          active={tab === "profile"}
          onClick={onProfile}
          icon={
            <UserRound
              className="size-5"
              strokeWidth={tab === "profile" ? 2.25 : 1.75}
            />
          }
        />
      </div>
    </nav>
  );
}

function TabButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 py-1",
        active ? "text-neutral-950" : "text-neutral-400",
      )}
    >
      {icon}
      <span className="text-[10px] font-medium tracking-[-0.01em]">{label}</span>
    </button>
  );
}
