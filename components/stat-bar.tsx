import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: number | string;
};

/**
 * Home metrics — same visual language as Reports & Analytics KPI cards.
 * Issues uses the red gradient / thin red border treatment from Reports maintenance.
 */
export function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5 lg:gap-6">
      {stats.map((stat) => {
        const isIssues = stat.label === "Issues";
        const n =
          typeof stat.value === "number"
            ? stat.value
            : Number.parseInt(String(stat.value), 10);
        const hasOpenIssues = isIssues && !Number.isNaN(n) && n > 0;

        return (
          <div
            key={stat.label}
            className={cn(
              "flex flex-col gap-1.5 rounded-2xl border p-5 text-left transition sm:p-6",
              isIssues
                ? cn(
                    "border-red-200/80",
                    "bg-gradient-to-br from-red-50/90 via-red-50/40 to-white",
                    hasOpenIssues && "from-red-50 via-red-50/50 to-red-50/20",
                  )
                : "border-border/60 bg-muted/10",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-semibold tracking-widest uppercase",
                isIssues ? "text-red-600" : "text-muted-foreground",
              )}
            >
              {stat.label}
            </span>
            <span
              className={cn(
                "text-3xl font-light tracking-tight sm:text-4xl",
                isIssues ? "text-red-600" : "text-foreground",
              )}
            >
              {stat.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
