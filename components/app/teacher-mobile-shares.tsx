"use client";

import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { ShareInvitesList } from "@/components/share-invites-list";
import { usePlatformStore } from "@/lib/data/platform-store";
import { bookingHasShareInviteFor, type SessionUser } from "@/lib/types";

export function TeacherMobileShares({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const { bookings, carts } = usePlatformStore();
  const incoming = bookings.filter((booking) =>
    bookingHasShareInviteFor(booking, user.id),
  );
  const outgoing = bookings.filter(
    (booking) => booking.teacherId === user.id && Boolean(booking.sharePendingId),
  );
  const declined = bookings.filter(
    (booking) =>
      booking.teacherId === user.id &&
      Boolean(booking.shareDeclinedById) &&
      !booking.sharePendingId,
  );
  const empty =
    incoming.length === 0 && outgoing.length === 0 && declined.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title="Shares" onBack={onBack} />
      <main className="flex flex-1 flex-col overflow-y-auto px-5 pb-8 pt-4">
        {empty ? (
          <p className="rounded-[12px] bg-white px-4 py-10 text-center text-[15px] text-neutral-400">
            No share invites
          </p>
        ) : (
          <ShareInvitesList
            bookings={bookings}
            carts={carts}
            userId={user.id}
          />
        )}
      </main>
    </div>
  );
}
