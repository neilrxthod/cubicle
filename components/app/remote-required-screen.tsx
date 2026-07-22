/**
 * Shown when production is live without Supabase env — never show seed data.
 */
export function RemoteRequiredScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#f6f6f7] px-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-[15px] font-semibold tracking-tight text-neutral-950">
          Database not connected
        </p>
        <p className="text-[13.5px] leading-relaxed text-neutral-500">
          {message}
        </p>
        <p className="pt-2 text-[12px] leading-relaxed text-neutral-400">
          Deploying code never deletes school data. Bookings, carts, staff, and
          issues live in Supabase Postgres — separate from this app.
        </p>
      </div>
    </div>
  );
}
