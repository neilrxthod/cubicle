"use client";

import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import {
  AdminConsole,
  type AdminConsoleTab,
} from "@/components/admin-console";
import { usePlatformStore } from "@/lib/data/platform-store";

export function AdminMobileSection({
  title,
  tab,
  onBack,
}: {
  title: string;
  tab: AdminConsoleTab;
  onBack: () => void;
}) {
  const state = usePlatformStore();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title={title} onBack={onBack} />
      <main className="min-h-0 flex-1 overflow-auto px-3 pb-8 pt-2">
        <AdminConsole
          key={tab}
          carts={state.carts}
          bookings={state.bookings}
          users={state.users}
          issues={state.issues}
          slotRestrictions={state.slotRestrictions}
          bookingPolicy={state.bookingPolicy}
          swapRequests={state.swapRequests}
          initialTab={tab}
          hideChrome
        />
      </main>
    </div>
  );
}
