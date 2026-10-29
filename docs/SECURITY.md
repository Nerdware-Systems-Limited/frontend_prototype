# UAPTS Security

_Originally written 2026-10-07; revised 2026-10-26 against the current code. What changed in that revision: Module Access capabilities are now partly enforced by the API and role grants can lift a route's minimum tier (section 2, gaps 1, 4a, 6a); gap 4b was added (page scope is not enforced by most APIs); source line references and the `npm audit` counts were refreshed. Gaps 2 to 12 and 14 to 19 were not re-tested live. Written from the code and configuration, not from the design documents._

## Scope and method

UAPTS is two codebases:

| Part | Role |
|---|---|
| **Frontend** | Nuxt single-page app. Holds no data of its own. |
| **Backend** | Django REST API. Every security decision that matters is made here. |

Frontend statements come from this repo. Backend statements come from reading `backend_konza` (file references are relative to it). A few were also confirmed by calling the live API through Django's test client against the **development** database: record counts, one read-only SQL query, and one account-creation probe that was deleted immediately afterwards. Nothing was run against production, and no secret values were read.

Two things in the repos are **not** evidence and were not relied on: `README.md`/`docs/*.md` describe a target architecture that is only partly built, and `backend_konza/docs/overview.md` states response SLAs and an on-call rota that the code does not back (see section 9). Where this document and those disagree, this document reflects the code.

**Legend.** *Verified* = seen in code or checked live. *Not verified* = I could not confirm it from the repos.

---

## 1. Overview

**What it does.** UAPTS (Unified Analytics and Predictive Transport System) is a national transport dashboard. It brings together road safety, fleet and vehicle tracking, public transport, road infrastructure, rail, aviation, maritime, traffic and training data from Kenyan transport agencies, adds GIS views, reporting and an ad-hoc query tool, and lets administrators control who sees what.

**Stack**

| Layer | Technology (from `package.json`, `requirements.txt`, settings) |
|---|---|
| Frontend | Nuxt 4.4 and Vue 3.5 as an SPA (`ssr: false` for all routes, `nuxt.config.ts`), Pinia, Tailwind, Leaflet and protomaps. Tests: Vitest. |
| API | Django 4.2.30, Django REST Framework 3.16, SimpleJWT, dj-rest-auth and django-allauth |
| Realtime and jobs | Django Channels (Daphne), Celery with Celery Beat, Redis |
| Data stores | PostgreSQL/PostGIS (primary), MongoDB (notifications only), Redis (cache, channel layer, broker), local disk (`media/`) |
| Edge | Nginx with TLS 1.2/1.3 (`nginx/conf.d/uapts.conf`), Docker Compose (`docker/`) |

**Sensitive data handled**

- **Accounts:** email, optional username, phone number (for SMS MFA), role, agency, login history and IP/user-agent in the audit log.
- **Operational records:** incidents, accidents, black spots, emergency dispatches; vehicle, driver and licence records and GPS tracks; traffic violations; rail, aviation and maritime operations; infrastructure condition and budgets.
- **Agency integration secrets:** per-feed credentials (encrypted at rest) and service-account API keys (stored hashed).
- **Uploaded files** from agencies (spreadsheets), kept under `media/integration_uploads`.
- **Personal data rules in code:** `core/pii.py` cites Kenya's Data Protection Act 2019. Passenger-level rail ticketing is **refused at ingest**: an upload template can declare forbidden header patterns and the parser rejects the whole file before reading a row.

---

## 2. Authentication and authorization

### Login and sessions (verified)

- **Login:** email or the optional username, plus password (`apps/accounts/views_auth.py`, `serializers/auth.py`). Self-service registration is **not** open: `RegisterView` is admin-only. Accounts are created by admins through `POST /api/v1/accounts/users/`, which sets a random 14-character temporary password and emails it once. The password is never stored in plaintext.
- **Password rules** (`settings.py:304-309`): minimum length 10, no common passwords, not all-numeric, not similar to user attributes.
- **Lockout:** 5 failed logins lock the account for 15 minutes (`ACCOUNT_LOCKOUT_THRESHOLD`, `ACCOUNT_LOCKOUT_MINUTES`). An admin can unlock accounts in the Django admin.
- **MFA:** six-digit email or SMS code, valid 5 minutes, 5 attempts, stored hashed with Django's password hasher, single use (`apps/accounts/otp.py`). Privileged roles must enrol within a 14-day grace period or login is refused (`MFA_ENFORCEMENT_GRACE_DAYS`).
- **Tokens:** JWT (HS256) access token for 15 minutes and refresh token for 7 days. Refresh tokens are rotated and the old one blacklisted (`SIMPLE_JWT`, `settings.py:622-627`). Changing a password blacklists outstanding refresh tokens, per the comment in `app/stores/auth.ts` (`changePassword`).
- **Throttles** (`settings.py:692` onward): login 5/min, password reset 3/min, MFA challenge 3/min, OTP send 2/min, token refresh 10/min, SQL console 30/min, plus anonymous 120/min and user 300/min globally. Nginx adds per-IP request limits.
- **Machine access:** service accounts authenticate with an `X-API-Key` header checked against a stored hash (`core/authentication.py:74`).
- **Frontend session handling** (`app/stores/auth.ts`):
  - The access token lives in memory only.
  - The refresh token and cached user profile go to `localStorage` if "Remember for 30 days" is ticked, otherwise `sessionStorage`.
  - A silent refresh runs on a 401, once.
  - Open tabs of one browser share a session-only login over a `BroadcastChannel` (`app/utils/tabSync.ts`). A Web Lock stops two tabs refreshing with the same rotating token, and signing out in one tab signs out the rest. Messages stay inside the browser and are never persisted.
  - A route guard (`app/middleware/auth.global.ts`) requires a live or refreshable session on every page except `/login`, `/forgot-password` and `/reset-password/*`.

### Roles and access (verified)

- **Roles** (`User.ROLE_CHOICES`): `super_admin`, `ministry_admin`, `ministry_analyst`, `admin` (agency admin), `analyst`, `operator`, `auditor`, `public`. Per-agency custom roles inherit a base tier.
- **Backend enforcement:** every view requires authentication by default. The auditor is an ordinary role (it used to be confined to audit endpoints by middleware, which was removed on 2026-10-07): it ranks between operator and analyst, Module Access governs its pages, and it keeps read-only access to the audit-log views. Role gates live in `core/permissions.py`.
- **Tenant scoping** is applied per view. For example, a scoped agency admin sees only their own agency's users, road segments, bridges and uploads. It is **not** applied everywhere (see gap 4).
- **Module Access:** the baseline policy (roles, modules, routes, agency grants) is served by `apps/access_control` and edited from the Access Policies page.
- **Capabilities (added 2026-10-26):** seven of the ten Module Access capabilities are now checked on the server by `capability_permission` (`apps/access_control/permissions.py`), in addition to the view's role gate: `manage_users` (user and role writes), `query_builder` (query execute/join, saved queries, SQL console), `export` (the shared export action), `run_reports` (report generate), `approve_uploads` (upload commit, GIS layer promote), `register_feeds` (feed register and test-connection) and `configure_rules` (alert rule and escalation policy writes). The check only narrows: switching a capability off for a role now blocks the API call, not just the button, but switching one on never widens what the role's own gate allows. Accounts with no agency that are not super admin hold no capabilities. `acknowledge_alerts`, `update_incidents` and `submit_uploads` appear in the matrix but are **not enforced anywhere** (gap 6a). Department and agency writes are also not checked against `manage_users` on the server (they only need `IsAdminRoleOrReadOnly`); the Departments tab hides its Edit and Delete buttons without the capability, which is a UI convenience.
- **Role grants can lift a route's minimum tier (added 2026-10-26):** an explicit role-level module or page grant in Module Access clears the route's `minTier` on tenant-scoped routes, in both the frontend resolver and `apps/access_control/resolver.py`. This is how an agency admin can open Access Control pages to an analyst. The grant is capped by the agency's enabled layer, platform-wide routes (`agencyScoped: false`, e.g. `/agencies`) keep the floor, and an inherited value does not count. It controls page access only: actions still depend on the role gate and capability of each endpoint (for example `IsAdminRole` still refuses user writes from an analyst).
- **Module Access page scope is mostly not enforced by the API.** The None/Read/Full value a page resolves to is enforced server-side only where a view opts in with `ModuleAccessPermission` (`access_route`/`access_routes`). Today that is the maritime API (`apps/aviation_maritime/access.py`, which also masks `cargo_commercial` and `vessel_owner_pii` fields). The infrastructure API (`apps/infrastructure/access.py`) and the query datasets (`apps/analytics/query.py`) apply the same page check. Everywhere else it hides pages in the SPA, and the API relies on each view's role gate and tenant scoping (gap 4b).
- **Changes to Module Access are recorded.** The server stamps `updatedBy`/`updatedAt`, writes append-only history rows (`tbl_access_policy_changes`) and an `AuditLog` row per changed agency (`apps/access_control`). The history drawer on the Access Policies page reads them.
- **Frontend gating is a convenience layer, not a boundary.** `resolveAccess.ts` decides which pages and navigation items appear. A direct API call ignores it. `docs/SECURITY_AUDIT.md` makes the same point.
- **Dashboards:** the server strips widgets a viewer lacks permission for, and validates the definition (`apps/dashboards/validation.py`: allowed widget types, size limits, in-app `drill-down` routes, and `https://` or in-app image URLs only).

---

## 3. Data protection

| Aspect | What the code does |
|---|---|
| **Primary store** | PostgreSQL/PostGIS holds accounts, operational data, uploads' parsed rows and the audit log. |
| **Notifications** | MongoDB, behind a repository layer (`apps/notifications/repositories.py`). Entries can carry `expires_at`. |
| **Cache, channels, queue** | Redis. Production compose requires `REDIS_PASSWORD`. |
| **Files** | Uploaded spreadsheets in `media/integration_uploads` on local disk. Who can fetch them from `/media` was not assessed. |
| **Passwords, MFA codes, service-account keys** | Hashed with Django's hashers (`PASSWORD_HASHERS` is not overridden, so Django's default applies). |
| **Feed credentials** | Encrypted with Fernet (`apps/integrations/crypto.py`). |
| **Driver identifiers** | `core/pii.py` can pseudonymise with an HMAC keyed by `PSEUDONYMISATION_KEY`, falling back to `SECRET_KEY`. Masking is applied when reading, and values are stored in plaintext. |
| **In transit** | Nginx serves TLS 1.2/1.3 with HSTS (`uapts.conf:42,52`). With `DEBUG` off, Django also forces HTTPS, secure cookies and HSTS (`settings.py:887-898`). WebSockets use `wss://` in production config. |
| **At rest** | **No database, volume, Mongo or media encryption is configured in the repo.** Only the Fernet-encrypted feed credentials are encrypted at the application level. Disk or volume encryption, if any, is an infrastructure matter outside this code. |
| **Browser storage** | `localStorage`/`sessionStorage`: refresh token, user profile, theme and sidebar state, a "recent sources" list, and a local fallback of Module Access overrides. |

**Retention** (verified)

- **Notifications:** expired entries are deleted by an hourly Celery task.
- **Audit log:** never deleted by default. The purge only runs if both `AUDIT_ALLOW_DELETE` is enabled **and** `AUDIT_RETENTION_DAYS` is greater than 0 (both off by default, `settings.py:335-341`).
- **Stale WebSocket session rows:** force-closed after 12 hours.
- **Everything else:** no retention or deletion policy exists in code, and neither does a cleanup job for expired JWT blacklist rows. User "deletion" is a soft delete (`is_active=False`) so audit history stays attributable.

---

## 4. Secrets management

- **Backend config** comes from environment variables, loaded from `.env` with `python-dotenv` (`settings.py:25`). `.env` is gitignored. The production compose file refuses to start if `SECRET_KEY`, `DB_PASSWORD` or `REDIS_PASSWORD` is unset (`docker/docker-compose.prod.yml:28,36,42`).
- **Key roles:** `SECRET_KEY` signs the JWTs (`settings.py:631`). `INTEGRATIONS_CREDENTIALS_KEY` is the Fernet key for feed credentials. If it is unset, a key is **derived from `SECRET_KEY`**, with a logged warning (`apps/integrations/crypto.py:33-48`).
- **Hard-coded fallback:** outside the production compose file, `SECRET_KEY` falls back to a known insecure string (`settings.py:28-32`). There is no startup check that rejects it.
- **First admin:** `docker/entrypoint.sh` creates a superuser when `DJANGO_SUPERUSER_EMAIL` and `_PASSWORD` are set.
- **Service-account and feed API keys** are shown once on creation, and only a hash (and a short prefix) is stored.
- **Frontend:** only public values are used (`NUXT_PUBLIC_API_BASE`, `_WS_URL`, `_NOTIFICATIONS_WS_URL`, `_TILES_BASE`), which are visible to anyone with the app. `.env` is gitignored. Test credentials are read from `UAPTS_TEST_EMAIL` and `UAPTS_TEST_PASSWORD` in `.env` and loaded only for tests (`vitest.config.ts`).
- **Logging:** request and audit bodies are redacted by key (`apps/audit/utils.py:168`: passwords, tokens, `authorization`, `api_key`, `secret`, MFA codes and similar, matched as substrings).
- **Committed secret material:** `backend_konza/api_keys.json` is tracked in git (see gap 3).

---

## 5. Input validation and common vulnerabilities (OWASP Top 10, 2021)

| # | Risk | Status in this code |
|---|---|---|
| A01 | Broken access control | **Partly addressed, with serious gaps.** Authentication is required by default, and roles and tenant scoping on many views exist. But the raw SQL console is open to agency admins, an agency admin can mint a platform-wide role, several datasets are not agency-scoped, Module Access page scope is enforced by one API only, and three capabilities are not enforced (gaps 1, 2, 4, 4b, 6a). |
| A02 | Cryptographic failures | **Partly.** Passwords, OTPs and API keys are hashed, feed credentials encrypted, and TLS enforced. Gaps: JWT, Fernet fallback and pseudonymisation share `SECRET_KEY`, and there is no at-rest encryption configured. |
| A03 | Injection | **ORM everywhere in normal code.** The one raw-SQL surface is the admin console (gap 1). On the client, the only `v-html` is the SQL preview, and it escapes `& < >` before highlighting (`query-builder.vue:1034,1169`). The print view escapes all interpolations (`accessExport.ts:82`). Text widgets render plain text. Saved queries accept read-only statements only. |
| A04 | Insecure design | **Mixed.** Audit log is append-only at the model level, and MFA and lockout exist. Weak points: the SQL console design, unscoped datasets, and write access that is not role-gated (gap 4a). |
| A05 | Security misconfiguration | **Partly.** Hardened HTTP headers and `DEBUG` off by default. Weak defaults: the known `SECRET_KEY`, an ngrok host in `ALLOWED_HOSTS`, credentialed CORS to localhost origins, public API docs. The SPA ships no CSP (gaps 5, 8, 10). |
| A06 | Vulnerable and outdated components | **Gaps.** `npm audit` reports 26 issues, and Django is on the 4.2 line (gap 9). |
| A07 | Identification and authentication failures | **Reasonably addressed:** throttles, lockout, MFA, rotation and blacklisting, no open registration. Refresh tokens sit in web storage and WebSocket tokens travel in the URL (gap 7). |
| A08 | Software and data integrity failures | **Partly.** Dependencies are pinned (135 `==` pins) and lockfiles exist. Uploads have extension and size checks and per-template validation. The frontend has a CI workflow that runs the unit tests (`.github/workflows/ci.yml`), but there is no signed build or dependency-update automation in either repo, and the backend has no CI. |
| A09 | Logging and monitoring failures | **Good coverage, thin alerting** (section 8). |
| A10 | Server-side request forgery | **Guarded.** The scheduled feed puller requires `https://`, resolves the host and rejects private addresses, disables redirects and sets timeouts (`apps/integrations/puller.py:155-165`). Minor: the host is resolved once for the check and again by `requests`. |

**CSRF.** The API is authenticated by a Bearer header, so cookie-based CSRF does not apply to the SPA. `SessionAuthentication` is still enabled for the admin and browsable API, and CSRF middleware is on. Session login from the login endpoint is disabled (`SESSION_LOGIN: False`).

**Open redirect.** `?redirect=` after login is passed to `navigateTo` (`app/composables/useAuth.ts:19`). Nuxt refuses absolute external URLs unless `external: true` is set, and the route guard then re-checks the destination against access rules. There is no explicit same-origin check of its own.

---

## 6. Third-party services and dependencies

- **Browser:** Google Fonts (`fonts.googleapis.com`) is loaded from the page head (`nuxt.config.ts`). Map tiles come from the backend's own `/media/` (protomaps). No analytics or tracking scripts were found.
- **Server integrations** (from `requirements.txt` and settings): Africa's Talking (SMS), an email backend via django-anymail for MFA and welcome mail, and pull-style feeds from agency endpoints configured in the Integration Hub.
- **Frontend dependencies:** 12 runtime and 12 dev packages, locked by `package-lock.json`.
- **Backend dependencies:** all 135 entries in `requirements.txt` are pinned to exact versions.
- **How they are kept updated:** **manually.** There is no Dependabot or Renovate configuration in either repo. The frontend's `.github/workflows/ci.yml` only runs tests, not `npm audit`; the backend has no backend `.github/` (the frontend's workflow only runs tests). A backend dependency audit was **not run**: `pip-audit` isn't installed here.
- **Current frontend audit** (`npm audit`, re-run 2026-10-26): 25 findings (3 critical, 15 high, 6 moderate, 1 low). On 2026-10-07 there were 26 (8 critical, 14 high, 4 moderate), almost all in the Nuxt toolchain (`nuxt`, `@nuxt/devtools`, `simple-git`, `nitropack`, `shell-quote`, `listhen`, `node-forge`). The app is built as a static SPA, so these mostly affect the build and dev machines, not the browser, but that depends on how it is deployed (see gap 9). Do **not** run `npm audit fix --force`: it proposes `nuxt@3.7.4`, a major downgrade from 4.4.5.

---

## 7. Payments

**There is no payment processing in this code.** M-Pesa appears only as a recorded value in `payment_method` fields (`apps/training/models.py:476`, `apps/public_transport/models.py:351,502`) next to a free-text reference. No payment gateway, no callback or webhook endpoint, and no server-side verification of a payment exist. Revenue and fee figures are data that agencies upload or enter, and they are not reconciled with any payment provider. If payments are added, they will need their own design and review.

---

## 8. Logging, monitoring and backups

**Logging (verified)**

- **Request tracing:** `RequestCorrelationMiddleware` (request IDs) and `RequestLoggingMiddleware` write one structured line per request.
- **Audit:** `AuditMiddleware` records state-changing requests (POST, PUT, PATCH, DELETE) to `AuditLog` (`apps/audit`). Reads are **not** logged by default (`AUDIT_LOG_READS = False`).
  - Each row captures actor, action, outcome, IP, user agent and a redacted, size-capped body.
  - Rows cannot be edited or deleted through the model (`apps/audit/models.py:235-253`).
  - An optional tamper-evident hash chain exists but is **off** (`AUDIT_HASH_CHAIN = False`).
- **Special cases:** every raw-SQL console execution, success or failure, is written to the audit log with the SQL text. WebSocket sessions are tracked.
- **Files:** rotating log file `logs/uapts.log` (10 MB x 10) and console output. Errors can be emailed to Django `ADMINS` via `AdminEmailHandler`.

**Monitoring.** `GET /api/v1/health/` reports database, Redis, MongoDB, Celery, GIS and WebSocket status. It is unauthenticated and returns the component status, environment name and version. No Sentry, Prometheus or alerting integration was found.

**Backups.**

- The only backup code is the development Makefile target `make backup-db` (a `pg_dump`, `Makefile:173-179`), plus a `postgres_backups` volume mounted in the production compose file (`docker-compose.prod.yml:126,362`).
- **Nothing in the repo writes to that volume on a schedule.** There is no backup for MongoDB, Redis or `media/`, and no restore test.
- Whether production backups exist outside this repo is **not verified**.

---

## 9. Incident response

No incident-response procedure, rota or runbook exists in either repo. `backend_konza/docs/overview.md` mentions PagerDuty and a `docs/runbooks/` directory, but that directory does not exist, so treat those as aspirational. The owners need to fill in the contacts below.

**Contacts (to be defined by the owners):**

| Role | Contact |
|---|---|
| Incident lead | _not defined in the repo_ |
| Backend/infrastructure on-call | _not defined in the repo_ |
| Data protection officer | _not defined in the repo_ |
| Security mailbox | `security@uapts.go.ke` (listed in the API's public description, `uapts/settings.py:776`; mailbox ownership not verified) |

**What the code lets you do (use these as the starting steps):**

1. **Contain an account.** Deactivate it (`is_active=False`, via the Users page or `DELETE /api/v1/accounts/users/<id>/`, which soft-deletes). A password change blacklists the account's outstanding refresh tokens (per the comment in `app/stores/auth.ts`; the backend side was not re-checked), but existing access tokens stay valid for up to 15 minutes.
2. **Contain a machine credential.** Rotate the service-account key (the `rotate-key` action in `apps/accounts/views.py`). How to rotate a data feed's own API key was not checked.
3. **Close the biggest exposures at once.** Set `QUERY_CONSOLE_ENABLED=False` and restart (gap 1), and review who holds `admin` and `ministry_admin` roles (gap 2). To cut one agency off from the query tools, a super admin can switch its `query_builder` capability off in Module Access; the API now enforces that for the query, saved-query and SQL console endpoints.
4. **Rotate secrets.**
   - Changing `SECRET_KEY` invalidates every JWT. It also changes the fallback Fernet key, so set `INTEGRATIONS_CREDENTIALS_KEY` first or stored feed credentials stop decrypting (the decrypt helper returns `{}` on failure).
   - Rotate `DB_PASSWORD` and `REDIS_PASSWORD` in the environment, not the repo.
5. **Investigate.** Query the audit log (`/api/v1/audit/logs/`, filterable by actor, outcome and time; failures and denials are first-class). Console SQL is recorded verbatim. Correlate with `X-Request-ID` and `logs/uapts.log`. Reads are not audited, so a data-exfiltration question may not be answerable from the log alone.
6. **Preserve evidence** before cleanup: export the audit rows and the log files. Do not use the purge tasks during an investigation (they are off by default).
7. **Notify** the affected agencies and, where personal data is involved, the regulator, as your legal obligations require. That process is not defined in the repo.

---

## 10. Reporting a vulnerability

- **Where to send it:** `security@uapts.go.ke`. This is the only disclosure address in the code (it is shown in the public API description). The response time commitment in `backend_konza/docs/overview.md` (acknowledge in 24 hours, remediate in 7 days) is **not backed by any process in the repo**, so treat it as a target, not a promise.
- **No published policy exists:** there is no `SECURITY.md` in either repo's root, and no `/.well-known/security.txt` in `public/`. `public/robots.txt` allows all crawling.
- **What to include:** the affected URL or screen, the account role used, steps to reproduce, and the `X-Request-ID` of the request if you have it. Please do not access, change or delete data beyond what is needed to show the problem, and do not test against production data without permission.
- **Recommended next step:** add `public/.well-known/security.txt` pointing at the address above, and confirm the mailbox is monitored.

---

# Known gaps and recommendations

Ordered by severity. "Verified" gaps were confirmed against the running development backend as noted. None of these have been fixed unless stated.

## Critical

### 1. Agency admins can run raw SQL on the whole database
- **Where:** `apps/analytics/db_console.py:325` (`RawSQLView.permission_classes = [IsAdminRole]`) and `DatabaseSchemaView`; `core/permissions.py:64` (`is_admin_role` admits agency `admin`); `uapts/settings.py:237` (`QUERY_CONSOLE_ENABLED`).
- **What happens:** the endpoint runs arbitrary SQL, including DDL and writes. It is limited only by the `QUERY_CONSOLE_ENABLED` flag (off by default, **on** in the current dev environment). **Verified:** a scoped agency admin (KAA) ran `SELECT count(*) FROM tbl_users` through `/api/v1/query/raw/` and got 100, while the users API shows that admin 4. That is a complete bypass of agency isolation, and the same account could alter or delete the audit table. The saved-SQL feature uses the same gate for execution.
- **Frontend:** the `/query-builder` page is limited to oversight tiers in `access-control.json` (`minTier: oversight`, `agencyScoped: false`, so a role grant cannot lift it), but that is client-side only and does not stop a direct API call. The API endpoints are gated by `IsAdminRole`, not by that route.
- **Update (2026-10-26):** the console, schema view, query execute/join and saved queries now also require the `query_builder` capability, but admins hold it by default, so this gap is unchanged for an ordinary agency admin. The capability lets an agency switch the console off; it is not an isolation fix.
- **Fix:** restrict the console, schema and saved-SQL execution to `super_admin` (or a dedicated permission). Keep it disabled in production. If it must stay on, connect it through a read-only database role limited to a reporting schema.

### 2. An agency admin can create a platform-wide admin
- **Where:** `apps/accounts/views.py:660` (`_enforce_agency_admin_limits` blocks only `super_admin`, `is_superuser` and `is_staff`); `core/permissions.py:64`.
- **What happens:** **Verified:** an agency admin (KAA) created a `ministry_admin` account (HTTP 201; deleted straight away). `ministry_admin` is a global read/write tier across every agency. This is a privilege escalation.
- **Fix:** reject `ministry_admin` and `ministry_analyst` unless the caller is a `super_admin`. The frontend create-user dropdown already hides these roles from scoped admins, but the API does not enforce it.

## High

### 3. Integration API keys are committed to git
- **Where:** `backend_konza/api_keys.json` (tracked, added in commit `6d506e2`); generated by `seeds/seed_integrations.py:17,169`; not in `.gitignore`.
- **What happens:** the file holds one key per integration source (e.g. `ntsa-itims`, `kenha-rims`). The values were not inspected. The remote is a GitHub repository.
- **Fix:** if these are live keys, treat them as exposed: rotate them, remove the file from history, and add it to `.gitignore`.

### 4. Several datasets are not scoped to the viewer's agency
- **Where:** `apps/safety/views.py` (accidents), `apps/railway/views.py` (`FreightManifestViewSet`, `RailIncidentViewSet`), `apps/audit` log list; `docs/SECURITY_AUDIT.md` already lists many models as unscoped.
- **What happens:** **Verified:** an agency admin saw the same counts as a super admin for accidents (134), rail freight manifests (120), rail incidents (12) and agencies (22), and 5,465 of 5,466 audit log rows. Road segments, bridges, uploads and users are scoped correctly. The code does not say which of these are meant to be national datasets.
- **Fix:** decide per dataset, then enforce scoping in `get_queryset`. The audit log is the most sensitive: an agency admin should not read other agencies' activity.

**Update (2026-10-26): infrastructure `/summary/` is now agency-scoped.** It used to return every agency's totals and `by_agency` breakdown to any agency admin (a KeRRA admin saw "All Agencies 2,591" and the other agencies' tabs). It is scoped now, and the infrastructure pages hide the agency tabs when the viewer can see only one agency. **Update (2026-10-26, later): the remaining M06 list endpoints are scoped too** (maintenance orders, regional offices, field surveys, WIM readings, deterioration forecasts, rural road status), and so are the aggregate actions that bypassed the scoped queryset before (condition distribution, IRI histogram, maintenance by type/agency, streetlight status summary, project portfolio/by-county/by-agency, budget summary, WIM repeat offenders). Oversight agencies (SDT, SDR) read across agencies for M06. Still unscoped: **agency performance assessments** (KRB's oversight scores of each agency; scoping by agency would hide them from KRB, so who may see whose score needs a decision), and `AgencyPerformanceAssessmentViewSet.latest`.

### 4a. Write endpoints are not role-gated, so roles meant to be read-only are not
- **Where:** viewsets that declare only `permission_classes = [IsAuthenticated]`, for example `AccidentViewSet` (`apps/safety/views.py:352-358`, a `ModelViewSet`) and `VehicleViewSet` (`apps/fleet/views.py:90`).
- **What happens:** **Verified (2026-10-07):** an `analyst` and an `auditor` both got `400` (validation error, meaning the permission check passed and nothing was created) on an empty `POST` to `/api/v1/safety/accidents/` and `/api/v1/fleet/vehicles/`; a denied role would get `403`. Until 2026-10-07 the auditor was blocked from these by middleware (since removed, by decision); the analyst never was. So "read-only" depends on each view, not on the role.
- **Note (2026-10-26):** the capability checks above cover only the views listed in section 2. These model viewsets still have no capability or role gate on writes.
- **Fix:** gate writes by role on the model viewsets (for example a permission that allows `SAFE_METHODS` for any authenticated role and requires an operator-or-above role for writes), then enable the auditor and analyst exactly as intended.

### 4b. Module Access page scope is not enforced by most APIs
- **Update (2026-10-26):** the query-builder datasets (`/query/datasets/`, `/query/execute/`, `/query/execute-join/`) now enforce it: each dataset names its pages, the viewer's own resolved access must reach one of them (403 otherwise), rows are scoped to the viewer's agency for datasets that declare a tenant lookup (the M06 datasets, incidents, vehicles and GPS tracks do; congestion, blackspots and traffic counts are marked national; oversight agencies SDT and SDR read across agencies), and restricted-category fields such as `procurement` are masked. This is the path dashboard widgets use for record-level data. The infrastructure (M06) REST endpoints, its `/summary/` view and its export action are now gated too (`apps/infrastructure/access.py`, helper `apps/access_control/wiring.py`, viewer's own access, no dashboard exemption). The other modules' REST endpoints and `/summary` views are still ungated.
- **Rollout status (2026-10-26, work paused here):**

  | Area | Page scope enforced by the API? |
  |---|---|
  | Maritime and aviation (`apps/aviation_maritime`) | Yes (also masks restricted fields) |
  | Infrastructure M06 (`apps/infrastructure`): viewsets, `/summary/`, export | Yes |
  | Query datasets (`/query/*`): 13 datasets | Yes, with agency rows and masked fields |
  | **Traffic, fleet, safety, public transport, railway, training, integrations, GIS, analytics, notifications** | **No: gap still open** |

  Until those are wired, a user whose role gate passes can call their endpoints directly even when Module Access
  sets the page or module to `none`/`read`. Next steps, in order: safety and fleet (they hold `crash_victim`,
  `vehicle_owner_pii`, `driver_conductor_pii`), then integrations and GIS, then the rest. For each app: write
  `apps/<app>/access.py` (view class -> pages that call it, from the frontend pages' API calls), call
  `wiring.gate(...)` at the bottom of `views.py`, add a guard-table test like `apps/infrastructure/tests_access.py`,
  and carry the gate on any `@action` that sets its own `permission_classes`. Also open: `/summary` and REST rows are
  not agency-scoped outside infrastructure and the query datasets (gap 4), and ministry roles and agency-less accounts
  are refused wherever the gate is applied.
- **Where:** `apps/access_control/permissions.py` (`ModuleAccessPermission`) is applied only in `apps/aviation_maritime`, `apps/infrastructure` and, via the dataset check above, the query endpoints; every other app declares its own `permission_classes`.
- **What happens:** an agency that sets a module or page to `none` or `read` in Module Access hides it in the SPA, but a user whose role gate passes can still call the matching endpoint directly. Read-only `read` scope is not enforced on writes outside maritime. Agency admins may therefore believe they have restricted data when they have only hidden it.
- **Fix:** map each API endpoint to its page route (as `apps/aviation_maritime/access.py` and `apps/infrastructure/access.py` do) and add `ModuleAccessPermission` per view with `wiring.gate`; remaining modules: traffic, fleet, safety, public transport, railway, training, integrations, GIS, analytics. The class costs one indexed query per request.

### 5. Weak, shared secret defaults
- **Where:** `uapts/settings.py:28-32` (known fallback `SECRET_KEY`, no startup check), `:631` (JWT signing key is `SECRET_KEY`); `apps/integrations/crypto.py:33-48` (Fernet key derived from `SECRET_KEY` when unset); `core/pii.py:58`.
- **What happens:** any non-compose deployment that forgets `SECRET_KEY` silently uses a public value, which lets anyone forge tokens. The production compose file does fail fast, which limits the risk to other ways of starting the app. One key signing tokens, deriving encryption and pseudonymising IDs means one leak affects all three.
- **Fix:** refuse to start when `DEBUG` is off and the default key is in use. Require `INTEGRATIONS_CREDENTIALS_KEY` and `PSEUDONYMISATION_KEY` outside local development.

### 6. Uploads accept files up to 5 GB
- **Where:** `apps/integrations/xlsx_templates.py:183` (`INTEGRATION_UPLOAD_MAX_MB` default 5120), `apps/integrations/views.py:442-445` (the check), `nginx/nginx.conf:47` (`client_max_body_size 6g`).
- **What happens:** file type and size are checked, but the ceiling is high enough to exhaust disk or memory with a few requests from any account that can upload.
- **Fix:** set a realistic per-template limit (megabytes, not gigabytes), lower the Nginx limit to match, and enforce per-user quotas. Also review who can fetch `media/integration_uploads`.

### 6a. Three capabilities are not enforced
- **Where:** `acknowledge_alerts`, `update_incidents` and `submit_uploads` in the Module Access capability matrix. Candidate views: `EscalationRunViewSet.acknowledge` and `EmergencyDispatchViewSet.acknowledge`, `IncidentViewSet` writes, and the upload views in `apps/integrations` and `apps/gis/layer_views.py`.
- **What happens:** toggling these in the Roles tab changes nothing, in the UI or the API, so an agency that switches one off believes it has restricted something when it has not.
- **Why not done yet:** by default only the operator tier holds them. Enforcing them as they are would lock admins (and analysts, for incidents) out of existing workflows, so the baseline defaults must be decided first.
- **Fix:** decide the default holders in `access-control.json`, then add `capability_permission(...)` to those views.

## Medium

### 7. Tokens exposed in browser storage and URLs
- **Where:** `app/stores/auth.ts` (refresh token and profile in `localStorage`/`sessionStorage`); `app/composables/useAuditSocket.ts:75-77` and `useNotificationSocket.ts:76-78` (access token in the WebSocket query string).
- **What happens:** any script running on the page (an XSS) can read the refresh token. Tokens in WebSocket URLs can land in proxy and server access logs.
- **Fix:** issue a short-lived, single-use WebSocket ticket instead of the access token. Consider an `HttpOnly` cookie for the refresh token.

### 8. The SPA ships no Content-Security-Policy or security headers
- **Where:** `nuxt.config.ts` (none configured; no frontend Dockerfile or server config in this repo). The CSP at `nginx/conf.d/uapts.conf:53` covers the API host only.
- **What happens:** the site relies on whatever the host serving the static build adds. The page also loads Google Fonts from a third party.
- **Fix:** serve the SPA with a CSP, `frame-ancestors`, `X-Content-Type-Options` and a referrer policy. Self-host the fonts.

### 9. Dependencies and update process
- **Where:** `package.json`/`package-lock.json`; `requirements.txt` (`Django==4.2.30`); no backend `.github/` (the frontend's workflow only runs tests).
- **What happens:** 25 frontend audit findings as of 2026-10-26 (3 critical, 15 high, 6 moderate, 1 low), mostly in build tooling in the earlier breakdown. Django 4.2 is a long-term-support line whose published support window ended around April 2026 (confirm against Django's release schedule). There is no automated update or audit job, and no backend audit was run.
- **Fix:** add Dependabot or Renovate, plus `npm audit` in the existing frontend CI workflow and a `pip-audit` step for the backend. Plan the Django upgrade. Upgrade Nuxt within the 4.x line rather than using `--force`. Confirm that the deployed artefact is a static build so build-time packages are not on the server.

### 10. Loose defaults in backend configuration
- **Where:** `settings.py:37` (an ngrok hostname in default `ALLOWED_HOSTS`); `:868-870` (`CORS_ALLOW_CREDENTIALS = True` with localhost default origins); `:656` (`SessionAuthentication` kept); `:533` (`ACCOUNT_EMAIL_VERIFICATION` defaults to `none`); `:780` (API schema and docs public); `uapts/health_check.py:300` (health endpoint unauthenticated).
- **Fix:** make these environment-only with no development defaults in production, remove the ngrok host, and put the API docs and health detail behind authentication or an allowlist.

### 11. Audit trail integrity depends on conventions
- **Where:** `apps/audit/models.py:235-253` (immutability is on the model instance only); `settings.py:335` (`AUDIT_HASH_CHAIN` off).
- **What happens:** bulk `queryset.update()/delete()` and direct SQL are not blocked by the code, and the SQL console can reach the table (gap 1). Reads are not audited by default.
- **Fix:** enable the hash chain, restrict the audit table to an append-only database role, and ship logs to a write-once store.

### 12. Backups are not set up in the repo
- **Where:** `Makefile:173-179` (dev only), `docker/docker-compose.prod.yml:126,362` (volume, no job).
- **What happens:** no scheduled production backup, no MongoDB, Redis or `media/` backup, and no restore test. No at-rest encryption is configured.
- **Fix:** add scheduled, encrypted, off-host backups of PostgreSQL, MongoDB and `media/`, test a restore, and document the retention period.

## Low

13. **Default test credentials in source.** `tests/integration/live.test.ts:27-29` falls back to `test@gmail.com` / `devpass123`. The real values now come from `.env` (gitignored), but remove the fallback so a missing variable fails the test.
14. **Account lockout can be abused.** Five failed logins lock an account for 15 minutes (`settings.py:576-577`), so someone who knows an email can keep that user locked out. Consider per-IP plus per-account throttling.
15. **JWT blacklist table growth.** No scheduled flush of expired tokens was found (the beat schedule has none).
16. **SSRF check window.** `apps/integrations/puller.py:160` validates the resolved address and `requests` resolves again, leaving a small DNS-rebinding window. Pin the resolved IP for the request.
17. **Open-redirect reliance on the framework.** `app/composables/useAuth.ts:19` should validate that `redirect` is a same-origin path before navigating.
18. **Entrypoint superuser bootstrap.** `docker/entrypoint.sh:92-100` interpolates `DJANGO_SUPERUSER_EMAIL` into an inline Python script through the shell. It is operator-controlled, but build the script without string interpolation.
19. **Incident contacts undefined.** Section 9 has no named owners, and the on-call and SLA claims in `docs/overview.md` have no code behind them.
