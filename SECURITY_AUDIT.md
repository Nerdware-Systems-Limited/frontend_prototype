# Frontend Security Audit

_As of 2026-09-20._

Companion to the backend's `docs/security-recommendations-status.md`, covering the frontend's role in the same three controls requested in Mugambi Githinji's 15 September 2026 email. Verified against the current code, not against `Reference.md` or `PRODUCT.md`, both of which predate some of this and are noted as stale below where that matters.

The short version: the frontend correctly treats all three controls as the backend's job, not its own. Its own gating is a UX convenience layer only, explicitly documented as such in the code it lives in - it improves the experience but is not, and was never meant to be, a security boundary.

## 1. Authentication

- Access token lives in memory only (a reactive ref in `app/stores/auth.ts`) and never touches `localStorage`.
- Refresh token and the cached user profile go to `localStorage` ("remember me") or `sessionStorage` otherwise, and both are cleared together on logout (`_clearTokens()`, `app/stores/auth.ts:351-356`) so nothing lingers in browser storage after sign-out.
- Login accepts either email or the optional self-service username added this session, plus an MFA challenge flow (email/SMS one-time code).
- `app/middleware/auth.global.ts` runs on every navigation except `/login`, `/forgot-password`, and `/reset-password/*`: it requires a live or silently-refreshable session before rendering anything.
- This is a UX layer, not the security boundary. The backend's `IsAuthenticated` default (see the backend audit, section 1) is what actually protects data; disabling this middleware in dev tools would change nothing about what the API returns.

## 2. Role-based access control

- Two composables split the gate in two, matching the backend's own split between role and tenant: `usePermissions()` (role tier: what this person may do) and `useAccessControl()` (agency scope: whose data they may see), both driven by the versioned policy file `app/config/access-control.json`.
- **Now wired into the global route guard.** `app/middleware/auth.global.ts` resolves every navigation through `useAccessControl().resolveRoute()` and redirects to a safe space on denial. `Reference.md`'s note on `useAccessControl()` ("Not yet wired to anything") is stale; this was wired in during the agency command centre work earlier in this session's git history. The same middleware's own comment marks this as closing a previously-known gap: no client-side route gating on `/roles`, `/users`, `/audit`, `/integrations` (also referenced as an open item in `PRODUCT.md`, likewise now stale).
- Like authentication, this is UX gating only. It hides navigation and blocks client-side rendering, but a direct API call bypasses it entirely - the backend's `core/permissions.py` RBAC classes (see the backend audit, section 2) are what actually enforce this.

## 3. Object-level authorization

- The frontend does no object-level filtering of its own, by design. It renders whatever the backend's API returns and defers entirely to the server for tenant scoping.
- Practical consequence of the backend gap (see the backend audit, section 3): on the roughly 24 models the backend doesn't yet scope by agency (Incident, Accident, BlackSpot, EmergencyDispatch, and more), a list or detail page will render whatever cross-agency data an unscoped API call returns, because nothing in the UI layer is built to filter it further. This is not a frontend defect to fix - closing it is the backend's fast-track plan - but it means the frontend cannot mitigate that gap while it's open.
- No additional exposure beyond what the API already returns was found. Detail-fetch URLs are built from IDs already present in a list response the user was already allowed to load, not from user-typed or otherwise guessable input, so the frontend doesn't add its own IDOR surface on top of direct API access.

## Testing note

`tests/unit/api.test.ts` was broken this session (it imported composables, `useAuth` and `useIncidents`, that don't exist in the current codebase, so the whole file failed to even load) and has been rewritten against the real composable signatures; `tests/unit/store.test.ts` gained coverage for the email-or-username login path. Neither of these is the backend's `apps/accounts` test gap that `DESIGN_AUDIT.md` flags separately - that finding is about the Django app, not this repo.
