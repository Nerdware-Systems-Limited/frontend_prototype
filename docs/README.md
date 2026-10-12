# UAPTS frontend documentation

_Index. Last reviewed 2026-10-12._

Start with the root [`README.md`](../README.md) for setup, then pick the document for your task.

## Start here

| I want to... | Read |
|---|---|
| Understand how the app fits together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Run, test, extend or deploy it | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Find a route, store, composable or component | [Reference.md](Reference.md) |

## Subsystems

| Topic | Document |
|---|---|
| Login, MFA, tokens, cross-tab sessions | [AUTH_AND_SESSIONS.md](AUTH_AND_SESSIONS.md) |
| `$api`, domain composables, dev proxy, WebSockets, errors | [API_LAYER.md](API_LAYER.md) |
| Role tiers, agency scope, Module Access (implementation) | [ACCESS_CONTROL.md](ACCESS_CONTROL.md) |
| Who can see what, per agency and role (plain language) | [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) |
| Configurable dashboards, widgets, bindings, editor | [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md) |
| Collapsible maps and incidents, time range, certificate alerts, HQ summary | [MODULE_UX.md](MODULE_UX.md) |

## Security

| Document | What it is |
|---|---|
| [SECURITY.md](SECURITY.md) | Full security overview and the ranked list of known gaps (current) |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Frontend's role in the three controls requested on 15 Sept 2026 |

## Plans, audits and backend requests

| Document | What it is |
|---|---|
| [Widgets.md](Widgets.md) | Dashboard widget audit, phased plan and the log of backend items B1 to B26 |
| [dashboard-manager-integration.md](dashboard-manager-integration.md) | Where the deployed backend differs from the Dashboard Manager reference package |
| [BACKEND_FIXES.md](BACKEND_FIXES.md) | Backend defects that stop data reaching the dashboards |
| [DESIGN_AUDIT.md](DESIGN_AUDIT.md) | Earlier combined frontend and backend audit (historical snapshot) |

## Product and design (repository root)

| Document | What it is |
|---|---|
| [`../PRODUCT.md`](../PRODUCT.md) | Audience, purpose, principles, constraints |
| [`../DESIGN.md`](../DESIGN.md) | Visual design system and its named rules |

## Keeping these current

- Docs describe the code; when they disagree, the code wins. Verify before quoting a number.
- When a change touches a coupling listed in [DEVELOPMENT.md](DEVELOPMENT.md) section 7, update both sides.
- Dated sections ("As of ...") are snapshots. Change the date when you re-verify them.
- The earlier design specs and plans that lived under `docs/superpowers/` were removed from the working tree;
  they remain in git history (`git log -- docs/superpowers`).
