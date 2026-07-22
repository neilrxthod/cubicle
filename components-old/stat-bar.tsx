export function StatBar({
  stats,
}: {
  stats: Array<{ label: string; value: number | string }>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="flex flex-col gap-2 rounded-xl border border-border bg-white px-5 py-5"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {s.label}
          </span>
          <span className="text-[2rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}
