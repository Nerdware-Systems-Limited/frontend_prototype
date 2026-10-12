# Backend fixes: data not reaching the dashboard

Found on 2026-10-06 by checking the frontend (localhost:3000) against the
backend at `192.168.0.110:8000`. Each page's API responses were compared with
what the page rendered.

Almost every empty table or zero KPI in the app is correct: that table has no
data yet. The items below are the exceptions, where data exists but isn't
reaching the right endpoint, or the endpoint is missing.

> The backend source wasn't available during this check. Every claim below
> comes from the API responses. The "likely cause" notes are inferences, so
> confirm them in the code before changing anything.

---

## 1. Safety summary / KPIs ignore the accident data (high priority)

### Symptom
- `GET /api/v1/safety/summary/` returns `kpis.fatal_30d = 0` (and
  `total_24h`, `total_7d`, `total_30d`, `active` all 0), while
  `fatality_trend_30d` in **the same response** has non-zero daily
  fatalities.
- `GET /api/v1/safety/incidents/` → `count: 0`
- `GET /api/v1/safety/kpis/` → `count: 0`
- `GET /api/v1/safety/kpis/trend/` → empty
- `GET /api/v1/safety/kpis/by-county/` → empty
- `GET /api/v1/safety/accidents/by-cause/` → **13 rows** (accident data exists)

### Likely cause
`kpis.*` and the `/kpis/*` endpoints are computed from the **incidents** table
and the **SafetyKPI** table, which are both empty. `fatality_trend_30d` is
computed from the **accidents** table, which has the uploaded data. The summary
therefore contradicts itself.

### Fix
In the safety summary view, compute the KPI block from the same source as
`fatality_trend_30d`. At minimum:

```python
# fatal_30d must equal the sum of fatality_trend_30d[*].fatalities
kpis["fatal_30d"] = sum(d["fatalities"] for d in fatality_trend_30d)
```

Decide the semantics deliberately:
- `fatal_30d` should be **number of people killed** in the last 30 days. Every
  frontend label says "Fatalities (30d)", and the trend uses that unit.
- If you also need "number of fatal incidents", add it as a **new** field
  (e.g. `fatal_incidents_30d`) rather than reusing `fatal_30d`.
- `total_24h` / `total_7d` / `total_30d` should count accidents too, unless the
  accidents and incidents tables are meant to stay separate. In that case,
  document which one the summary describes.

Then either populate the KPI rollups from accidents or make the endpoints
aggregate accidents directly. Response shapes the frontend expects:

| Endpoint | Shape (list, or `{results: [...]}`) |
|---|---|
| `/safety/kpis/` | paged `SafetyKPI`: `county, date, total_incidents, fatal_count, serious_count, minor_count, fatalities, injuries, avg_response_minutes, interventions_evaluated, intervention_effectiveness_pct` |
| `/safety/kpis/trend/` | `[{ date: "YYYY-MM-DD", incidents, fatalities, injuries }]` |
| `/safety/kpis/by-county/` | `[{ county, incidents, fatalities, serious }]` |
| `/safety/traffic-violations/by-type/` | `[{ violation_type, count }]` |

### Verify
```
GET /api/v1/safety/summary/
  → kpis.fatal_30d == sum(fatality_trend_30d[].fatalities)
GET /api/v1/safety/kpis/trend/   → non-empty
GET /api/v1/safety/kpis/by-county/ → non-empty
```
Frontend pages that should then show numbers: `/safety` and
`/safety/incidents` (Fatalities 30d), `/safety/kpis` (Total Fatalities,
trend chart, county table), and the National Command Centre fatalities tile.

### Frontend follow-up
`app/composables/api/useSafety.ts` → `reconcileFatalities()` currently patches
`fatal_30d` from the trend when the backend sends 0. Once this fix ships,
delete that function and the `.then(reconcileFatalities)` call.

---

## 2. Missing railway safety endpoints (medium priority)

### Symptom
Both return **404**, so the "Corrective actions overdue" tile on
`/railway/safety` shows NO DATA:

- `GET /api/v1/railway/safety/corrective-actions/`
- `GET /api/v1/railway/safety/risk-indicators/`

No equivalent exists at `/railway/corrective-actions/`,
`/railway/risk-indicators/`, `/railway/safety/`, or
`/safety/corrective-actions/`.

### Fix
Add both as paged list endpoints (`{count, page, page_size, total_pages,
next, previous, results}`, same as the other UAPTS list views), under
`/api/v1/railway/safety/`.

**`corrective-actions/`** supports the filters `investigation_status`, `incident_ref`,
`page`, `page_size`.

```jsonc
{
  "id": "uuid",
  "incident_ref": "string",            // links to /railway/incidents/
  "investigation_status": "open" | "in_progress" | "closed",
  "regulatory_reference": "string|null",
  "action_owner": "string|null",
  "due_date": "YYYY-MM-DD|null",       // overdue = due_date < today and status != closed
  "closure_evidence": "string|null",
  "recurrence_flag": false
}
```

**`risk-indicators/`** supports the filters `network`, `risk_type`.

```jsonc
{
  "id": "uuid",
  "line": "uuid",
  "line_name": "string|null",
  "network": "sgr" | "mgr" | "uganda" | "industrial" | "heritage" | "unknown",
  "risk_type": "derailment" | "signal_failure",
  "risk_score": 0.0,                   // number
  "contributing_factors": ["string"],
  "generated_at": "ISO-8601"
}
```

The frontend contract lives in `app/composables/api/useRailSafety.ts`.

---

## 3. Rail freight upload: port linkage and dates (medium priority, data)

### Symptom
`GET /api/v1/railway/freight/` returns 120 manifests, but
"No port-rail manifests found" shows on **both** `/railway/freight` and
`/maritime/imports-exports`, and windowed views come up empty.

Checked against the first 100 manifests:
- `customs_clearance_ref` = `""` and `port_origin` = `""` on **every** record.
  The frontend treats a manifest as port-to-rail only when one of those is
  set.
- `service_date` ranges **2026-10-15 → 2027-01-27**, all in the future.
  Every `?days=N` window (which looks backwards from today) excludes them.
- `cargo_type` is `container` on all records. `revenue_kes` is null on the
  first record.

### Fix
Two possible causes. Check the upload handler first:

1. **Upload mapping bug.** If the source file *has* columns for customs ref /
   port of origin / dispatch date, the KRC freight upload handler isn't
   mapping them. Fix the column mapping, then re-import.
2. **Source data issue.** If the file genuinely has future dates and no port
   fields, the data needs correcting at source before re-upload.

Also check how `service_date` / `dispatched_at` are derived. Dates such as
`F2445-2027-01-27` in `manifest_ref` suggest the date is parsed from the
reference or from a schedule, and the year may be wrong.

### Verify
```
GET /api/v1/railway/freight/?days=30
  → count > 0
  → some results have customs_clearance_ref or port_origin set
```

---

## Not bugs (empty because no data is loaded yet)

These are empty because the underlying tables are empty, not because anything
is broken. They need no backend change, only data:

- **Aviation:** flights, passenger stats, cargo manifests, met observations,
  safety reports, licences (19 aircraft exist, but no certificates)
- **Maritime:** vessel movements (arrivals/departures/TEU are 0 at both ports),
  cargo types, pipeline, green-transport records, pilotage, waterway aids/channels
- **Fleet:** vehicles, trips, geofences, behaviour events
- **Infrastructure:** bridges, deterioration forecasts; maintenance orders exist
  (46) but are all `planned / medium`, so In Progress / Completed / Urgent = 0
  is correct; budget `disbursed_kes = 0` → 0% utilisation is correct
- **Public transport:** all endpoints
- **Traffic:** volumes, classes, speeds, forecasts, alerts
- **Integrations:** the ingestion funnel counts live feeds only; file uploads
  (46 in 7d, 4,823 rows) are reported separately and display correctly