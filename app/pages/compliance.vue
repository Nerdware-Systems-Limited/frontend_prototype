<script setup lang="ts">
// pages/compliance.vue - M12 Regulatory Compliance Tracker.
//
// Wires to:
//   • /api/v1/public-transport/psv-licenses/   - operator licensing (NTSA)
//   • /api/v1/public-transport/compliance/     - route compliance checks (NTSA + NaMATA)
//   • /api/v1/safety/kpis/                     - safety KPIs cross-cut
//
// The page groups PSV licenses by status (active / suspended / expired),
// shows route compliance checks, and surfaces aggregate KPIs that
// an NTSA / KCAA / KMA compliance officer would look at first.
import { RefreshCw, ClipboardList, ShieldCheck, ShieldAlert, AlertTriangle, FileCheck } from 'lucide-vue-next'
import { usePublicTransport, useSafety } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Compliance' })

const pt = usePublicTransport()
const safety = useSafety()

const licenses = ref<any[]>([])
const checks = ref<any[]>([])
const kpis = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [l, c, k] = await Promise.allSettled([
      pt.psvLicenses({ page_size: 50 }),
      pt.compliance({ page_size: 50 }),
      (safety as any).kpis?.kpis?.({ page_size: 10 }),
    ])
    licenses.value = l.status === 'fulfilled' ? (l.value as any).results ?? [] : []
    checks.value   = c.status === 'fulfilled' ? (c.value as any).results ?? [] : []
    kpis.value     = k.status === 'fulfilled' ? (k.value as any).results ?? [] : []
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load compliance data.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const licenseCounts = computed(() => {
  const m: Record<string, number> = { active: 0, suspended: 0, expired: 0, revoked: 0, pending: 0 }
  for (const l of licenses.value) {
    m[l.status] = (m[l.status] ?? 0) + 1
  }
  return m
})

const checkCounts = computed(() => {
  const m: Record<string, number> = { compliant: 0, non_compliant: 0, pending: 0, warning: 0 }
  for (const c of checks.value) {
    m[c.status] = (m[c.status] ?? 0) + 1
  }
  return m
})

const expiringSoon = computed(() => {
  const now = Date.now()
  return licenses.value.filter((l) => {
    if (!l.expiry_date) return false
    const d = new Date(l.expiry_date).getTime()
    return d > now && d - now < 90 * 24 * 60 * 60 * 1000  // within 90d
  })
})

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysUntil(d?: string): number | null {
  if (!d) return null
  const ms = new Date(d).getTime() - Date.now()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}
</script>

<template>
  <div class="compliance-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M12 · Compliance</div>
        <h1 class="text-display">Regulatory Compliance</h1>
        <p class="text-sm text-fg-muted mt-1">
          NTSA PSV licensing, route compliance checks, and cross-agency safety KPIs.
        </p>
      </div>
      <button class="btn btn-secondary" @click="load">
        <RefreshCw :size="13" /> Refresh
      </button>
    </div>

    <!-- Top KPI strip -->
    <div class="kpi-grid">
      <div class="card kpi-card">
        <div class="kpi-icon kpi-cyan"><FileCheck :size="14" /></div>
        <div class="kpi-value">{{ licenses.length }}</div>
        <div class="kpi-label">PSV Licenses</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-icon kpi-green"><ShieldCheck :size="14" /></div>
        <div class="kpi-value">{{ licenseCounts.active || 0 }}</div>
        <div class="kpi-label">Active</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-icon kpi-amber"><AlertTriangle :size="14" /></div>
        <div class="kpi-value">{{ expiringSoon.length }}</div>
        <div class="kpi-label">Expiring &lt; 90d</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-icon kpi-red"><ShieldAlert :size="14" /></div>
        <div class="kpi-value">{{ checks.length }}</div>
        <div class="kpi-label">Compliance Checks</div>
      </div>
    </div>

    <div v-if="error" class="card"><div class="card-body text-fg-muted">{{ error }}</div></div>

    <!-- PSV Licenses -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <ClipboardList :size="15" class="text-primary" />
          <div class="text-subhead">PSV Licenses</div>
        </div>
        <span class="text-xs text-fg-dim">{{ licenses.length }} total</span>
      </div>
      <div v-if="loading && !licenses.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!licenses.length" class="card-body text-fg-muted">No PSV licenses on record.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>License #</th>
            <th>SACCO</th>
            <th>Route</th>
            <th>Status</th>
            <th>GPS Compliance</th>
            <th>Vehicles</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in licenses.slice(0, 30)" :key="l.id">
            <td class="font-mono text-xs">{{ l.license_number }}</td>
            <td>{{ l.sacco_name ?? '-' }}</td>
            <td>{{ l.route_name ?? '-' }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success': l.status === 'active',
                  'badge-warning': l.status === 'pending' || l.status === 'expiring_soon',
                  'badge-danger':  l.status === 'suspended' || l.status === 'revoked' || l.status === 'expired',
                }"
              >{{ l.status }}</span>
            </td>
            <td>
              <span v-if="l.gps_compliance_pct != null" class="font-mono text-xs">
                {{ Number(l.gps_compliance_pct).toFixed(1) }}%
              </span>
              <span v-else class="text-fg-dim text-xs">-</span>
            </td>
            <td>{{ l.vehicle_count ?? '-' }}</td>
            <td class="font-mono text-xs">
              {{ fmtDate(l.expiry_date) }}
              <span v-if="(daysUntil(l.expiry_date) ?? 999) < 30" class="text-amber-400 ml-1">
                ({{ daysUntil(l.expiry_date) }}d)
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Route Compliance Checks -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <ShieldCheck :size="15" class="text-primary" />
          <div class="text-subhead">Route Compliance Checks</div>
        </div>
        <span class="text-xs text-fg-dim">{{ checks.length }} total</span>
      </div>
      <div v-if="!checks.length" class="card-body text-fg-muted">No compliance checks recorded.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Route</th>
            <th>Check Type</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Checked</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in checks.slice(0, 30)" :key="c.id">
            <td>{{ c.route_name ?? '-' }}</td>
            <td>{{ c.check_type ?? '-' }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success': c.status === 'compliant',
                  'badge-danger':  c.status === 'non_compliant',
                  'badge-warning': c.status === 'warning' || c.status === 'pending',
                }"
              >{{ c.status }}</span>
            </td>
            <td class="text-xs">{{ c.notes ?? '-' }}</td>
            <td class="font-mono text-xs">{{ fmtDate(c.checked_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Safety KPIs cross-cut -->
    <div v-if="kpis.length" class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <ShieldAlert :size="15" class="text-primary" />
          <div class="text-subhead">Safety KPI Cross-cut (M05)</div>
        </div>
      </div>
      <div class="kpi-list">
        <div v-for="k in kpis" :key="k.id" class="kpi-row">
          <div class="text-sm font-medium">{{ k.label ?? k.name ?? k.metric ?? '-' }}</div>
          <div class="kpi-row-value">{{ k.value ?? '-' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compliance-page { display: flex; flex-direction: column; gap: 16px; }
.card-body { padding: 18px; }
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}

.kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.kpi-card { padding: 16px; }
.kpi-icon { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.kpi-primary { background: rgba(59,130,246,0.12); color: #3b82f6; }
.kpi-cyan    { background: rgba(34,211,238,0.12); color: #22d3ee; }
.kpi-green   { background: rgba(16,185,129,0.12); color: #10b981; }
.kpi-amber   { background: rgba(245,158,11,0.12); color: #f59e0b; }
.kpi-red     { background: rgba(239,68,68,0.12); color: #ef4444; }
.kpi-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; }
.kpi-label { font-size: 0.75rem; color: var(--fg-muted); }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 10px 18px; text-align: left; }
.data-table thead th {
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--fg-muted); border-bottom: 1px solid var(--border);
}
.data-table tbody tr { border-bottom: 1px solid var(--border); }
.data-table tbody tr:last-child { border-bottom: none; }
.data-table tbody tr:hover { background: rgba(255,255,255,0.025); }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; }
.badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-danger  { background: rgba(239,68,68,0.15);  color: #ef4444; }

.kpi-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1px; background: var(--border); }
.kpi-row { background: var(--card); padding: 10px 14px; }
.kpi-row-value { font-family: monospace; font-size: 1rem; color: var(--primary); margin-top: 2px; }

.btn-secondary {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; cursor: pointer; color: var(--fg);
  display: inline-flex; align-items: center; gap: 6px;
}
</style>
