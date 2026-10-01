# Roles and Permissions

_As of 2026-09-20._

This explains, in plain terms, how UAPTS decides what a signed-in user can see and do, and gives a concrete breakdown of what each agency and role actually gets. The underlying mechanism is documented in detail in `Reference.md` section 9 and lives in `app/config/access-control.json`; this file is the readable walkthrough plus the answer to "what does user X actually see."

**The frontend's access control is a convenience layer, not the security boundary.** Everything below decides what the UI shows and which pages it lets you navigate to. The real gate is the backend API (see `SECURITY_AUDIT.md` and the backend's `docs/security-recommendations-status.md`): a route being hidden here does not stop a direct API call from succeeding or failing, that is decided server-side.

## The two independent axes

Every access decision combines two separate questions, and a page only opens when both say yes:

1. **Role tier** (`usePermissions.ts`): what actions this person is allowed to take, regardless of who they work for.
2. **Agency scope** (`useAccessControl.ts`): whose data they may see, and which modules their own agency has been granted, regardless of their tier.

A KeNHA admin and an NTSA admin have the same tier (`admin`) but see completely different modules, because their agencies were granted different things. An NTSA admin and an NTSA operator see the same modules, but the operator cannot manage users, because tier caps what actions are available within that scope.

## Role tiers: what a person may do

Six tiers exist, ranked low to high. A user's tier comes from their account's `role_type` field.

| Tier | Rank | What it means | Capabilities |
| --- | --- | --- | --- |
| `public` | 10 | Read-only access to published dashboards and public data. No login required in principle; seeded test accounts also use this tier to simulate an anonymous viewer. | none |
| `operator` | 20 | Update incident status, dispatch resources, trigger feed sync, submit uploads, acknowledge alerts. | acknowledge_alerts, update_incidents, submit_uploads |
| `analyst` | 30 | Everything an operator can read, plus run ad-hoc queries, generate and download reports, export data. | export, query_builder, run_reports |
| `admin` | 40 | Manage users within their own agency, approve uploads, register data feeds, configure notification rules, plus everything analyst can do. | manage_users, approve_uploads, register_feeds, configure_rules, export, query_builder, run_reports |
| `oversight` | 50 | Cross-agency read access with no write right anywhere. Intended for Ministry-level reviewers who need to see across every agency's data without being able to change any of it. | export, query_builder, run_reports |
| `super_admin` | 100 | Full platform bypass. Every module, every agency, every scope restriction lifted. | (all, by bypass rather than a capability list) |

**A real gotcha in the seeded test data: `oversight` is a tier nothing currently logs in as.** The policy file lists `oversight` as a valid tier for SDT and SDR, and their `sdt.oversight@uapts.test` / `sdr.oversight@uapts.test` test accounts exist, but both were seeded with `role_type = 'admin'`, not `'oversight'`. No seeded login anywhere carries the literal `oversight` role. Two routes (`/agencies`, and by extension the Ministry Oversight domain's read scope) specifically account for this with a `minTierDomainOverride` that admits admin-tier accounts at SDT/SDR instead. Until a real `oversight` account exists, "oversight" behavior is only reachable indirectly through that override, on those two agencies, not as a standalone tier anyone can actually test by logging in as it.

## Agency scope: whose data a person sees

Every account (except `public` and `super_admin`) belongs to one agency, identified by `agency_code`. That agency's entry in `access-control.json` decides which modules open and at what level. Three mechanisms combine, in this order:

1. **Domain membership** (`agency.domains`). A domain is a named bundle of modules for a whole sector, for example `roads` bundles the Command Centre, Road Traffic, Safety, Infrastructure, Reporting, and GIS modules. An agency's domains grant every module in the bundle. The one exception is the `oversight` domain (SDT, SDR): it grants **read-only**, never write, across a much larger bundle spanning nearly every module in the platform. This is a deliberate different shape, not an oversight (no pun intended) in the data.
2. **The agency's own grants** (`agency.grants`), layered on top of domain membership:
   - `grants.full`: modules this agency has complete (read + write) access to.
   - `grants.read`: modules this agency can only read.
   - `grants.routes`: overrides for individual routes rather than a whole module, used when an agency needs a narrow read into one page of another domain (for example KeNHA gets read-only `/maritime/port-ops` without any other maritime access).
3. **The agency's denials** (`agency.denies`), which always win over the two above. A module or route listed here is blocked even if a domain or grant would otherwise allow it. Denials also cover restricted-data categories (see below), which mask specific fields on an otherwise-visible page rather than blocking the page itself.

On top of module/route access, a page can carry **restricted categories**, for example `crash_victim`, `vehicle_owner_pii`, or `cargo_commercial`. These do not block the page. They mask specific sensitive fields on it, either because the viewer's tier is below that category's minimum (some categories stay hidden even from an agency's own analyst, only its admin sees them), or because the category is denied to that agency's tenant entirely when reading another agency's data (KRC can read KPA's cargo routes, but never sees KPA's `cargo_commercial` fields on them).

Finally, a route can set its own minimum tier (`minTier`), independent of what the agency grants. An NTSA operator and an NTSA admin both have `full` scope on Safety, but `/notifications/rules` requires `admin` regardless of scope, so the operator cannot reach it even though their agency can.

## How a route decision actually gets made

In order, for a signed-in, non-public, non-super_admin user opening a specific page:

1. Deny by default. Nothing is open unless an explicit rule below permits it.
2. Baseline routes (`/dashboard`, `/profile`) are always reachable, so a denied user has somewhere to land.
3. `super_admin` bypasses everything from here on.
4. The user's agency must exist and be resolved, or the route is denied outright.
5. The route's module gets a starting scope from the agency's domain memberships (full, read, or none).
6. The agency's own module and route grants are applied on top, additively.
7. The agency's denials are applied last and always win, dropping the scope back to none regardless of steps 5 and 6.
8. Restricted categories on the route are checked, masking specific fields if the viewer's tier is below the category's minimum, or if the category is denied to this tenant.
9. The route's minimum tier is checked (with the SDT/SDR oversight-domain override noted above). Below it, denied regardless of scope.
10. Anything that survives all of the above is allowed, at whatever scope (full or read) it resolved to.

Anything denied redirects to the safe space (`/dashboard`, in restricted mode), never to an error page and never silently allowed through.

## What each agency can access

Module codes are the same M01 to M14 codes used throughout the codebase; see `README.md`'s page map for the full route list per module. "Full" means read and write; "read" means view only. Every agency also gets `/notifications` at least read-only and `/dashboard` at least read-only, via baseline routes or an explicit grant, not repeated per row below.

| Agency | Full name | Domain(s) | Seeded tiers | Full access | Read-only extras | Explicitly denied |
| --- | --- | --- | --- | --- | --- | --- |
| KENHA | Kenya National Highways Authority | roads | admin, analyst, operator | M02, M05, M06, M09, M10, M12, M13 | Fleet, Maritime port-ops/imports-exports, Railway freight | M04, M07a, M14, all other Maritime routes |
| KURA | Kenya Urban Roads Authority | roads, urban_transit | admin, analyst, operator | M02, M06, M09, M10, M12, M13 | Public transport overview/BRT, Safety, Blackspots | M03, M07a, M07b, M08, M14, PT compliance/licensing/registration/inspections/operators |
| KERRA | Kenya Rural Roads Authority | roads | admin, analyst, operator | M05, M06, M09, M10, M13, Integrations (full) | Traffic, Traffic analytics | M03, M04, M07a, M07b, M08, M14 |
| SDR | State Dept for Roads (Roads Directorate) | oversight | oversight, analyst (also seeded: admin, operator, not spec'd) | M06, M09, M10, M13 | M02, M05 (read via oversight domain, read-only across nearly everything else), Fleet, Fleet behaviour, Integrations analytics, Notifications (full) | M04, M07a, M07b, M08, M14; write anywhere is denied regardless of grants (oversight is read-only) |
| SDR_MTD | State Dept for Roads, Mechanical & Transport Directorate | fleet | admin, analyst, operator | M03, M09, M10, M12 | Infrastructure projects | M02, M04, M05, M07a, M07b, M08, M14, GIS, Query Builder |
| COUNTY_GOV | County Government | (none, provisional) | admin, analyst | M09, M10 | Traffic, Public transport overview, Infrastructure overview | none module-level; PT sub-routes stay denied by default |
| KAA | Kenya Airports Authority | (none, provisional) | admin, analyst | M07a, M09, M10 | | none module-level |
| KCAA | Kenya Civil Aviation Authority | (none, provisional) | admin, analyst | M07a, M09, M10 | M05 (Safety, as aviation safety regulator) | crash_victim category |
| KMD | Kenya Meteorological Department | (none, provisional) | admin, analyst | M09, M10 | M13 (GIS), Traffic alerts | none module-level |
| KRA | Kenya Revenue Authority | (none, provisional) | admin, analyst | M09, M10, M12 | Maritime imports/exports (single route) | cargo_commercial category |
| KRB | Kenya Roads Board | (none, provisional) | admin, analyst | M06, M09, M10 | M02 | none module-level |
| KENTRADE | Kenya Trade Network Agency | (none, provisional) | admin, analyst | M09, M10, M12 | Maritime port-ops (single route) | none module-level |
| NPS | National Police Service | (none, provisional) | admin, analyst | M05, M09, M10 | M02, Traffic alerts | crash_victim category |
| KWS | Kenya Wildlife Service | (none, provisional) | admin, analyst | M09, M10, M13 | M05 (Safety) | crash_victim category |
| SDT | State Department for Transport | oversight | oversight, admin, analyst, operator (seeded accounts are all `admin`) | M09, M10, M13 | Read-only across nearly everything via the oversight domain | land_parcel, resettlement, critical_infrastructure, procurement categories |
| NTSA | National Transport and Safety Authority | regulation | admin, analyst, operator | M03, M04, M05, M09, M10, M12 | Traffic, Traffic analytics, GIS, Infrastructure overview | M07a, M07b, M08, M14, Infrastructure bridges/maintenance/projects/funding |
| NAMATA | Nairobi Metropolitan Area Transport Authority | urban_transit | admin, analyst, operator | Public transport (full), M09, M10, M12, M13 | Fleet, Traffic, Railway schedules | M06, M07a, M07b, M14, PT compliance/licensing/registration/inspections, Safety incidents |
| KRC | Kenya Railways Corporation | rail | admin, analyst, operator | M08, M14, M09, M10, M12, M13 | Maritime port-ops/imports-exports/cargo, Fleet | M02, M04, M05, M06, M07a, all other Maritime routes; cargo_commercial category |
| KPA | Kenya Ports Authority | maritime | admin, analyst, operator | Maritime (full, most routes), M09, M10, M12 | GIS, Maritime vessels/accidents/waterways | M02, M03, M04, M05, M06, M07a, M14 |
| KMA | Kenya Maritime Authority | maritime | admin, analyst, operator | Maritime vessels/accidents/waterways/services/infrastructure (full), M13, M09, M10, M12 | Maritime overview, port-ops, performance | M02, M03, M04, M05, M06, M07a, M08, M14, Maritime cargo/imports-exports |
| NCTTCA | Northern Corridor Transit and Transport Coordination Authority | corridor | admin, analyst | M09, M10, M12 | Maritime port-ops/performance/imports-exports, Traffic analytics, Railway freight, GIS | M03, M04, M05, M06, M07a, M14, Query Builder; member_state_data category |
| LAPSSET | LAPSSET Corridor Development Authority | corridor | admin, analyst | M13, M09, M10, M12 | Infrastructure projects, Maritime port-ops, Railway freight | M02, M03, M04, M05, M07a, M14, Query Builder |

**Provisional agencies.** Every agency marked "(none, provisional)" above (COUNTY_GOV, KAA, KCAA, KMD, KRA, KRB, KENTRADE, NPS, KWS) was added on 2026-09-18 solely so the RBAC test-account seed had a real `agency_code` to resolve against. None has a completed UAPTS Needs Assessment return on file; the grants shown are a best guess at the agency's real mandate, not confirmed policy. `access-control.json` says so explicitly on each of these entries.

## Category-based field masking

Separate from page-level access, some fields on an otherwise-visible page are hidden unless a further condition is met:

| Category | What it covers | Owning agency | Only visible to |
| --- | --- | --- | --- |
| crash_victim | Individual crash victim records | KENHA, NTSA | Nobody; blocked at ingestion platform-wide |
| anpr_plate | ANPR / number plate data | KENHA, NTSA | Nobody; feature flag off |
| land_parcel, resettlement | Parcel-level land acquisition, resettlement/grievance records | KENHA | KeNHA's own tenant only |
| road_reserve_boundary | Road reserve boundary geometry | KENHA | Layer-permission gated |
| critical_infrastructure | Security-related infrastructure GIS layers | KURA, SDR | Admin tier and above, within the owning tenant |
| procurement | Tender, contractor pricing, bid, dispute records | KENHA, KURA, KERRA, SDR | Admin tier and above, within the owning tenant |
| high_res_geometry | Precise road/bridge coordinates, collapse-prone segments | KERRA | Admin tier and above, within the owning tenant |
| passenger_pii | Passenger ticketing name/ID/phone/nationality | KRC | Nobody; blocked at ingestion, only aggregates ever enter the platform |
| cargo_commercial | Consignee/shipper identity, commercial cargo values | KPA | Admin tier and above within KPA; denied outright to every other agency reading KPA's routes (KRC) |
| vehicle_owner_pii | Vehicle owner details, licence lifecycle | NTSA | Admin tier and above, within NTSA |
| driver_conductor_pii | Driver and conductor details | NAMATA, KENHA | Nobody; pseudonymised at ingest, the raw value never exists on the platform |
| member_state_data | Member state customs and border data | NCTTCA | Not re-shareable, exported, or shown publicly without an NDA/MoU |
| vessel_owner_pii | Vessel owner details | KMA | Admin tier and above, within KMA |
| lease_commercial | Lease programme commercial terms | SDR_MTD | Admin tier and above, within SDR_MTD |
| hr_records | Personnel and HR records | (all) | Nobody; never ingested |

## Worked examples from the seeded test accounts

The 62 `*@uapts.test` accounts (password `ChangeMe!` for all of them, see the backend's `seeds/sql/02_seed_rbac_test_accounts.sql`) give a concrete way to see this in action:

- **`ntsa.admin@uapts.test`** (admin, NTSA): lands on `/safety`. Full access to Public Transport, Fleet, Safety, Reporting/Query Builder, Access Control (own tenant's users/roles/audit), and Integrations. Read-only into Traffic, GIS, and the Infrastructure overview. Denied Aviation, Maritime, Railway, and Training entirely. Can see `vehicle_owner_pii` fields because NTSA's own admin tier meets that category's minimum.
- **`ntsa.analyst@uapts.test`**: identical module access to the admin above, but cannot open `/users`, `/roles`, or `/audit` (those require `admin` tier specifically, not just NTSA's grant). Can still export, run reports, and use the query builder.
- **`ntsa.operator@uapts.test`**: same modules again, minus anything requiring `admin` (`/notifications/rules`) or `analyst` (`/analytics`). Can update incident status and reach `/reports`, since that route's minimum tier is `operator`.
- **`kaa.admin@uapts.test`** (admin, KAA): lands on `/aviation`. Full Aviation, Reporting, and its own Access Control. Nothing else, no read-only extras, no domain membership at all, this is a standalone grant.
- **`sdt.oversight@uapts.test`** and **`sdr.oversight@uapts.test`**: despite the name, both are seeded `role_type='admin'`, not `oversight`. They get SDT/SDR's admin-tier access (including the `/agencies` override), not the broader cross-agency oversight-tier read scope the account name implies.
- **`platform.public@uapts.test`** (`public`, no agency): the single fixed public dashboard view only. No PII category, ever, on any account at this tier.
- **`platform.noagency@uapts.test`** (`analyst`, no agency): a deliberate edge case. Without an agency, step 4 of the resolution algorithm denies every route except the two baseline ones, `/dashboard` and `/profile`, regardless of tier. This is the expected, correct behavior for an account with a role but no tenant.
- **`platform.superadmin@uapts.test`**: originally seeded `role_type='admin'` with no agency, the same broken shape as `platform.noagency` above (restricted to `/dashboard` and `/profile` only, not the bypass its name implies). Fixed as part of writing this document: `role_type` is now `super_admin` and `is_superuser=true`, both in the live seed and in `seeds/sql/02_seed_rbac_test_accounts.sql` for future re-runs.

## Where this is managed

- `/roles` and `/users` (both admin-tier, agency-scoped) are where an agency's own admin manages their tenant's accounts and role assignments.
- `/agencies` is the platform-wide agency directory, restricted to oversight tier and super_admin (with the SDT/SDR admin override noted above); creating or editing an agency is further narrowed to super_admin only.
- `/access-policies` ("Module Access") is where access is adjusted without editing files. super_admin sets what each agency is **allowed** (modules, individual pages, restricted data categories, capabilities). Within that limit, the agency's own admin decides what the agency has **enabled** and what each of its roles (admin, analyst, operator, ...) can reach. Each level can only narrow the one above it, and an agency admin can never remove their own ability to manage access. Changes are a draft until saved, every save is recorded in the page's change history, and "Preview as role" shows exactly which pages a role would reach.
- **For now those changes are saved in the browser where they are made**, and the page says so: they don't reach other users or the server until the accounts API takes over storage. `app/config/access-control.json` remains the baseline everything above narrows from, and with nothing saved, access is exactly as described in this document.
- Capabilities (export, query builder, manage users, ...) set on that page are recorded and shown in its preview but not yet enforced by the pages themselves; those still use the role tiers described above.
- Changing the baseline policy itself (an agency's domains, default grants and denials, a new category) still means editing `app/config/access-control.json`; `Reference.md` section 9 covers the file and section 9.7 the Module Access layers on top of it.
