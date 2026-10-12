# Access control (technical)

_Verified against the code on 2026-10-12. The plain-language walkthrough and per-agency table are in
[ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md). This page is the implementation._

> **Not a security boundary.** Every check here decides what the UI shows and which routes it will open. The
> backend enforces the real rules on every request and on every policy save (`apps/access_control`). See
> [SECURITY.md](SECURITY.md).

## 1. Moving parts

| Piece | File | Role |
|---|---|---|
| Role tier gate | `composables/usePermissions.ts` | What actions the person may take (`public < operator < analyst < admin < super_admin`) plus capability checks |
| Agency scope resolver (pure) | `utils/resolveAccess.ts` | `resolveFor(overrides, subject, path)`, layer maths, stale-key handling |
| Reactive wrapper | `composables/useAccessControl.ts` | Binds the resolver to the signed-in user and the **saved** overrides |
| Policy store | `stores/accessPolicy.ts` | Overrides, draft, permissions, history, save/discard |
| Storage adapter | `utils/accessPolicyStorage.ts` | API adapter (default in the app) and `localStorage` adapter (tests) |
| Registration | `plugins/access-policy.client.ts` | Installs the API adapter, resets on sign-out |
| Loading | `middleware/auth.global.ts` | `ensureLoaded()` after authentication, before the first route is resolved |
| Field masking | `composables/useFieldMask.ts` | Hides restricted-category values on a page |
| Account scoping | `composables/useAgencyScope.ts` | Agency admins manage only their own agency's accounts |
| Page | `pages/access-policies.vue` + `Access*.vue` components | The Module Access UI |

## 2. Where the policy comes from

Since the "move access controls to backend" change there is **no `access-control.json` in `app/config/`**. Three
server documents drive everything:

| Endpoint | Content | Held in |
|---|---|---|
| `GET /api/v1/access-control/baseline/` | The baseline policy: roles, domains, modules, routes, 22 agencies, restricted categories, defaults | `BASE_SETTINGS` (a Vue `reactive`, mutated in place by `setBaseSettings`) |
| `GET` / `PUT /api/v1/access-control/` | Saved overrides. A super admin receives every agency; anyone else only their own | `accessPolicy.overrides` |
| `GET /api/v1/access-control/viewer/` | Dashboard permission codes the signed-in user earns, derived server-side from module access | `accessPolicy.permissions` |
| `GET /api/v1/access-control/history/` | Change log, newest first. Super admins and agency admins only | `accessPolicy.history` |

**Fail closed.** `BASE_SETTINGS` starts as `emptySettings()` (nothing granted). If the baseline cannot be loaded
or is the wrong shape, the app logs a warning and every lookup stays denied, except the baseline routes.

**Tests.** `tests/setup.ts` loads `tests/fixtures/access-control.json`, a copy of the backend's
`apps/access_control/data/access-control.json`, into `BASE_SETTINGS`. Refresh the fixture when the backend file
changes. `page-access-coverage.test.ts` and `agency-module-summary.test.ts` check that every page and module is
classified, so a new page or module cannot silently fall outside the policy.

### Baseline shape (`AccessSettings`)

```
defaults      safeSpace {route, mode}, denyRedirect, newAccountTier, failClosed, baselineRoutes
roles         tier number + bypassScope / capabilities / crossAgencyRead / write
domains       named module bundles (roads, fleet, urban_transit, regulation, rail, maritime, aviation, corridor, oversight)
modules       M01..M14 (+ routes[])
routes        per route: module, minTier, allowRoles?, agencyScoped, categories?, minTierDomainOverride?
agencies      per agency: domains, landing, roleTiers?, grants {full, read, routes}, denies {modules, routes, categories}
publicView    the single route the public tier sees
restrictedCategories  label, owningAgency, enforcement, minTier?
```

Role tiers in the current baseline: `super_admin` (100, bypass), `oversight` (50), `admin` (40), `analyst` (30),
`auditor` (25, may open `/audit` through `allowRoles`), `operator` (20), `public` (10).

## 3. Resolution algorithm

`resolveFor(ov, subject, path)` returns `{ allowed, scopeLevel, reason, module, deniedCategories, isSafeSpace }`.
Deny by default.

1. No subject: denied.
2. **Baseline routes** (`defaults.baselineRoutes`, e.g. `/dashboard`, `/profile`): allowed at the stated scope for
   any signed-in account, so the safe space is always reachable.
3. `public` tier: denied (single fixed view only).
4. `super_admin` (the only `bypassScope` tier): allowed at `full`.
5. The account must have an `agency_code` that exists in the baseline, else denied.
6. The path must match a known route and that route must belong to a module.
7. **Scope** = `pageScope(ov, agency, 'role', customRole || roleTier, route)`: baseline domain bundle, grants and
   denies form the *ceiling*, then the agency's *enabled* layer and the role layer can only narrow it.
8. **Restricted categories** on the route: a category is denied when the viewer's tier is below the category's
   `minTier`, or the agency's enabled layer denies it. This masks fields, it never blocks the route.
9. Scope `none`: denied.
10. **Route minimum tier** (`minTier`, optionally lowered by `minTierDomainOverride` for agencies in a domain,
    and bypassed for roles listed in `allowRoles`): below it, denied.
11. Otherwise allowed at the resolved scope.

A denial redirects to the safe space, never to an error page. `auth.global.ts` does not redirect when the user is
already on the safe-space route.

`custom_role` (a per-agency custom Role's name, when it differs from `role_type`) replaces the tier for **page and
module scope only**. Capabilities and the route's `minTier` stay on `role_type`. The backend's
`apps/access_control/resolver.py` implements the same algorithm; keep both in step.

## 4. Module Access: three override layers

Stored as `PolicyOverrides = { version: 1, agencies: { [code]: AgencyOverride } }`.

| Layer | Set by | Starts as | UI wording |
|---|---|---|---|
| `ceiling` | super admin | baseline (domains + grants - denies) | "Allowed by super admin"; history "Agency limit" |
| `enabled` | super admin or that agency's admin | the ceiling | "Enabled for agency"; history "Agency access" |
| `roles[tier]` | super admin or that agency's admin | enabled | per-role column; history "Analyst role", ... |

Each layer can hold `modules`, `routes` (values `none | read | full`), `categories` (`allow | deny`, ceiling and
enabled only) and `capabilities`. A module value covers all its pages unless the same layer also sets a page. An
absent key means "inherit from the layer above". A layer can only narrow the one above.

Platform-wide category blocks (`ingestion_validation`, `not_ingested`, `feature_flag_off`) cannot be changed.

Capabilities are tier defaults that an agency can switch off. The list (`CAPABILITIES`) is built at runtime from the
`capabilities` arrays on the baseline's roles: currently `export`, `query_builder`, `manage_users`,
`approve_uploads`, `register_feeds`, `configure_rules`, `run_reports`, `acknowledge_alerts`, `update_incidents`
and `submit_uploads`. A gated control needs **both** the tier and the capability (`usePermissions().canExport`,
`canUseQueryBuilder`, `canManageUsers`).

## 5. The policy store

- `overrides`: the saved state the resolver reads. `draft`: what `/access-policies` edits until Save.
- **Every change goes through `edit(code, AccessEdit)`**, which checks the viewer's rights first:
  super admin may edit any agency and layer; an agency admin may edit their own agency's `enabled` and role
  layers, and only while their own saved scope on `/access-policies` is `full`. An agency admin cannot make an
  edit that removes their own full access to `/access-policies` or their `manage_users` capability
  (`adminCanManagePolicy`, the self-lockout check).
- `save()` PUTs the draft, adopts the document the server stored (it prunes, sorts and stamps `updatedBy` and
  `updatedAt`), then re-reads the server-recorded history. The `localStorage` adapter has no `recordsHistory`, so
  the store builds history entries client-side instead (`describeChanges`).
- `ensureLoaded()` loads once per signed-in account: baseline first, then overrides, permissions, custom role
  tiers and built-in roles. It never throws. `reset()` forgets everything and runs on sign-out.
- `dirtyAgencies`, `isDirty`, `staleKeys` (overrides naming agencies, modules, routes or roles the baseline no
  longer knows), `discard()`, `resetAgency()`, `clearStale()`.
- `useAccessControl()` reads **saved** overrides only, never the draft, so unsaved edits do not change navigation.

Pure helpers shared by the resolver, store and page: `accessEdits.ts` (`AccessEdit` union, `applyEdit`,
`pruneOverrides`, `editWarning`), `accessHistory.ts`, `accessExport.ts` (CSV, JSON and print-to-PDF export),
`accessFilter.ts`, `accessLabels.ts`.

## 6. The `/access-policies` page

- Agency bar: agency select for super admins (a dot marks agencies with unsaved edits) or the admin's own agency,
  status pills, last-saved line and a menu with *Preview as role*, *View change history*, *Export permissions*
  and *Reset to agency defaults*.
- Tabs: **Agency access**, **Role permissions**, **Data categories**. The first two share a search, an Access
  filter (Any / Full / Read / Restricted) and a Filter (All / Inherited / Custom).
- Edits are a draft until *Save changes*. *Discard*, a leave-page guard and `beforeunload` protect unsaved work.
  A super admin is asked to confirm edits with a serious consequence.

## 7. How other code consumes access

| Consumer | Uses |
|---|---|
| `auth.global.ts` | `resolveRoute(path)` on every navigation |
| `AppSidebar.vue`, command palette in `AppTopNav.vue` | `canAccessRoute` / `canAccessModule` to hide links |
| `useFieldMask(path)` | `deniedCategories` to mask restricted fields |
| `AgencyCommandCentre.vue` | module scope per tile |
| `ExportButton`, query builder Run, `/users` and `/roles` writes | `usePermissions()` tier + capability |
| Dashboard Manager | `useViewerContext()` reads `accessPolicy.permissions`; `utils/agencyCatalog.ts` resolves what an owner agency may put on a dashboard using the same `pageScope` |

## 8. Known limits

- **Capability gates are client-side only.** Switching a capability off hides the control but the backend's
  export, query and user endpoints still gate on role tier alone.
- **The baseline is vendored twice** (backend data file and the test fixture). Change them together.
- **PDF export** uses the browser print dialog; there is no PDF library.
- If the baseline request fails the whole app stays at "baseline routes only" until reload.
- Seeded `*.oversight@uapts.test` accounts carry `role_type = admin`, not `oversight`; see
  [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).

## 9. Tests

All under `tests/unit/`: `access-control`, `resolve-access`, `access-baseline-load`, `access-policy-store`,
`access-policy-api-storage`, `access-policy-middleware`, `access-policy-wiring`, `access-policies-page`,
`access-scope-toggle`, `access-filter`, `access-history`, `access-role-columns`, `capability-gates`,
`page-access-coverage`, `module-scope`, `agency-scope`, `field-mask`, `role-options`.
