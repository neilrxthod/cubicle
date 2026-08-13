"use client";

import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { SwapRequestsList } from "@/components/swap-requests-list";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

export function TeacherMobileSwaps({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const { bookings, carts, swapRequests } = usePlatformStore();

  const incoming = swapRequests.filter((request) => {
    if (request.status !== "pending") return false;
    const booking = bookings.find((entry) => entry.id === request.bookingId);
    return booking?.teacherId === user.id;
  });
  const outgoing = swapRequests.filter(
    (request) =>
      request.status === "pending" && request.requesterId === user.id,
  );
  const empty = incoming.length === 0 && outgoing.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title="Swaps" onBack={onBack} />
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-8 pt-4">
        {empty ? (
          <p className="rounded-[12px] bg-white px-4 py-10 text-center text-[15px] text-neutral-400">
            No swap requests
          </p>
        ) : (
          <>
            <SwapRequestsList
              requests={incoming}
              bookings={bookings}
              carts={carts}
              variant="incoming"
            />
            <SwapRequestsList
              requests={outgoing}
              bookings={bookings}
              carts={carts}
              variant="outgoing"
            />
          </>
        )}
      </main>
    </div>
  );
}
