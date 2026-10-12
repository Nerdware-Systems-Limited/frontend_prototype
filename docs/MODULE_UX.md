# Module UX building blocks

_Verified against the code on 2026-10-12._

The shared pieces that make module pages behave the same way: collapsible maps and incident sections, the unified
time-range control, certificate expiry alerts and the HQ cross-module summary. The Public Transport Overview
(`app/pages/public-transport/index.vue`) is the reference layout for a module overview.

## 1. Collapsible sections (`CollapsibleSection.vue`)

One header you click to show or hide a block. Props: `title`, `count`, `tone` (`success|warning|danger|info`, the
colour of the count), `source` (e.g. "KMA · Live"), `defaultOpen`, `storageKey`, `eager`, `plain`, `headingLevel`.
Slots: default, `title`, `meta`, `actions`.

- **Maps are collapsed by default.** Every map card outside the GIS Explorer uses it: 21 maps across aviation, fleet (live, geofences, trip
  replay), infrastructure, maritime, public transport, railway, safety, traffic and the national Command Centre. The body is
  **not mounted until the first open**, so a collapsed map loads no tiles. After that it is only hidden (`v-show`),
  so zoom, layers, filters and selection survive collapse and reopen. `UaptsMap`'s `ResizeObserver` re-fits it
  when it becomes visible. The GIS Explorer (`/gis`) is the map workspace itself and is not collapsible.
- **Incident sections are open by default** and show their count and worst severity in the header while folded:
  Incident Command (All Incidents, Active Incidents, Emergency Dispatch Log), Maritime incident log, Railway
  incident registry, Traffic active alerts and congestion events. Filters, sorting, pagination, ids and drill-downs
  are unchanged.
- **Open/closed is remembered for the session** under `storageKey` (shared by every copy of that key), and resets
  to `defaultOpen` on reload.
- **Drill-downs open it.** `KpiCard` dispatches a `uapts:reveal` event with the target id before scrolling; a section
  containing that id opens itself first, so "#active-queue" never scrolls to a hidden block.
- Accessible: the toggle is a real `<button>` with `aria-expanded` and `aria-controls`; the chevron is the only
  motion and is disabled under `prefers-reduced-motion`. The source and "Show/Hide" hint hide on narrow screens.

## 2. Unified time range (`TimeRangeSelector.vue`, `useTimeRange`, `utils/timeRange.ts`)

One compact control replaces the separate 24-hour / 7-day / 30-day toggles. Closed it is a pill ("7 Days");
open it shows **24 Hours | 7 Days | 30 Days** (and **Year** where supported) with the current one highlighted,
and folds away after a preset is picked. Escape closes it.

```ts
const timeRange = useTimeRange('aviation', { default: '7d' })   // state is per module
const days = timeRange.days        // 1 | 7 | 30  (or the length of the chosen year)
timeRange.from.value / .to.value   // 'YYYY-MM-DD', East Africa Time
timeRange.period.value             // '24H' | '7D' | '30D' | '2025' for KpiCard `period`
// <TimeRangeSelector :range="timeRange" @change="load" />
```

- **Shared per module, kept in the session.** Choosing 30 Days on one Aviation page applies to the other Aviation
  pages and survives navigating away and back. Modules are independent. A reload returns to the module default.
- **Calendar days are East Africa Time**, so "today", the start of a year and a certificate's days-left mean the
  same everywhere. Presets are whole-day windows: 24 Hours is yesterday and today, 7 Days starts seven days back.
- **Where it is wired:** aviation (overview, flights, passenger stats), maritime overview, traffic (overview,
  analytics), railway (overview, freight, schedules), public transport overview, and the HQ summary. Labels,
  KPI period badges and card headings read from the same object, so a heading never names a different window than
  the data.
- **Multi-year trends.** The **Year** view (`‹ 2025 ›`, 2015 to the current year, current year runs to today) is
  offered only where the endpoint accepts `date_from` / `date_to`: today **Aviation > Flight Movements**. Other
  pages' endpoints only understand "the last N days", so offering past years there would return wrong data; a page
  without year support falls back to a preset when the module is in year view. Extending it means giving that
  composable `date_from`/`date_to` and passing `{ years: true }`.
- **Fixed-window figures stay labelled.** Summary KPIs that the server computes over a fixed window (for example
  "Departures (24h)", "On-Time Performance 7D") do not follow the selector and keep their own period badge.
  Where a card has both (railway on-time, traffic class mix) the range-driven figure wins and the heading names the
  window shown; the fixed summary is only the fallback if that request fails.
- `DayRangeToggle` remains only for the vehicle-registration "registered in the last N days" filter, which is a
  different control (it can be switched off).

## 3. Certificate expiry (`CertificateExpiryPanel.vue`, `useCertificateExpiry`, `utils/certificateExpiry.ts`)

One list of every certificate and licence the viewer may see, urgent first.

| Status | Rule (default policy) | Colour |
|---|---|---|
| Expired | date passed, or the source reports it expired | danger |
| Critical | within 14 days | danger |
| Expiring soon | within 30 days (the **short-term** filter) | warning |
| Upcoming | within 90 days (the **medium-term** filter) | info |
| Valid | further out | success |

- **The thresholds are a policy, not a constant.** Nothing in the platform defines one, so
  `DEFAULT_CERT_POLICY = { criticalDays: 14, soonDays: 30, upcomingDays: 90 }` is the starting point and the panel
  takes a `policy` prop. The panel prints the windows it is using. If agencies set a certificate policy, pass it in.
- **Sources** (`config/certificateSources.ts`, one entry each): PSV licences, aviation certificates, maritime
  licences, driving licences. Each fetches expired plus expiring-within-window from the existing endpoints and
  names its page. Only sources whose page the viewer can open are requested (same agency-scope check as the
  sidebar). One failing source is named in a note and the rest still show.
- **Panel:** counters (expired / critical / expiring soon / upcoming, click to filter), filters (needs attention,
  expired, short-term, medium-term), sorted list (expired first, longest overdue first, then fewest days left),
  days left in words ("Expired 3 days ago", "12 days left"), status badge, owner, expiry date, and a "View / renew"
  link to the source page. Per-filter empty states. 15 rows per page.
- **Where:** Public Transport overview (PSV + driving), PSV compliance, driver licensing, aviation licensing (replaces
  the old renewals table and its duplicate request), maritime services, and the HQ summary (all sources).
- **Not tracked yet** (no list endpoint to read): vehicle insurance and inspection expiry, training certificates.
  Add an entry to `CERTIFICATE_SOURCES` when they exist. There is no in-app renewal workflow; the action links to
  the page that owns the record.

## 4. HQ cross-module summary (`HqSummary.vue`)

Rendered inside the national Command Centre (`NationalCommandCentre.vue`), so it is shown exactly to who sees that
view today: super admins and SDT. Below the six-domain health ribbon it adds:

1. **Needs attention:** feeds that are down, and performance figures past a threshold, each linking to its module.
2. **Operational status (live):** the remaining modules (traffic, public transport) as KPI tiles, from
   `useModuleSummaries` (the same loader the agency workspace uses).
3. **Performance over the range (history):** rail and flight on-time, fare revenue, vehicles classified, driven by
   the time-range selector (`config/hqPerformance.ts`). Status colours use the shared thresholds, so a figure is
   "warning" here exactly when it is on its own page.
4. **Certificate and licence renewals** across every source the viewer can open.

Live status and history are separate sections with their own badges. Every tile and metric loads and fails on its
own and says why it is empty ("feed unavailable" or "no records in this range"); nothing is shown as 0 when missing.
Only modules whose route resolves above "none" for the viewer are fetched.

## 5. Module overview pages

Every operational module already has an overview built on the same parts (KPI ribbon, trend and breakdown cards,
map, recent events, links to detail pages). They now share the same controls: the time-range selector for
time-dependent data, collapsible map and incident sections, and the certificate panel where the module owns
certificates. Utility modules (Reporting M09, Access Control M10, Notifications M11, Integration Hub M12) have no
single-number summary by design (`NON_OPERATIONAL_MODULES` in `config/agencyModuleSummary.ts`) and no overview was
added for them.

## 6. Tests

`time-range`, `time-range-selector`, `collapsible-section`, `certificate-expiry`, `certificate-panel` (all under
`tests/unit/`). `national-heatmap` opens the collapsed map before asserting on it.
