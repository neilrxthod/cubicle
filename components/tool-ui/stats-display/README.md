# Stats Display

Schedule dashboard metrics for authorized school staff on the home board (`app/page.tsx`).

The strip summarizes **operational day metrics** only (cart utilization and issue load). It does not display student personal information and is not a student information system.

## Metrics (production meaning)

| Key | Meaning |
|-----|---------|
| **Booked** | Number of cart-period reservations on the selected board date |
| **Utilization** | Share of active cart capacity booked that day |
| **Yours** | Reservations owned by the signed-in staff member |
| **Issues** | Open equipment issues (fleet health signal) |
| **Free** | Remaining bookable slots for the day |

Optional sparklines show short multi-day trends for the same operational series. Day-over-day diffs are comparative only — not financial or student analytics.

## Data handling

| Topic | Practice |
|-------|----------|
| **Source** | Live platform store / Supabase-backed bookings and issues for the signed-in school deployment |
| **Audience** | Allowlisted `@rbe.sk.ca` teachers and admins only |
| **PII** | Values are counts and rates; avoid wiring free-text student notes into these tiles |
| **Access** | Rendered inside the authenticated dashboard; not a public endpoint |
| **Durability** | Figures reflect Postgres operational data in production; deploys do not reset school data |

## Files

| Path | Role |
|------|------|
| `index.tsx` | Public exports |
| `stats-display.tsx` | Main UI (brand surface aligned with product chrome) |
| `sparkline.tsx` | Compact trend chart |
| `schema.ts` | Serializable stat item types |
| `_adapter.tsx` | Shared adapter helpers |
| `../shared/` | Contract / parse utilities |

## Usage

```tsx
import { StatsDisplay, type StatItem } from "@/components/tool-ui/stats-display"

<StatsDisplay id="schedule-stats" stats={stats} />
```

`StatItem` supports number/percent formats, optional sparkline series, and optional `diff` for day-over-day change. Pass only aggregates derived from authorized operational queries — never raw student identifiers.

## Styling

Dark brand mesh surface consistent with Cubicle auth / onboarding panels. Light type and monochrome sparklines for readability under classroom and office lighting. Keep contrast high; do not introduce decorative data that could be mistaken for student analytics.

## Related

- Product access model and compliance: [root README](../../../README.md)
- Security policy: [SECURITY.md](../../../SECURITY.md)
- Legal privacy narrative: production `/legal/privacy`
