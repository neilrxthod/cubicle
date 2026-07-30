# Stats Display

Schedule dashboard metrics used on the home **Schedule** page (`app/page.tsx`).

Shows day-level figures with optional sparklines and day-over-day diffs: booked slots, utilization, your bookings, open issues, and free capacity.

## Files

| Path | Role |
|------|------|
| `index.tsx` | Public exports |
| `stats-display.tsx` | Main UI |
| `sparkline.tsx` | Mini trend chart |
| `schema.ts` | Serializable stat item types |
| `_adapter.tsx` | Tool-UI adapter helpers |
| `../shared/` | Shared contract / parse utilities |

## Usage

```tsx
import { StatsDisplay, type StatItem } from "@/components/tool-ui/stats-display"

<StatsDisplay id="schedule-stats" stats={stats} />
```

`StatItem` supports number/percent formats, optional sparkline series, and optional `diff` for day-over-day change.

## Styling

Monochrome product look (matches Cubicle’s post-auth canvas). Prefer neutral sparkline colors so the board stays calm under classroom lighting.
