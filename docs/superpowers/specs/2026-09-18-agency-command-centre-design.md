# Per-agency Command Centre

Status: approved for implementation planning
Date: 2026-09-18

## Context

`/dashboard` is a baseline route (`access-control.json` `defaults.baselineRoutes`), the RBAC
safe-space fallback (`defaults.safeSpace.route`), and the sidebar's hardcoded "Command Centre"
link - every authenticated account lands there, agency-bound or not. Today `app/pages/dashboard.vue`
renders one fixed view for everyone: a national "NATIONAL TRANSPORT HEALTH" KPI strip across all six
domains, plus an "AGENCY DRILL-DOWNS" grid summarising all ~13 agencies with links out to domain
pages. This is a ministry-wide oversight view, appropriate for `SDT` (State Department for
Transport, the ministry itself) and `super_admin`, but every other agency admin/analyst/operator
sees the identical thing regardless of their own agency's actual grants - confirmed live for
`kenha.admin`, `sdr.admin`, `kaa.admin`, and others during the RBAC QA sweep on 2026-09-18.

`useAccessControl()` already resolves everything needed to build a real per-agency view: the
agency's name, `domains`, `grants.full`/`grants.read`/`grants.routes`, and per-route resolution via
`resolveRoute()`/`canAccessRoute()`. `access-control.json`'s per-agency `landing` field even already
names an intended landing page per agency (3 of 22 - KENHA, NTSA, SDR - point to bespoke pages;
the other 19 point to a generic domain page like `/infrastructure` or `/maritime`, which were built
as ordinary module pages, not as agency-framed command centres).

## Goals

- Every non-SDT, non-`super_admin` agency account sees a command centre built from *its own*
  grants - real KPI numbers for modules it has full access to, a visibly lighter treatment for
  read-only modules, and nothing for modules it can't reach at all.
- `SDT` and `super_admin` keep exactly the current national view, unchanged.
- No new backend endpoints. Every number shown is already fetched by an existing domain page's
  composable - this is a new arrangement of existing data, not new data.
- One reusable component serves all ~19 agencies without a dedicated dashboard today, rather than
  19 hand-built pages.

## Non-goals

- Not changing the 3 existing bespoke agency pages (`/agency/kenha`, `/agency/ntsa`, `/agency/sdr`)
  or what they show - this spec adds a *default* for agencies that have nothing today.
- Not changing routing/URLs: `/dashboard` remains the single URL every account lands on. No new
  routes are added to `access-control.json`'s `modules`/`routes` blocks.
- Not handling `platform.noagency` (analyst, `agency_id = null`) specially - it keeps today's
  "no agency resolved" safe-space behaviour. Out of scope; it's a seed-data edge case, not a real
  tenant.
- Not touching `platform.public`'s fixed public view (spec 2.6) - separate code path already.
- Not respecting `scopeLevel` (`read` vs `full`) as a UI-wide concept beyond this one page - that's
  a broader gap (RBAC spec section 6 field-masking was one instance of it, just fixed; read-vs-full
  page-level gating is a separate, larger follow-up not in scope here).

## Architecture

`dashboard.vue` becomes a thin branch, not a full page body:

```
dashboard.vue
  const { roleTier, agencyCode, isSuperAdmin } = useAccessControl()
  const showNational = computed(() => isSuperAdmin.value || agencyCode.value === 'SDT')
  <NationalCommandCentre v-if="showNational" />
  <AgencyCommandCentre v-else-if="agencyCode" />
  <!-- else: today's existing empty/safe-space handling, unchanged -->
```

`NationalCommandCentre.vue` is today's `dashboard.vue` body extracted verbatim (no behavioural
change) - a pure refactor so the branch above has something to point `v-if="showNational"` at.

`AgencyCommandCentre.vue` is new. It takes no props - it reads `useAccessControl()` for the
current viewer itself, the same way every other page in this app reads its own access state.

## `AgencyCommandCentre.vue` - data flow

1. Resolve `agency = useAccessControl().agency.value` (name, domains, landing, grants) and
   `resolveRoute`/`canAccessRoute` for building the quick-links list.
2. Add one small addition to `useAccessControl.ts`: `moduleScope(moduleId): ScopeLevel`, analogous
   to the existing `canAccessModule(moduleId): boolean`. It resolves every static route in that
   module (skipping dynamic `[id]` routes, same filter `canAccessModule` already applies) and
   returns the best scope found (`full` > `read` > `none`). This is necessary because some
   agencies (e.g. KMA on M07b Maritime) reach a module entirely through individual
   `grants.routes` overrides with no module-level grant at all - `canAccessModule` already handles
   the "can they reach anything in here" question; `moduleScope` answers "how well", for tile
   styling.
3. A static registry, `app/config/agencyModuleSummary.ts`, maps each **operational** module id to
   the composable call and 2–3 fields an existing domain page already renders as its own headline
   KPIs:

   | Module | Composable call | Headline fields |
   |---|---|---|
   | M02 Road Traffic | `useTraffic().summary()` | `kpis.active_congestion_events`, `kpis.avg_speed_24h_kmh`, `kpis.total_volume_24h` |
   | M03 Fleet & Vehicle Tracking | `useFleet().summary()` | `kpis.live_vehicles`, `kpis.trips_7d`, `governor_compliance.online_pct` |
   | M04 Public Transport | `usePublicTransport().summary()` | `kpis.active_saccos`/`total_saccos`, `kpis.active_routes`, `kpis.passenger_trips_24h` |
   | M05 Safety & Incidents | `useSafety().summary()` | `kpis.active`, `kpis.fatal_30d`, `kpis.total_7d` |
   | M06 Road Infrastructure | `useInfrastructure().summary()` | `network.iri_average`, `network.pci_average`, `network.total_length_km` |
   | M07a Aviation | `useAviationInfrastructure().summary()` | `kpis.runway_availability_pct`, `kpis.atc_infra_health_pct`, `kpis.open_work_orders` |
   | M07b Maritime | `useMaritimeCargo().summary()` | sum of `ports[].cargo_tonnes`, sum of `ports[].cargo_teu` (same reduction `maritime/cargo.vue` already does) |
   | M08 Railway | `useRailway().summary()` | `kpis.trains_in_service`, `kpis.freight_30d_shipments`, `kpis.passenger_bookings_30d` |
   | M14 Training Institutes | best-effort via `useTraining()` | finalised against the live response during implementation; honest "NO DATA" if no clean flat KPI exists |

   `M01` (Command Centre itself), `M09` (Reporting), `M10` (Access Control), `M11`
   (Notifications), `M12` (Integration Hub), and `M13` (GIS) are **not** in this table - they don't
   have a natural single-number KPI (a report count isn't a meaningful headline metric the way a
   fatality count is). These surface only in the quick-links list below, not as KPI tiles.

4. Render: for every module in the registry, call `moduleScope(id)`. `full` → a real `KpiCard`
   with the mapped fields (same `unavailable`/`unavailable-note` honest-empty-state pattern every
   other page already uses - a module the agency has full access to but whose backend has no data
   yet shows "NO DATA", never an invented number). `read` → the same tile in a visibly muted
   treatment (reusing the dimmed/italic convention `cargo.vue`'s masked cells now use). `none` →
   omitted entirely.
5. Quick Links: iterate every route in `access-control.json`'s `routes`/`modules` blocks that
   `canAccessRoute()` allows for this agency, grouped by module label, as a simple link list below
   the KPI tiles - gives every agency a real navigational home base even for modules with no KPI
   tile (M09–M13).
6. Header: agency name, role tier, and (if present) the agency's own `landing` route as a
   "Full workspace →" link where that differs from `/dashboard` itself (e.g. KENHA still gets a
   prominent link to `/agency/kenha`).

## Error handling

Each KPI tile fetches independently via `Promise.allSettled` (the same pattern every existing
domain page already uses in its own `load()`) - one module's API failing never blocks the others
or blanks the page. A module with zero accessible routes is simply never fetched.

## Testing

- Unit test `moduleScope()` against a handful of the existing access-control.test.ts fixtures,
  including the KMA/M07b route-override-only case specifically (the reason this function exists).
- Unit test `agencyModuleSummary.ts`'s registry: every operational module id it's expected to
  cover has an entry (fails loudly if a new module is added to `access-control.json` without a
  registry decision being made).
- Component test for `AgencyCommandCentre.vue` (mirrors `kpi-card.test.ts`'s `mount()` pattern),
  stubbing `useAccessControl()` and the composables it calls: full-scope module renders real
  values, read-scope module renders muted, denied module doesn't render, a module whose API call
  rejects renders "NO DATA" not an error or a blank tile.
- Live spot-check after implementation across agencies of different shapes: KENHA (full road
  domain, many modules), KPA (narrow explicit route grants, no module-level maritime grant), KMA
  (the route-override-only M07b case `moduleScope` exists for), LAPSSET (minimal placeholder
  agency, mostly quick-links with few/no KPI tiles).

## Rollout

Single change, no migration/data concerns - this is additive UI on top of already-correct RBAC
resolution (fixed this session). No feature flag needed; ship behind normal PR review since a
broken tile degrades to "NO DATA," never blocks the page.
