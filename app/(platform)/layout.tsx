"use client";

import { usePathname } from "next/navigation";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";

export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const role = pathname.startsWith("/admin") ? "admin" : undefined;

  return (
    <RequirePlatformAuth role={role}>
      {(user) => <DashboardFrame user={user}>{children}</DashboardFrame>}
    </RequirePlatformAuth>
  );
}
