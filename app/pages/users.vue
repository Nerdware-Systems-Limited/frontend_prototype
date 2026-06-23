<template>
  <div class="users-page">

    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">System <span class="sep">·</span> Admin</div>
        <h1 class="page-title">User Management</h1>
        <p class="page-sub">
          <span v-if="!loading">{{ pagination.count }} accounts</span>
          <span v-else class="skel skel-inline" style="width:80px" />
          <span v-if="orgCount"> across {{ orgCount }} organisations</span>
        </p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="showInviteModal = true">
          <UserPlus :size="13" /> Invite user
        </button>
        <button class="btn btn-primary" @click="openCreate">
          <Plus :size="13" /> Create account
        </button>
      </div>
    </div>

    <!-- ── Global error banner ──────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="globalError" class="alert alert-error" role="alert">
        <AlertTriangle :size="14" class="flex-shrink-0" />
        <span class="flex-1">{{ globalError }}</span>
        <button class="icon-btn" aria-label="Dismiss error" @click="globalError = ''">
          <X :size="12" />
        </button>
      </div>
    </Transition>

    <!-- ── Stat cards ────────────────────────────────────────────────── -->
    <div class="stats-grid">
      <div v-for="s in statsCards" :key="s.label" class="stat-card">
        <div class="stat-icon" :style="{ background: s.bg, color: s.colour }">
          <component :is="s.icon" :size="14" />
        </div>
        <div class="stat-body">
          <div v-if="loading" class="skel" style="width:36px;height:22px;margin-bottom:4px" />
          <div v-else class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- ── Users table card ──────────────────────────────────────────── -->
    <div class="card">

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="role-tabs" role="tablist" aria-label="Filter by role">
          <button
            v-for="t in ROLE_TABS" :key="t.value"
            class="role-tab"
            :class="{ active: selectedRole === t.value }"
            role="tab"
            :aria-selected="selectedRole === t.value"
            @click="setRole(t.value)"
          >
            {{ t.label }}
            <span class="tab-badge">{{ roleCounts[t.value] ?? '—' }}</span>
          </button>
        </div>

        <div class="toolbar-right">
          <div class="search-box" :class="{ focused: searchFocused }">
            <Search :size="12" class="search-icon" />
            <input
              ref="searchRef"
              v-model="searchInput"
              type="search"
              placeholder="Search users…"
              autocomplete="off"
              class="search-input"
              aria-label="Search users"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
              @input="onSearchInput"
            />
            <button v-if="searchInput" class="icon-btn" aria-label="Clear search" @click="clearSearch">
              <X :size="10" />
            </button>
          </div>

          <select
            v-model="selectedStatus"
            class="filter-select"
            aria-label="Filter by status"
            @change="applyFilters"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            class="icon-btn icon-btn-subtle"
            :class="{ spinning: loading }"
            title="Refresh"
            aria-label="Refresh user list"
            @click="fetchUsers"
          >
            <RefreshCw :size="13" />
          </button>
        </div>
      </div>

      <!-- Bulk-action bar -->
      <Transition name="slide-down">
        <div v-if="selected.length > 0" class="bulk-bar">
          <span class="bulk-label">{{ selected.length }} selected</span>
          <div class="bulk-actions">
            <button class="btn btn-sm btn-secondary" @click="bulkDeactivate">
              <ShieldOff :size="11" /> Deactivate
            </button>
            <button class="btn btn-sm btn-danger" @click="bulkDelete">
              <Trash2 :size="11" /> Delete
            </button>
            <button class="btn btn-sm btn-ghost" @click="selected = []">Cancel</button>
          </div>
        </div>
      </Transition>

      <!-- Loading skeleton -->
      <template v-if="loading">
        <div class="skel-table">
          <div v-for="i in PAGE_SIZE" :key="i" class="skel-row">
            <div class="skel skel-check" />
            <div class="skel-user-cell">
              <div class="skel skel-avatar" />
              <div>
                <div class="skel" style="width:120px;height:13px;margin-bottom:5px" />
                <div class="skel" style="width:160px;height:11px" />
              </div>
            </div>
            <div class="skel" style="width:70px;height:18px;border-radius:99px" />
            <div class="skel" style="width:90px;height:13px" />
            <div class="skel" style="width:55px;height:18px;border-radius:99px" />
            <div class="skel" style="width:60px;height:13px" />
            <div class="skel" style="width:40px;height:18px;border-radius:99px" />
            <div class="skel" style="width:80px;height:26px;border-radius:6px" />
          </div>
        </div>
      </template>

      <!-- Data table -->
      <template v-else>
        <div class="table-scroll">
          <table class="data-table" aria-label="Users">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    :indeterminate="someSelected"
                    aria-label="Select all"
                    @change="toggleSelectAll"
                  />
                </th>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last seen</th>
                <th>Staff</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.id"
                :class="{ 'row-inactive': !user.is_active }"
              >
                <td class="col-check">
                  <input
                    v-model="selected"
                    type="checkbox"
                    :value="user.id"
                    :aria-label="`Select ${user.full_name || user.username}`"
                  />
                </td>

                <td>
                  <div class="user-cell">
                    <div class="avatar" :style="avatarStyle(user)">
                      <img
                        v-if="user.avatar"
                        :src="user.avatar"
                        :alt="user.full_name || user.username"
                        class="avatar-img"
                        loading="lazy"
                      />
                      <span v-else aria-hidden="true">{{ initials(user) }}</span>
                    </div>
                    <div>
                      <div class="user-name">{{ user.full_name || user.username }}</div>
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                  </div>
                </td>

                <td>
                  <span class="badge" :class="roleBadge(user.role)">{{ roleLabel(user.role) }}</span>
                </td>

                <td class="cell-muted">{{ user.department_name || '—' }}</td>

                <td>
                  <span class="badge" :class="user.is_active ? 'badge-success' : 'badge-neutral'">
                    <span class="status-dot" :class="user.is_active ? 'dot-active' : 'dot-inactive'" />
                    {{ user.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <td class="cell-mono">{{ relativeTime(user.last_seen_at ?? user.last_login) }}</td>

                <td>
                  <span class="badge" :class="user.is_staff ? 'badge-info' : 'badge-neutral'">
                    {{ user.is_staff ? 'Staff' : 'User' }}
                  </span>
                </td>

                <td class="col-actions">
                  <div class="action-group">
                    <button
                      class="icon-btn icon-btn-subtle"
                      title="Edit user"
                      :aria-label="`Edit ${user.full_name || user.username}`"
                      @click="openEdit(user)"
                    >
                      <Edit2 :size="12" />
                    </button>
                    <button
                      class="icon-btn icon-btn-subtle"
                      title="View sessions"
                      :aria-label="`View sessions for ${user.full_name || user.username}`"
                      @click="openSessions(user)"
                    >
                      <Monitor :size="12" />
                    </button>
                    <button
                      class="icon-btn icon-btn-subtle"
                      :class="user.is_active ? 'hover-warn' : 'hover-success'"
                      :title="user.is_active ? 'Deactivate account' : 'Activate account'"
                      :disabled="togglingId === user.id"
                      @click="toggleActive(user)"
                    >
                      <Loader2 v-if="togglingId === user.id" :size="12" class="spinning" />
                      <UserX     v-else-if="user.is_active"  :size="12" />
                      <UserCheck v-else                       :size="12" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="users.length === 0" class="empty-state">
          <Users :size="36" class="empty-icon" />
          <p class="empty-title">No users found</p>
          <p class="empty-sub">Try adjusting your search or filters</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:16px" @click="resetFilters">
            Clear filters
          </button>
        </div>
      </template>

      <!-- Pagination footer -->
      <div class="table-footer">
        <span class="footer-count">{{ pagination.count ? `${pagination.count} total` : '' }}</span>
        <div class="pagination">
          <button
            class="icon-btn"
            :disabled="!pagination.previous || loading"
            aria-label="Previous page"
            @click="prevPage"
          >
            <ChevronLeft :size="13" />
          </button>
          <span class="page-indicator">{{ pagination.currentPage }} / {{ pagination.totalPages || 1 }}</span>
          <button
            class="icon-btn"
            :disabled="!pagination.next || loading"
            aria-label="Next page"
            @click="nextPage"
          >
            <ChevronRight :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Pending Invitations ───────────────────────────────────────── -->
    <div class="card">
      <div class="section-header">
        <div>
          <div class="section-title">Pending Invitations</div>
          <div class="section-sub">{{ invitations.length }} outstanding</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="showInviteModal = true">
          <Plus :size="11" /> Send invitation
        </button>
      </div>

      <template v-if="invLoading">
        <div class="skel-table">
          <div v-for="i in 3" :key="i" class="skel-row">
            <div class="skel" style="width:180px;height:13px" />
            <div class="skel" style="width:70px;height:18px;border-radius:99px" />
            <div class="skel" style="width:110px;height:13px" />
            <div class="skel" style="width:80px;height:13px" />
            <div class="skel" style="width:60px;height:18px;border-radius:99px" />
            <div class="skel" style="width:55px;height:26px;border-radius:6px" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="table-scroll">
          <table class="data-table" aria-label="Pending invitations">
            <thead>
              <tr>
                <th>Email</th><th>Role</th><th>Invited by</th>
                <th>Expires</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="invitations.length === 0">
                <td colspan="6" class="empty-row">No pending invitations</td>
              </tr>
              <tr v-for="inv in invitations" :key="inv.id">
                <td class="cell-semibold">{{ inv.email }}</td>
                <td><span class="badge badge-neutral">{{ roleLabel(inv.role) }}</span></td>
                <td class="cell-muted">{{ inv.invited_by_name || inv.invited_by || '—' }}</td>
                <td class="cell-mono">{{ formatDate(inv.expires_at) }}</td>
                <td>
                  <span class="badge" :class="inv.status === 'pending' ? 'badge-warning' : 'badge-neutral'">
                    {{ inv.status }}
                  </span>
                </td>
                <td>
                  <button
                    class="btn btn-ghost btn-sm text-danger"
                    :disabled="revokingId === inv.id"
                    :aria-label="`Revoke invitation for ${inv.email}`"
                    @click="revokeInvitation(inv)"
                  >
                    <Loader2 v-if="revokingId === inv.id" :size="10" class="spinning" />
                    <span v-else>Revoke</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- ═══════════════  MODALS  ═══════════════════════════════════════ -->

    <!-- Edit user -->
    <AppModal v-model="showEditModal" title="Edit User" max-width="460px">
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">First name</label>
          <input v-model="editForm.first_name" class="input" autocomplete="given-name" />
        </div>
        <div class="form-field">
          <label class="field-label">Last name</label>
          <input v-model="editForm.last_name" class="input" autocomplete="family-name" />
        </div>
        <div class="form-field span-2">
          <label class="field-label">Phone</label>
          <input v-model="editForm.phone" type="tel" class="input" />
        </div>
        <div class="form-field span-2">
          <label class="field-label">Role</label>
          <select v-model="editForm.role" class="input">
            <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div class="form-field span-2">
          <label class="field-label">Bio</label>
          <textarea v-model="editForm.bio" class="input" rows="2" style="resize:vertical" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
          <Loader2 v-if="saving" :size="12" class="spinning" />
          <span v-else>Save changes</span>
        </button>
      </template>
    </AppModal>

    <!-- Create account -->
    <AppModal v-model="showCreateModal" title="Create Account" max-width="480px">
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">First name</label>
          <input v-model="createForm.first_name" class="input" autocomplete="off" />
        </div>
        <div class="form-field">
          <label class="field-label">Last name</label>
          <input v-model="createForm.last_name" class="input" autocomplete="off" />
        </div>
        <div class="form-field span-2" :class="{ 'field-error': createErrors.email }">
          <label class="field-label">Email <span class="required">*</span></label>
          <input v-model="createForm.email" type="email" class="input" autocomplete="off" />
          <span v-if="createErrors.email" class="error-msg">{{ createErrors.email }}</span>
        </div>
        <div class="form-field" :class="{ 'field-error': createErrors.username }">
          <label class="field-label">Username <span class="required">*</span></label>
          <input v-model="createForm.username" class="input" autocomplete="off" />
          <span v-if="createErrors.username" class="error-msg">{{ createErrors.username }}</span>
        </div>
        <div class="form-field" :class="{ 'field-error': createErrors.password }">
          <label class="field-label">Password <span class="required">*</span></label>
          <input v-model="createForm.password" type="password" class="input" autocomplete="new-password" />
          <span v-if="createErrors.password" class="error-msg">{{ createErrors.password }}</span>
        </div>
        <div class="form-field span-2">
          <label class="field-label">Role</label>
          <select v-model="createForm.role" class="input">
            <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div class="form-field span-2">
          <label class="field-label">Phone</label>
          <input v-model="createForm.phone" type="tel" class="input" autocomplete="off" />
        </div>
        <div v-if="createErrors._global" class="alert alert-error span-2">
          <AlertTriangle :size="13" />{{ createErrors._global }}
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="creating" @click="submitCreate">
          <Loader2 v-if="creating" :size="12" class="spinning" />
          <span v-else>Create account</span>
        </button>
      </template>
    </AppModal>

    <!-- Send invitation -->
    <AppModal v-model="showInviteModal" title="Send Invitation" max-width="420px">
      <div class="form-grid">
        <div class="form-field span-2" :class="{ 'field-error': inviteErrors.email }">
          <label class="field-label">Email <span class="required">*</span></label>
          <input
            v-model="inviteForm.email"
            type="email"
            class="input"
            placeholder="user@example.com"
            autocomplete="off"
          />
          <span v-if="inviteErrors.email" class="error-msg">{{ inviteErrors.email }}</span>
        </div>
        <div class="form-field span-2">
          <label class="field-label">Role</label>
          <select v-model="inviteForm.role" class="input">
            <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div v-if="inviteErrors._global" class="alert alert-error span-2">
          <AlertTriangle :size="13" />{{ inviteErrors._global }}
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showInviteModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="inviting" @click="submitInvite">
          <Loader2 v-if="inviting" :size="12" class="spinning" />
          <span v-else>Send invitation</span>
        </button>
      </template>
    </AppModal>

    <!-- Sessions viewer -->
    <AppModal
      v-model="showSessionsModal"
      :title="`Sessions — ${sessionUser?.full_name || sessionUser?.username || ''}`"
      max-width="700px"
    >
      <div v-if="sessionsLoading" class="empty-state" style="padding:32px">
        <Loader2 :size="24" class="spinning" style="color:var(--fg-dim)" />
      </div>
      <div v-else-if="sessions.length === 0" class="empty-row" style="padding:24px;text-align:center">
        No active sessions found
      </div>
      <div v-else class="table-scroll">
        <table class="data-table" aria-label="User sessions">
          <thead>
            <tr>
              <th>IP address</th><th>Browser</th><th>OS</th>
              <th>Device</th><th>Last active</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.id">
              <td class="cell-mono">{{ s.ip_address || '—' }}</td>
              <td class="cell-muted">{{ s.browser || '—' }}</td>
              <td class="cell-muted">{{ s.os || '—' }}</td>
              <td class="cell-muted">{{ s.device_type || '—' }}</td>
              <td class="cell-mono">{{ formatDate(s.last_activity) }}</td>
              <td>
                <span class="badge" :class="s.is_active ? 'badge-success' : 'badge-neutral'">
                  {{ s.is_active ? 'Active' : 'Expired' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showSessionsModal = false">Close</button>
      </template>
    </AppModal>

  </div>
</template>

<script setup lang="ts">
/**
 * app/pages/users.vue  —  UAPTS Platform
 *
 * Nuxt 4 (srcDir: 'app') — correct patterns:
 *   • $fetch via useRequestFetch() or useNuxtApp().$fetch is NOT used here;
 *     instead we call the backend directly with native fetch + auth header,
 *     keeping all data loading client-side (onMounted) so no server-side
 *     token leakage occurs with SSR enabled.
 *   • useRuntimeConfig() accessed at the top level of <script setup> (Nuxt rule).
 *   • useAuthStore() accessed at the top level of <script setup> (Pinia / Nuxt rule).
 *   • AppModal is in app/components/ → Nuxt auto-imports it; no explicit import needed.
 *   • All lucide-vue-next icons are explicitly imported (tree-shakeable).
 *   • definePageMeta() is a compiler macro — called at the top level, no import needed.
 */

import {
  UserPlus, Plus, Search, Edit2, Monitor, UserX, UserCheck,
  Users, ChevronLeft, ChevronRight, AlertTriangle, X,
  Loader2, RefreshCw, ShieldOff, Trash2, Activity, Shield, CheckCircle,
} from 'lucide-vue-next'

// ── Page meta (Nuxt 4 compiler macro — no import, top-level only) ──────────
definePageMeta({ layout: 'default' })

// ── Nuxt composables (must be called at top level of <script setup>) ────────
const { public: { apiBase } } = useRuntimeConfig()
const auth = useAuthStore()          // app/stores/auth.ts  — auto-imported by @pinia/nuxt

// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 15

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'org_admin',   label: 'Org Admin'   },
  { value: 'dept_head',   label: 'Dept Head'   },
  { value: 'manager',     label: 'Manager'     },
  { value: 'supervisor',  label: 'Supervisor'  },
  { value: 'operator',    label: 'Operator'    },
  { value: 'analyst',     label: 'Analyst'     },
  { value: 'executive',   label: 'Executive'   },
  { value: 'viewer',      label: 'Viewer'      },
] as const
type RoleValue = typeof ROLE_OPTIONS[number]['value']

const ROLE_TABS = [
  { value: 'all',         label: 'All'        },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'org_admin',   label: 'Org Admin'  },
  { value: 'analyst',     label: 'Analyst'    },
  { value: 'operator',    label: 'Operator'   },
  { value: 'viewer',      label: 'Viewer'     },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'badge-danger',
  org_admin:   'badge-primary',
  dept_head:   'badge-primary',
  manager:     'badge-info',
  supervisor:  'badge-info',
  operator:    'badge-success',
  analyst:     'badge-success',
  executive:   'badge-warning',
  viewer:      'badge-neutral',
}

const AVATAR_COLOURS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
]

// ── API helper ─────────────────────────────────────────────────────────────
/**
 * Thin fetch wrapper around the UAPTS DRF backend.
 *
 * Design decisions (Nuxt 4 / SSR-safe):
 *  - Token is read from Pinia (auth.accessToken), never from localStorage.
 *  - apiBase comes from runtimeConfig.public — no hardcoded strings.
 *  - Called only inside onMounted / event handlers → client-side only, no
 *    risk of leaking tokens through SSR payloads.
 *  - On 401, attempts one silent refresh via auth.refreshAccessToken() then
 *    redirects to /login if that also fails.
 *  - Surfaces readable DRF validation errors (detail / message / field errors).
 */
async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const res = await fetch(`${apiBase}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept:         'application/json',
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  // Silent token refresh on 401 (once)
  if (res.status === 401 && !_isRetry) {
    const refreshed = await auth.refreshAccessToken()
    if (refreshed) return apiFetch(path, options, true)
    await navigateTo('/login')
    throw new Error('Session expired. Please log in again.')
  }

  // 204 No Content (DELETE / activate / deactivate actions)
  if (res.status === 204) return null as T

  const body = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    // Surface the most useful DRF error message available
    const msg =
      (body.detail as string) ??
      (body.message as string) ??
      (Object.values(body) as string[][]).flat().filter(v => typeof v === 'string').join(' ') ??
      `HTTP ${res.status}`
    throw new Error(msg)
  }

  return body as T
}

// ── Types matching DRF schema ──────────────────────────────────────────────
interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  organization: number | null
  organization_name?: string
  department: number | null
  department_name?: string
  employee_id: string
  phone: string
  avatar: string | null
  date_of_birth: string | null
  date_of_joining: string | null
  bio: string
  is_online: boolean
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  last_seen_at: string | null
  last_login: string | null
  verified_at: string | null
  date_joined: string
  profile?: {
    id: number
    timezone: string
    locale: string
    theme: string
  }
}

interface Invitation {
  id: number
  email: string
  role: string
  invited_by?: number | string
  invited_by_name?: string
  expires_at: string
  status: string
}

interface Session {
  id: number
  ip_address: string
  browser: string
  os: string
  device_type: string
  is_active: boolean
  last_activity: string
  expires_at: string
}

interface PagedResponse<T> {
  count: number
  total_pages: number
  current_page: number
  next: string | null
  previous: string | null
  results: T[]
}

// ── Reactive state ─────────────────────────────────────────────────────────
const users       = ref<User[]>([])
const invitations = ref<Invitation[]>([])
const sessions    = ref<Session[]>([])

const loading         = ref(false)
const invLoading      = ref(false)
const sessionsLoading = ref(false)
const togglingId      = ref<number | null>(null)
const revokingId      = ref<number | null>(null)
const saving          = ref(false)
const creating        = ref(false)
const inviting        = ref(false)
const globalError     = ref('')

const searchInput    = ref('')
const searchQuery    = ref('')
const searchFocused  = ref(false)
const selectedRole   = ref('all')
const selectedStatus = ref('')
const currentPage    = ref(1)
const orgCount       = ref(0)

const pagination = reactive({
  count: 0, totalPages: 1, currentPage: 1,
  next: null as string | null, previous: null as string | null,
})

const selected = ref<number[]>([])

const showEditModal     = ref(false)
const showCreateModal   = ref(false)
const showInviteModal   = ref(false)
const showSessionsModal = ref(false)
const sessionUser       = ref<User | null>(null)

const editForm = reactive({
  id: 0, first_name: '', last_name: '', phone: '',
  role: '' as RoleValue | '', bio: '',
})
const createForm = reactive({
  first_name: '', last_name: '', email: '',
  username: '', password: '', role: 'viewer' as RoleValue, phone: '',
})
const createErrors = reactive<Record<string, string>>({})

const inviteForm   = reactive({ email: '', role: 'viewer' as RoleValue })
const inviteErrors = reactive<Record<string, string>>({})

// ── Computed ───────────────────────────────────────────────────────────────
const allSelected = computed(() =>
  users.value.length > 0 && users.value.every(u => selected.value.includes(u.id)),
)
const someSelected = computed(() =>
  selected.value.length > 0 && !allSelected.value,
)
const roleCounts = computed(() => {
  const c: Record<string, number> = { all: pagination.count }
  for (const u of users.value) c[u.role] = (c[u.role] ?? 0) + 1
  return c
})
const statsCards = computed(() => [
  {
    label: 'Total accounts', value: pagination.count,
    icon: Users, colour: '#3b82f6', bg: 'rgba(59,130,246,.12)',
  },
  {
    label: 'Online now', value: users.value.filter(u => u.is_online).length,
    icon: Activity, colour: '#10b981', bg: 'rgba(16,185,129,.12)',
  },
  {
    label: 'Staff accounts', value: users.value.filter(u => u.is_staff).length,
    icon: Shield, colour: '#22d3ee', bg: 'rgba(34,211,238,.12)',
  },
  {
    label: 'Pending invites', value: invitations.value.length,
    icon: CheckCircle, colour: '#f59e0b', bg: 'rgba(245,158,11,.12)',
  },
])

// ── Data fetching ──────────────────────────────────────────────────────────
async function fetchUsers() {
  loading.value     = true
  globalError.value = ''
  try {
    const p = new URLSearchParams({
      page:      String(currentPage.value),
      page_size: String(PAGE_SIZE),
    })
    if (searchQuery.value)                   p.set('search',    searchQuery.value)
    if (selectedRole.value !== 'all')        p.set('role',      selectedRole.value)
    if (selectedStatus.value === 'active')   p.set('is_active', 'true')
    if (selectedStatus.value === 'inactive') p.set('is_active', 'false')

    const data = await apiFetch<PagedResponse<User>>(`/accounts/users/?${p}`)
    users.value            = data.results
    pagination.count       = data.count
    pagination.totalPages  = data.total_pages
    pagination.currentPage = data.current_page
    pagination.next        = data.next
    pagination.previous    = data.previous
    selected.value         = []
  }
  catch (err: unknown) {
    globalError.value = err instanceof Error ? err.message : 'Failed to load users.'
  }
  finally {
    loading.value = false
  }
}

async function fetchInvitations() {
  invLoading.value = true
  try {
    const data = await apiFetch<PagedResponse<Invitation>>('/accounts/invitations/')
    // API returns paginated shape; fall back gracefully if it ever returns a flat array
    invitations.value = data.results ?? (data as unknown as Invitation[])
  }
  catch {
    invitations.value = []
  }
  finally {
    invLoading.value = false
  }
}

// ── User actions ───────────────────────────────────────────────────────────
async function toggleActive(user: User) {
  togglingId.value = user.id
  // POST /api/v1/accounts/users/{id}/activate|deactivate/
  const ep = user.is_active
    ? `/accounts/users/${user.id}/deactivate/`
    : `/accounts/users/${user.id}/activate/`
  try {
    await apiFetch(ep, { method: 'POST' })
    user.is_active = !user.is_active
  }
  catch (err: unknown) {
    globalError.value = err instanceof Error ? err.message : 'Action failed.'
  }
  finally {
    togglingId.value = null
  }
}

function openEdit(user: User) {
  Object.assign(editForm, {
    id: user.id, first_name: user.first_name, last_name: user.last_name,
    phone: user.phone, role: user.role, bio: user.bio,
  })
  showEditModal.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    // PATCH /api/v1/accounts/users/{id}/
    const updated = await apiFetch<User>(`/accounts/users/${editForm.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        first_name: editForm.first_name,
        last_name:  editForm.last_name,
        phone:      editForm.phone,
        role:       editForm.role,
        bio:        editForm.bio,
      }),
    })
    const idx = users.value.findIndex(u => u.id === editForm.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...updated }
    showEditModal.value = false
  }
  catch (err: unknown) {
    globalError.value = err instanceof Error ? err.message : 'Save failed.'
  }
  finally {
    saving.value = false
  }
}

function openCreate() {
  Object.assign(createForm, {
    first_name: '', last_name: '', email: '',
    username: '', password: '', role: 'viewer', phone: '',
  })
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  showCreateModal.value = true
}

async function submitCreate() {
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  let ok = true
  if (!createForm.email)    { createErrors.email    = 'Email is required.';    ok = false }
  if (!createForm.username) { createErrors.username = 'Username is required.'; ok = false }
  if (!createForm.password) { createErrors.password = 'Password is required.'; ok = false }
  if (!ok) return

  creating.value = true
  try {
    // POST /api/v1/accounts/users/  (admin create)
    await apiFetch('/accounts/users/', {
      method: 'POST',
      body:   JSON.stringify({ ...createForm }),
    })
    showCreateModal.value = false
    await fetchUsers()
  }
  catch (err: unknown) {
    createErrors._global = err instanceof Error ? err.message : 'Create failed.'
  }
  finally {
    creating.value = false
  }
}

async function submitInvite() {
  Object.keys(inviteErrors).forEach(k => delete inviteErrors[k])
  if (!inviteForm.email) { inviteErrors.email = 'Email is required.'; return }

  inviting.value = true
  try {
    // POST /api/v1/accounts/invitations/
    await apiFetch('/accounts/invitations/', {
      method: 'POST',
      body:   JSON.stringify({ email: inviteForm.email, role: inviteForm.role }),
    })
    inviteForm.email  = ''
    inviteForm.role   = 'viewer'
    showInviteModal.value = false
    await fetchInvitations()
  }
  catch (err: unknown) {
    inviteErrors._global = err instanceof Error ? err.message : 'Invite failed.'
  }
  finally {
    inviting.value = false
  }
}

async function revokeInvitation(inv: Invitation) {
  revokingId.value = inv.id
  try {
    // POST /api/v1/accounts/invitations/{id}/revoke/
    await apiFetch(`/accounts/invitations/${inv.id}/revoke/`, { method: 'POST' })
    invitations.value = invitations.value.filter(i => i.id !== inv.id)
  }
  catch (err: unknown) {
    globalError.value = err instanceof Error ? err.message : 'Revoke failed.'
  }
  finally {
    revokingId.value = null
  }
}

async function openSessions(user: User) {
  sessionUser.value       = user
  showSessionsModal.value = true
  sessionsLoading.value   = true
  sessions.value          = []
  try {
    // GET /api/v1/accounts/users/{id}/sessions/
    const data = await apiFetch<PagedResponse<Session>>(`/accounts/users/${user.id}/sessions/`)
    sessions.value = data.results ?? (data as unknown as Session[])
  }
  catch {
    sessions.value = []
  }
  finally {
    sessionsLoading.value = false
  }
}

// ── Bulk actions ───────────────────────────────────────────────────────────
async function bulkDeactivate() {
  const targets = users.value.filter(u => selected.value.includes(u.id) && u.is_active)
  for (const u of targets) await toggleActive(u)
  selected.value = []
}

async function bulkDelete() {
  if (!confirm(`Permanently delete ${selected.value.length} account(s)? This cannot be undone.`)) return
  for (const id of selected.value) {
    try {
      // DELETE /api/v1/accounts/users/{id}/
      await apiFetch(`/accounts/users/${id}/`, { method: 'DELETE' })
    }
    catch { /* skip individual failures; surface them if needed */ }
  }
  selected.value = []
  await fetchUsers()
}

// ── Filters / pagination ───────────────────────────────────────────────────
function applyFilters() { currentPage.value = 1; fetchUsers() }
function setRole(role: string) { selectedRole.value = role; applyFilters() }
function resetFilters() {
  searchInput.value  = ''
  searchQuery.value  = ''
  selectedRole.value   = 'all'
  selectedStatus.value = ''
  currentPage.value    = 1
  fetchUsers()
}
function prevPage() { if (pagination.previous) { currentPage.value--; fetchUsers() } }
function nextPage() { if (pagination.next)     { currentPage.value++; fetchUsers() } }

let _debounce: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(_debounce)
  _debounce = setTimeout(() => {
    searchQuery.value = searchInput.value.trim()
    applyFilters()
  }, 350)
}
function clearSearch() { searchInput.value = ''; searchQuery.value = ''; applyFilters() }

function toggleSelectAll(e: Event) {
  selected.value = (e.target as HTMLInputElement).checked
    ? users.value.map(u => u.id)
    : []
}

// ── Display helpers ────────────────────────────────────────────────────────
function initials(user: User) {
  return (user.full_name || user.username || user.email)
    .split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarStyle(user: User): Record<string, string> {
  if (user.avatar) return {}
  const c = AVATAR_COLOURS[user.id % AVATAR_COLOURS.length]
  return { background: `linear-gradient(135deg, ${c}, ${c}99)` }
}
function roleLabel(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.label ?? role
}
function roleBadge(role: string) { return ROLE_BADGE[role] ?? 'badge-neutral' }
function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(iso))
}
function relativeTime(iso?: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
// onMounted keeps all fetches client-side — safe with SSR: true in nuxt.config
onMounted(() => {
  fetchUsers()
  fetchInvitations()
})
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────── */
.users-page { display:flex; flex-direction:column; gap:20px; }
.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.breadcrumb { font-size:.6875rem; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--fg-dim); margin-bottom:4px; }
.breadcrumb .sep { margin:0 6px; }
.page-title { font-size:1.25rem; font-weight:700; color:var(--fg); letter-spacing:-.01em; }
.page-sub { font-size:.75rem; color:var(--fg-muted); margin-top:3px; display:flex; align-items:center; gap:4px; }
.header-actions { display:flex; gap:8px; align-items:center; }

/* ── Alert ────────────────────────────────────────────────────────────── */
.alert { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:var(--radius-sm,6px); font-size:.8125rem; }
.alert-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); color:#f87171; }

/* ── Stats ────────────────────────────────────────────────────────────── */
.stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; }
.stat-card { background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius,10px); display:flex; align-items:center; gap:14px; padding:16px; }
.stat-icon { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.stat-value { font-size:1.375rem; font-weight:700; color:var(--fg); line-height:1.1; }
.stat-label { font-size:.6875rem; color:var(--fg-muted); margin-top:2px; font-weight:500; text-transform:uppercase; letter-spacing:.04em; }

/* ── Card ──────────────────────────────────────────────────────────────── */
.card { background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius,10px); overflow:hidden; }

/* ── Toolbar ───────────────────────────────────────────────────────────── */
.toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); gap:12px; flex-wrap:wrap; background:var(--bg-1); position:sticky; top:0; z-index:10; }
.toolbar-right { display:flex; align-items:center; gap:8px; }
.role-tabs { display:flex; gap:2px; flex-wrap:wrap; }
.role-tab { display:flex; align-items:center; gap:5px; padding:5px 11px; border-radius:6px; border:none; font-size:.75rem; font-weight:500; cursor:pointer; color:var(--fg-muted); background:transparent; transition:background .1s,color .1s; }
.role-tab:hover { color:var(--fg); background:rgba(255,255,255,.04); }
.role-tab.active { color:var(--fg); background:rgba(59,130,246,.14); }
.tab-badge { background:rgba(255,255,255,.07); border-radius:99px; padding:1px 6px; font-size:.6875rem; }
.search-box { display:flex; align-items:center; gap:6px; background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-sm,6px); padding:0 10px; transition:border-color .15s; }
.search-box.focused { border-color:var(--primary,#3b82f6); }
.search-icon { color:var(--fg-dim); flex-shrink:0; }
.search-input { background:transparent; border:none; outline:none; color:var(--fg); font-size:.8125rem; width:175px; padding:7px 0; font-family:var(--font-sans); }
.search-input::placeholder { color:var(--fg-dim); }
.filter-select { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-sm,6px); color:var(--fg); font-size:.75rem; padding:6px 10px; outline:none; cursor:pointer; }

/* ── Bulk bar ──────────────────────────────────────────────────────────── */
.bulk-bar { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:rgba(59,130,246,.08); border-bottom:1px solid rgba(59,130,246,.2); }
.bulk-label { font-size:.75rem; font-weight:600; color:var(--primary,#3b82f6); }
.bulk-actions { display:flex; gap:6px; }

/* ── Skeleton ──────────────────────────────────────────────────────────── */
.skel { background:var(--bg-2,#1e2229); border-radius:4px; animation:pulse 1.4s ease-in-out infinite; }
.skel-inline { display:inline-block; vertical-align:middle; }
.skel-table { padding:0 16px; }
.skel-row { display:flex; align-items:center; gap:16px; padding:14px 0; border-bottom:1px solid var(--border); }
.skel-check { width:16px; height:16px; border-radius:3px; flex-shrink:0; }
.skel-avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; }
.skel-user-cell { display:flex; align-items:center; gap:10px; flex:1; }

/* ── Table ─────────────────────────────────────────────────────────────── */
.table-scroll { overflow-x:auto; }
.data-table { width:100%; border-collapse:collapse; font-size:.8125rem; }
.data-table th { padding:10px 14px; text-align:left; font-size:.6875rem; font-weight:600; color:var(--fg-dim); letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--border); background:var(--bg-0,#13161b); white-space:nowrap; }
.data-table td { padding:12px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.data-table tbody tr { transition:background .1s; }
.data-table tbody tr:hover { background:rgba(255,255,255,.025); }
.data-table tbody tr:last-child td { border-bottom:none; }
.col-check { width:40px; }
.col-actions { width:100px; }
.row-inactive td { opacity:.5; }
.cell-muted { color:var(--fg-muted); }
.cell-semibold { font-weight:500; }
.cell-mono { font-family:var(--font-mono); font-size:.75rem; color:var(--fg-dim); }
.user-cell { display:flex; align-items:center; gap:10px; }
.avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.625rem; font-weight:700; color:#fff; overflow:hidden; }
.avatar-img { width:100%; height:100%; object-fit:cover; border-radius:50%; display:block; }
.user-name { font-size:.8125rem; font-weight:500; color:var(--fg); }
.user-email { font-size:.6875rem; color:var(--fg-dim); margin-top:1px; }

/* ── Status dot ─────────────────────────────────────────────────────────── */
.status-dot { display:inline-block; width:5px; height:5px; border-radius:50%; margin-right:4px; }
.dot-active { background:#10b981; box-shadow:0 0 4px #10b981; }
.dot-inactive { background:var(--fg-dim); }

/* ── Badges ─────────────────────────────────────────────────────────────── */
.badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:.6875rem; font-weight:600; white-space:nowrap; }
.badge-primary { background:rgba(59,130,246,.15);  color:#60a5fa; }
.badge-success { background:rgba(16,185,129,.15);  color:#34d399; }
.badge-warning { background:rgba(245,158,11,.15);  color:#fbbf24; }
.badge-danger  { background:rgba(239,68,68,.15);   color:#f87171; }
.badge-info    { background:rgba(34,211,238,.15);  color:#22d3ee; }
.badge-neutral { background:rgba(255,255,255,.07); color:var(--fg-muted); }

/* ── Icon buttons ───────────────────────────────────────────────────────── */
.icon-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:5px; border:none; cursor:pointer; background:transparent; color:var(--fg-muted); transition:background .1s,color .1s; }
.icon-btn:hover { background:rgba(255,255,255,.07); color:var(--fg); }
.icon-btn:disabled { opacity:.4; cursor:not-allowed; }
.icon-btn-subtle { background:var(--bg-2,#1e2229); border:1px solid var(--border); }
.hover-warn:hover    { color:#fbbf24; border-color:rgba(245,158,11,.4); }
.hover-success:hover { color:#34d399; border-color:rgba(16,185,129,.4); }
.spinning { animation:spin .75s linear infinite; }
.action-group { display:flex; align-items:center; gap:4px; }

/* ── Empty / footer ─────────────────────────────────────────────────────── */
.empty-state { display:flex; flex-direction:column; align-items:center; padding:64px 24px; text-align:center; }
.empty-icon  { color:var(--fg-dim); margin-bottom:12px; }
.empty-title { font-size:.9375rem; font-weight:600; color:var(--fg); }
.empty-sub   { font-size:.8125rem; color:var(--fg-muted); margin-top:4px; }
.empty-row   { text-align:center; font-size:.75rem; color:var(--fg-dim); padding:20px; }
.table-footer    { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid var(--border); }
.footer-count    { font-size:.75rem; color:var(--fg-dim); }
.pagination      { display:flex; align-items:center; gap:6px; }
.page-indicator  { font-size:.75rem; color:var(--fg-muted); padding:0 6px; min-width:56px; text-align:center; }

/* ── Section header ──────────────────────────────────────────────────────── */
.section-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); }
.section-title  { font-size:.875rem; font-weight:600; color:var(--fg); }
.section-sub    { font-size:.75rem; color:var(--fg-muted); margin-top:2px; }
.text-danger    { color:#f87171; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:7px 14px; border-radius:var(--radius-sm,6px); border:none; font-size:.8125rem; font-weight:500; cursor:pointer; white-space:nowrap; transition:background .1s,opacity .1s; }
.btn:disabled { opacity:.5; cursor:not-allowed; }
.btn-sm        { padding:5px 10px; font-size:.75rem; }
.btn-primary   { background:var(--primary,#3b82f6); color:#fff; }
.btn-primary:hover:not(:disabled)   { background:#2563eb; }
.btn-secondary { background:var(--bg-2); border:1px solid var(--border); color:var(--fg); }
.btn-secondary:hover:not(:disabled) { background:var(--bg-3,#252830); }
.btn-ghost     { background:transparent; color:var(--fg-muted); }
.btn-ghost:hover:not(:disabled)     { background:rgba(255,255,255,.06); color:var(--fg); }
.btn-danger    { background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#f87171; }
.btn-danger:hover:not(:disabled)    { background:rgba(239,68,68,.22); }

/* ── Modal form ──────────────────────────────────────────────────────────── */
.form-grid   { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.span-2      { grid-column:span 2; }
.form-field  { display:flex; flex-direction:column; gap:5px; }
.field-label { font-size:.75rem; font-weight:500; color:var(--fg-muted); }
.required    { color:#f87171; }
.input { width:100%; background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-sm,6px); color:var(--fg); font-size:.8125rem; padding:8px 10px; outline:none; font-family:var(--font-sans); transition:border-color .15s; box-sizing:border-box; }
.input:focus      { border-color:var(--primary,#3b82f6); }
select.input      { cursor:pointer; }
.field-error .input { border-color:#f87171; }
.error-msg   { font-size:.6875rem; color:#f87171; }

/* ── Transitions ──────────────────────────────────────────────────────────── */
.fade-enter-active,.fade-leave-active       { transition:opacity .2s; }
.fade-enter-from,.fade-leave-to             { opacity:0; }
.slide-down-enter-active,.slide-down-leave-active { transition:all .2s ease; }
.slide-down-enter-from,.slide-down-leave-to       { opacity:0; transform:translateY(-6px); }

/* ── Keyframes ───────────────────────────────────────────────────────────── */
@keyframes spin  { to { transform:rotate(360deg); } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
input[type="checkbox"] { accent-color:var(--primary,#3b82f6); width:14px; height:14px; cursor:pointer; }
</style>