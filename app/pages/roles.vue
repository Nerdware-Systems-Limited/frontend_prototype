<template>
  <PageHeader
    eyebrow="Access Control"
    title="Roles & Departments"
    subtitle="RBAC role definitions and organisational departments across UAPTS agencies"
  >
    <template #actions>
      <span class="freshness-badge">{{ roles.length }} roles · {{ departments.length }} departments</span>
      <NuxtLink to="/users" class="btn">Users →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="two-col">
    <!-- Roles table -->
    <div>
      <SectionTitle pill="RBAC">Roles</SectionTitle>

      <div class="card">
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Permissions</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody v-if="roles.length">
              <tr v-for="r in roles" :key="r.id">
                <td style="font-weight:600">{{ r.role_name }}</td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    <BadgePill
                      v-for="p in ((r as any).permissions ?? [])"
                      :key="p"
                      variant="neutral"
                    >{{ p }}</BadgePill>
                    <span v-if="!((r as any).permissions ?? []).length" style="color:#94a3b8;font-size:12px">-</span>
                  </div>
                </td>
                <td style="font-weight:600;text-align:center">{{ (r as any).user_count ?? '-' }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading roles…' : 'No roles found.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Role descriptions -->
      <div class="role-legend">
        <div v-for="r in builtinRoles" :key="r.key" class="role-legend-item">
          <BadgePill :variant="roleBadge(r.key)">{{ r.key }}</BadgePill>
          <span style="font-size:12px;color:#64748b">{{ r.description }}</span>
        </div>
      </div>
    </div>

    <!-- Departments table -->
    <div>
      <SectionTitle pill="Org Structure">Departments</SectionTitle>

      <div class="card">
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Agency</th>
                <th>Parent</th>
              </tr>
            </thead>
            <tbody v-if="departments.length">
              <tr v-for="d in departments" :key="d.id">
                <td style="font-weight:600">{{ d.department_name }}</td>
                <td style="font-family:monospace;font-size:12px">{{ d.department_code }}</td>
                <td><BadgePill variant="neutral">{{ d.agency_code ?? d.agency }}</BadgePill></td>
                <td style="font-size:12px;color:#64748b">{{ d.parent_department ?? '-' }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading departments…' : 'No departments found.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Roles')

import { useRoles as _useRoles, useDepartments as _useDepartments } from '~/composables/api'
import type { Role, Department } from '~/composables/api'

const roles       = ref<Role[]>([])
const departments = ref<Department[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const [rRes, dRes] = await Promise.allSettled([
    _useRoles().list(),
    _useDepartments().list(),
  ])

  if (rRes.status === 'fulfilled') roles.value       = (rRes.value as any).results ?? rRes.value ?? []
  if (dRes.status === 'fulfilled') departments.value = (dRes.value as any).results ?? dRes.value ?? []

  if (rRes.status === 'rejected' && dRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Accounts API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const builtinRoles = [
  { key: 'admin',    description: 'Full platform access - manage users, configure integrations, access all modules' },
  { key: 'analyst',  description: 'Read all data, run queries, generate reports - no user or config management' },
  { key: 'operator', description: 'Operational actions - update incident status, dispatch, trigger integrations' },
  { key: 'public',   description: 'Read-only access to published summaries and public dashboards' },
]

function roleBadge(r: string) {
  const m: Record<string,string> = { admin:'danger', analyst:'info', operator:'fair', public:'neutral' }
  return m[r] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.role-legend { display:flex; flex-direction:column; gap:8px; margin-top:12px; padding:12px; background:#f8fafc; border-radius:8px; }
.role-legend-item { display:flex; align-items:baseline; gap:8px; }
</style>
