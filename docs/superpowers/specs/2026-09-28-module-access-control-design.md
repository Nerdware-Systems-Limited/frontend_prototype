# Module Access Control - Design Spec

**Status:** Approved direction (Approach A - reactive settings store read by the resolver), pending
user review of this written spec.

## Problem

`app/config/access-control.json` is the single source for which agencies can reach which modules,
pages and restricted data categories, and what each role tier may do. It is bundled at build time
and imported directly by `useAccessControl.ts`, so changing any grant means editing JSON and
redeploying. There is no UI for it: `/roles` manages user-to-role assignment, not what a role (or an
agency) is permitted to see.

The user wants a new page under Access Control where:

- **super_admin** controls which modules/pages/data categories each agency may access, and what each
  role within any agency can do.
- **Agency admins** have the same controls, but only for their own agency and only within what
  super_admin has scoped to that agency.

## Non-goals

- No backend. Persistence is a frontend-only mock (browser `localStorage`) behind one adapter, to be
  replaced by an accounts API later (RBAC spec §7.3). Edits do not reach other users or browsers.
- No real enforcement. Per RBAC spec §2.1 the server is the gate; this page drives the client-side
  resolver only (sidebar, route middleware, module tiles, field masking).
- No writes to the real `/audit` log, no approval workflow, no creating new roles, modules, routes,
  agencies or categories.
- No change to how *users* are assigned roles (`/roles`, `/users` stay as they are).

## Permission model

Three nested layers per agency. Each layer can only narrow the one above it, never widen it.

| Layer | Set by | Contents | Bounded by |
|---|---|---|---|
| **1. Ceiling** | super_admin only | module scopes, page scopes, category allow/deny, capability set | nothing (defaults to today's JSON grants/denies) |
| **2. Agency enabled** | super_admin, or that agency's admin | same shape as the ceiling | the ceiling |
| **3. Role permissions** | super_admin, or that agency's admin | per role tier in `agency.roleTiers`: module scopes, page scopes, capabilities | agency enabled |

Scopes are ordered `none < read < full`. Every clamp is `min(lower layer, upper layer)`, applied at
resolve time, so stored values are never rewritten when a ceiling drops. A stored value above its
ceiling is kept but shown as **capped** in the UI and resolves to the ceiling.

Defaults when a layer has no entry:

- **Ceiling:** derived from the JSON exactly as today (domain bundle ∪ `grants.*`, minus `denies.*`).
- **Agency enabled:** equal to the ceiling.
- **Role permissions:** equal to agency enabled for scopes; `roles[tier].capabilities` (the global
  default) for capabilities. So with no overrides at all, resolution is identical to today.

Capabilities catalog: the union of every `roles.*.capabilities` entry today - `export`,
`query_builder`, `run_reports`, `manage_users`, `approve_uploads`, `register_feeds`,
`configure_rules`, `acknowledge_alerts`, `update_incidents`, `submit_uploads`. Ceiling default for
an agency's capability set = union of the global capabilities of the tiers in its `roleTiers`.

Categories with platform-level enforcement (`ingestion_validation`, `not_ingested`,
`feature_flag_off`) are **locked**: they keep their JSON-derived state on every layer and cannot be
toggled - no setting here can undo an ingestion-level block. (They are not forced to *deny*: the
owning agency's own tenant, e.g. NTSA for `crash_victim`, keeps today's behaviour, so the
"no overrides = identical" rule holds.) Category `minTier` rules (`restrictedCategories.*.minTier`)
keep applying on top.

Role columns for an agency are `admin` plus its `roleTiers`, excluding `super_admin`/`public`,
most-privileged first - `admin` is always included because seeded admin accounts exist even at
agencies whose `roleTiers` omit it (e.g. SDR).

Module-level vs page-level: a module value (on any layer) applies to every page in that module
unless the same layer sets that page explicitly. A ceiling module value replaces the JSON-derived
scope for all its pages, including JSON `grants.routes` and `denies.routes` entries. M01 (Command
Centre) is not listed because its only route, `/dashboard`, is a baseline route every account
reaches.

### Who may edit what

- **super_admin:** all three layers for every agency.
- **Agency admin** (`role_type: 'admin'`, own `agency_code`): layers 2 and 3 for their own agency
  only; layer 1 is visible read-only as "what your agency has been given".
- **Anyone else:** no access to the page (route `minTier: admin`).

Self-lockout guardrail (agency admins only): an agency admin cannot, for their own agency's `admin`
role, drop `/access-policies` below `full`, drop M10 to `none`, or remove `manage_users`. super_admin
can, after a confirm warning.

Permission checks live in the store's mutation functions (they throw on an unauthorised edit), not
only in the UI's disabled states.

## Architecture

### `app/stores/accessPolicy.ts` (new, Pinia)

- `base` - the imported JSON (unchanged file).
- `overrides` - persisted: `{ version: 1, agencies: Record<Code, AgencyOverride>, updatedAt, updatedBy }`.
- `draft` - working copy of `overrides` the page edits; `dirtyCount` getter.
- `effective` - `base` merged with `overrides` (not `draft`), the value the resolver reads.
- `preview(draft)` - `base` merged with `draft`, for the page's "Preview as" panel.
- Mutations: `setCeilingModule/Route/Category/Capabilities`, `setEnabledModule/Route/Category/Capabilities`,
  `setRoleModule/Route/Capability`, `resetAgency(code)`, `discard()`, `save()`. Each checks the
  current user's rights against the target agency and layer.
- `load()` / `save()` are the only I/O and delegate to a storage adapter.

```ts
type Scope = 'none' | 'read' | 'full'
interface LayerOverride {
  modules?: Record<ModuleId, Scope>      // absent key = inherit
  routes?: Record<RouteKey, Scope>        // absent key = inherit
  categories?: Record<Category, 'allow' | 'deny'>
  capabilities?: string[]
}
interface AgencyOverride {
  ceiling?: LayerOverride                 // super_admin only
  enabled?: LayerOverride                 // super_admin or own agency admin
  roles?: Record<RoleTier, Omit<LayerOverride, 'categories'>>
  updatedAt: string
  updatedBy: string
}
```

### `app/utils/accessPolicyStorage.ts` (new)

Adapter interface `{ load(): Promise<Overrides | null>; save(o: Overrides): Promise<void> }`.
The only implementation for now is `localStorage['uapts:access-policy:v1']`. A payload with a
missing/unknown `version` or that fails to parse is ignored with a `console.warn` and the app runs
on the JSON alone. The API adapter (`GET/PUT /api/v1/access-control/`) later replaces this one file.

### `app/utils/resolveAccess.ts` (new - extracted from `useAccessControl.ts`)

A pure `resolveFor(settings, user, path): RouteResolution` containing today's eight steps
unchanged, plus:

- **Step 5b (agency enabled):** after the ceiling scope is computed (steps 4-6), clamp to the
  agency-enabled module/route scope.
- **Step 6b (role limit):** clamp to the role's module/route scope for the user's tier.
- Category denial additionally honours the layered category allow/deny.

Also a pure `capabilitiesFor(settings, user): Set<string>` = role capabilities ∩ agency-enabled
capabilities ∩ ceiling capabilities (super_admin: everything).

### `app/composables/useAccessControl.ts` (changed)

Becomes a thin wrapper: reads `useAccessPolicyStore().effective` (falls back to the JSON while
the store is not loaded - fail closed, same as today) and delegates to `resolveFor`. Public API
unchanged, plus `hasCapability(cap: string): boolean`.

### `access-control.json` (changed)

- `modules.M10.routes` gains `"/access-policies"`.
- `routes["/access-policies"] = { "module": "M10", "minTier": "admin", "agencyScoped": true }`.

### Navigation

`AppSidebar.vue` Access Control group and `AppTopNav.vue` command palette gain **Module Access →
/access-policies**, gated by `canSee('/access-policies')` like its siblings.

## Page: `app/pages/access-policies.vue`

Built from existing primitives (`PageHeader`, `SectionTitle`, `filter-bar`, banners) and
`DESIGN.md` tokens; visual polish is done against `DESIGN.md` during implementation.

- **Banner (always):** "Local preview - changes are saved in this browser only."
- **Header actions:** *Discard changes*, *Save changes*; an "N unsaved changes" pill; a
  route-leave guard when the draft is dirty.
- **Agency picker:** super_admin gets a searchable left rail of agencies (granted-module count,
  dot when overridden). Agency admin sees only their own agency, no picker.
- **Per agency:** "Last changed by … at …" line and a *Reset to defaults* action (confirm dialog).

Tabs:

1. **Agency access** - rows M01-M14, each expandable to its pages. Columns:
   - *Allowed* (ceiling): None/Read/Full segmented control; editable by super_admin, read-only for
     agency admin. Shows "inherited from domain: roads" when it comes from a domain bundle.
   - *Enabled* (agency layer): None/Read/Full; options above *Allowed* disabled with a tooltip.
   - Page rows add *Inherit* to both columns.
2. **Role permissions** - at the top, the agency-level capability sets (*Allowed* / *Enabled*,
   same editing rules as tab 1). Then a grid, rows = modules (expandable to pages), columns = the
   agency's `roleTiers`; cells are None/Read/Full capped at *Enabled*. Below it, a
   roles × capabilities checklist, options outside the agency's enabled capabilities disabled with
   a tooltip.
3. **Data categories** - each restricted category: label, owning agency, enforcement, and
   *Allowed* / *Enabled* toggles (same two-column editing rules as tab 1). Platform-blocked
   categories render locked with the reason.

**Preview as** side panel: choose a role tier; lists every page that tier would reach and at what
scope, computed with `preview(draft)` via `resolveFor`.

Guardrails: confirm warnings when removing M10 from an agency (its admins lose Access Control),
when every module ends up `none` (users land on the restricted dashboard), and for the self-lockout
cases above (blocked outright for agency admins).

## Error handling

- Save failure (quota exceeded, storage blocked): error banner, draft retained.
- Stale overrides (an agency/module/route/category key no longer in the JSON): skipped at merge and
  listed in a small "Stale overrides" note on the page with a *Clear* action.
- Store not loaded: resolver uses the JSON (fail closed).
- Unauthorised mutation: store throws; the page shows it as an action error (should be unreachable
  through the UI).

## Changes after approval (2026-09-28)

Made during implementation and UI review, at the user's request unless noted.
The permission model above is unchanged.

- **Agency rail → agency select.** The 200px rail became a select in a
  filter bar (sibling Access Control pages use the same bar); "(edited)" marks
  agencies with changes. Frees width for the tables.
- **Summary pills** in the agency bar ("5 Full · 6 Read · 3 Restricted",
  modules at the agency's enabled level) instead of a metric strip.
- **Scope selector redesign.** No "Inherit · x" option: an inherited level is a
  blue wash, a level set on that layer is solid with a reset icon (the reset
  returns to inherit). "Capped" and "Mixed" are badges. Keyboard: roving
  tabindex + arrow keys.
- **Search + filter row** above the Agency access and Role permissions tables:
  search (module name, id or page path; matching modules open), Access
  (Any / Full / Read / Restricted, judged at the enabled level page by page)
  and Filter (All / Inherited / Custom). Shared across the two tabs.
- **Overflow menu (•••)** replaces the visible Reset button: *Preview as role*,
  *View change history*, *Export permissions*, then *Reset to agency defaults*
  (destructive, last, confirmed with "Reset agency permissions?" and a
  "Reset to defaults" button).
- **Preview moved into a side drawer**; it is no longer always on screen.
- **Change history (new).** Each Save records, per changed agency, readable
  lines ("Railway - Agency limit: Read → Full"), stored with the same adapter
  (`localStorage['uapts:access-policy-history:v1']`, newest first, max 200) and
  shown in a drawer.
- **Export (new).** CSV (one row per page), JSON (pages, categories,
  capabilities) or PDF (the browser's print dialog, "Save as PDF" - no PDF
  library in the project). Exports reflect the draft and say when it includes
  unsaved changes.
- **Capabilities note.** `hasCapability()` has no consumers yet, so the Role
  permissions tab states that pages don't enforce capabilities (controller
  ruling during review; wiring enforcement is follow-up work).
- **Store is the single edit gate.** `canEditAgency` also requires an agency
  admin's own *saved* `/access-policies` scope to be `full`; unknown scope
  values in storage fail closed.
- Human labels for capabilities and category enforcement
  (`app/utils/accessLabels.ts`); tables use the shared `.stack-table` mobile
  pattern.

## Testing (Vitest, `tests/unit/`)

- **Regression:** existing 13 cases in `access-control.test.ts` pass unchanged against the
  `resolveFor` extraction.
- **`resolve-access.test.ts` (new):** no overrides ⇒ identical to today for every agency × tier ×
  route in the JSON; ceiling narrows; enabled narrows but cannot exceed ceiling; role limit narrows
  but cannot exceed enabled; dropping a ceiling caps a stored higher value; page override inside a
  module; category allow/deny per layer; platform-blocked categories cannot be allowed;
  `capabilitiesFor` intersection.
- **`access-policy-store.test.ts` (new):** merge; draft/save/discard; reset agency; corrupt or
  old-version storage ignored; agency admin cannot edit another agency, cannot edit the ceiling,
  cannot self-lock-out; super_admin can edit everything.
- **`access-policies-page.test.ts` (new, `@vue/test-utils`):** super_admin sees agency rail and
  editable *Allowed*; agency admin sees only own agency, *Allowed* read-only, *Enabled* and role
  options capped.
