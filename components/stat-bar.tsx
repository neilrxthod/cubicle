export function StatBar({
  stats,
}: {
  stats: Array<{ label: string; value: number | string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-neutral-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        >
          <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-400">
            {s.label}
          </span>
          <span className="mt-1.5 block text-[1.5rem] font-semibold leading-none tracking-[-0.03em] text-neutral-950">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}
