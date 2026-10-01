# Dashboard Manager: frontend ↔ backend integration notes

Status as of 2026-09-29, checked against the deployed backend at
`http://192.168.0.110:8000` (live requests) and the reference package's
`backend/apps/dashboards` (read-only).

## How the frontend reaches the backend

- `NUXT_PUBLIC_API_BASE` in `.env` is the backend address.
- In `nuxi dev` the Nuxt dev server proxies `/api`, `/ws` and `/media` to it
  (`nitro.devProxy` in `nuxt.config.ts`), so the browser stays same-origin: no
  CORS/CSRF change is needed on the backend. Auth is the existing Bearer JWT,
  forwarded as-is. `app/utils/apiBase.ts` switches every call site between
  same-origin (dev) and the absolute URL (production builds).
- The Dashboard Manager client (`app/composables/useDashboardApi.ts`) goes
  through the shared `$api` plugin: same token, silent refresh, forced logout.

## Differences between the package and the deployed backend

| # | What | Package / expectation | Deployed / UAPTS reality | Frontend handling |
|---|---|---|---|---|
| 1 | Mount point | `/api/dashboards/` | `/api/v1/dashboards/` (live schema; `/api/dashboards/` is 404) | Client uses `/api/v1/dashboards` |
| 2 | Directory | `settings.DASHBOARDS_AGENCIES` + Django Groups | `GET /directory/` returns `{"agencies":[],"roles":[]}` | `useDashboardDirectory` falls back to `/api/v1/accounts/` agencies, departments and role names, and says so |
| 3 | Viewer agency / department | `viewer.py` reads `user.agency(_code)` / `user.department(_code)` via a `.code` attribute | UAPTS `Agency` has `agency_code`, `Department` has `department_code`, no `.code`; the default adapter yields `None` for both | Frontend reads the real codes. **Backend needs `DASHBOARDS_VIEWER_ADAPTER` (below)**, otherwise agency/department/role-in-department assignments never match on the server |
| 4 | Permissions | Django permissions: `safety.view`, …, `dashboards.manage(_agency)` | UAPTS users carry no such permissions; access is module grants (`access-control.json`) + `role_type` | Frontend derives the same codes from module access (`VIEWER_PERMISSION_RULES` in `useViewerContext.ts`). Server needs the same mapping in the adapter, or every domain widget is stripped for non-superusers |
| 5 | `dashboards.manage` naming | Django reports model permissions as `<app_label>.<codename>` | Models declare `manage` / `manage_agency` on app `dashboards` → `dashboards.manage`, `dashboards.manage_agency` - consistent | Same strings used in the frontend |
| 6 | Summary filters | Widgets send `county, road, severity, agency, vehicle_class, date_from, date_to` | Live test: safety, fleet, railway, aviation, maritime summaries ignore all of them; infrastructure honours `agency` **as an Agency UUID** (`?agency=KeNHA` → HTTP 500) | `DOMAIN_FILTERS` in `metricRegistry.ts`; only honoured params are sent; infra translates code → UUID; widgets say "Not filtered by …" |
| 7 | Incident trend | Widget reads `incident_trend_30d` | `/safety/summary/` returns only `fatality_trend_30d` | Chart shows fatalities only until the field exists |
| 8 | Feed-health agency filter | Widget sent `agency` | Integrations list filters on `agency_code` | Widget sends `agency_code` |

## Suggested backend adapter (for the backend team - not applied)

```python
# settings.py
DASHBOARDS_VIEWER_ADAPTER = "apps.accounts.dashboards_viewer.viewer_for_uapts"
```

It must return a `Viewer` with:

- `agency_code = user.agency.agency_code if user.agency else None`
- `department_code = user.department.department_code if user.department else None`
- `roles = {user.role.role_name, user.role_type}` (drop `None`)
- `is_super_admin = user.is_superuser or user.role_type == "super_admin"`
- `permissions` = the codes in `VIEWER_PERMISSION_RULES` the user earns from
  the same module access the frontend resolver computes (e.g. `safety.view` ⇔
  module M05 reachable; `dashboards.manage` ⇔ super admin;
  `dashboards.manage_agency` ⇔ agency `admin` tier).

Until then the server is still the authority: it resolves and strips with
whatever its viewer says, and the frontend shows exactly what it returns.
