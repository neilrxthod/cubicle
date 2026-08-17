export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#f6f6f7]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
        <p className="text-[13px] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
