# Authentication and sessions

_Verified against the code on 2026-10-12._

How a person signs in, how the session is kept alive, and how several browser tabs share it. All of it lives in
`app/stores/auth.ts`, `app/plugins/api.ts`, `app/plugins/auth-sync.client.ts`, `app/utils/tabSync.ts`,
`app/middleware/auth.global.ts` and `app/utils/publicRoutes.ts`.

The frontend only holds and presents credentials. The backend (dj-rest-auth + SimpleJWT) issues, rotates and
blacklists them. Backend settings referenced below: access token about 15 minutes, refresh token about 7 days,
rotated and blacklisted after rotation.

## 1. Storage model

| Item | Where | Why |
|---|---|---|
| Access token | Memory only (`accessToken` ref in the auth store) | Never touches `localStorage`, which limits what an XSS can steal |
| Refresh token | `localStorage['uapts_refresh']` when "Remember me" was ticked, else `sessionStorage['uapts_refresh']` | Survives reloads; session-only logins die with the tab |
| Cached user profile | `uapts_user` in the same storage as the refresh token | Avoids a flash of an unauthenticated UI on reload |
| MFA nudge flag | Memory only | Shown once per fresh sign-in, never after a reload |

Rules enforced by `setItem()`: only one of the two storages ever holds a key. Writing to one removes the
other's copy, so a stale "remember me" token cannot silently win after a later session-only login.

Signing out (`_clearTokens`) clears memory and both storages together.

## 2. Login

`useAuth().login(identifier, password, remember)` wraps `store.login()` and then navigates to the `?redirect=`
query value, defaulting to `/dashboard`.

1. `POST /api/v1/auth/login/`. The `identifier` may be an email or the optional self-service username; the store
   decides which body key to send.
2. Response is either tokens and a user, or `{ mfa_required, otp_id, channel }`.
3. **MFA challenge:** the store remembers the "Remember me" choice, `login.vue` shows a code step, and
   `mfaVerify(otpId, code)` (`POST /api/v1/auth/mfa/verify/`) completes the sign-in with the same persistence
   choice. `mfaResend` re-issues the code.
4. On success the user record is normalised (`normaliseUser` fills `full_name` from the email local part, since
   the backend does not emit it) and `showMfaNudge` is set when the account has no MFA enrolled.

Other flows on the same store:

| Action | Endpoint |
|---|---|
| `mfaEnroll(channel)`, `mfaEnrollVerify`, `mfaDisable(password)` | `/api/v1/auth/mfa/enroll/`, `/mfa/verify/`, `/mfa/disable/` |
| `requestPasswordReset`, `confirmPasswordReset` | `/api/v1/auth/password/reset/`, `/password/reset/confirm/` |
| `changePassword` | `/api/v1/auth/password/change/` (the server blacklists all refresh tokens, so the client clears locally right away) |
| `logout` | `/api/v1/auth/logout/`, then local clear |
| `fetchMe` | `/api/v1/auth/user/`, falling back to `/api/v1/users/me/` |

## 3. Keeping the session alive

```
request ──► $api adds Bearer token ──► 401?
                                         │ yes, first time, refresh token present
                                         ▼
                              refreshAccessToken()  (one shared promise for concurrent 401s)
                                         │ ok → retry the request once with _retry
                                         │ failed → forceLogout() + navigateTo('/login')
```

- `plugins/api.ts` collapses simultaneous 401s into a single refresh.
- `isAccessTokenFresh(bufferMs = 60s)` decodes the JWT `exp` claim (no signature check) so callers such as the
  notification socket can skip a refresh when the token is still good.
- Every successful refresh stores the rotated refresh token **in the same storage as the one it replaces**, so a
  session-only login is never silently promoted to a persistent one.

## 4. Route guard

`middleware/auth.global.ts`, for every non-public path (`/login`, `/forgot-password`, `/reset-password/*`):

1. `hydrate()` the refresh token and user from storage if not loaded.
2. No refresh token? `adoptFromOtherTab()` asks sibling tabs for a session (see section 5).
3. Live access token? Continue.
4. Refresh token only? Silent refresh; continue on success.
5. Otherwise redirect to `/login?redirect=<intended path>`.
6. Once authenticated, load the access policy and resolve the route against it
   (see [ACCESS_CONTROL.md](ACCESS_CONTROL.md)). A denied route goes to the safe space.

This guard is a convenience. Disabling it in dev tools changes nothing the API returns.

## 5. Cross-tab session sharing (`utils/tabSync.ts`)

Problem 1: with a session-only login the refresh token lives in `sessionStorage`, which belongs to one tab, so
"open in new tab" landed on `/login`.

Problem 2: the backend rotates refresh tokens and blacklists the old one. Two tabs refreshing with the same token
made the second fail and log everyone out.

Solution, all same-origin and never persisted to disk:

- A `BroadcastChannel` named `uapts-auth` carries four messages: `request` (a tab with no session asks),
  `session` (an answer addressed to the asker), `tokens` (a tab logged in or rotated; everyone take these) and
  `logout`. Messages carry an app name and version; anything else is dropped. Payloads are JSON round-tripped
  first because the store's `user` is a reactive proxy that a real channel cannot structured-clone.
- A **Web Lock** named `uapts-auth-refresh` serialises refreshes. A tab that finds the lock held queues behind it
  and, when it gets the lock, first waits briefly for the winner's announcement and uses its token instead of
  spending the old one.
- `_applySession` never replaces a newer access token with an older one (`tokenExpiry` comparison).
- `plugins/auth-sync.client.ts` calls `initTabSync` before any middleware. When another tab signs out, this tab
  navigates to `/login?redirect=<current path>` unless it is already on a public route.
- `createTabSync` takes the channel and locks as parameters, so it is unit tested with fakes
  (`tests/unit/tab-sync.test.ts`). Without a channel or locks everything degrades to single-tab behaviour.

## 6. Account state and the access policy

`plugins/access-policy.client.ts` watches `auth.user.id` and resets the access policy store when it becomes
empty, so one account's overrides are never inherited by the next sign-in in the same tab.

## 7. Known limits

- The access token is in memory, so a hard reload always costs one silent refresh.
- WebSocket URLs carry the JWT in `?token=` because browsers cannot set headers on a WebSocket handshake. That
  can end up in server logs; see [SECURITY.md](SECURITY.md) item 7.
- The 15-minute access lifetime and refresh rotation are backend settings. Changing them needs no frontend
  change, but `tab-sync` timing assumes rotation is on.
