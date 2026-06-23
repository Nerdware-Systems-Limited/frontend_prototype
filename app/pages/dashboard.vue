<template>
  <div class="dashboard">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">Overview</div>
        <h1 class="text-display">Transport Command Centre</h1>
        <p class="text-sm text-fg-muted mt-1">Real-time monitoring · Kenya State Department for Transport</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary">
          <Download :size="13" /> Export
        </button>
        <button class="btn btn-primary" @click="reload">
          <RefreshCw :size="13" /> Refresh
        </button>
      </div>
    </div>

    <!-- Status Strip -->
    <div class="status-strip card">
      <div class="status-item">
        <span class="dot-live" />
        <span class="text-xs text-success">
          {{ health?.status === 'healthy' ? 'All Systems Operational'
            : health?.status === 'degraded' ? 'Degraded — some components in error'
            : health?.status === 'unhealthy' ? 'Unhealthy' : 'Status unknown' }}
        </span>
      </div>
      <div v-if="health?.components?.database" class="status-item">
        <span class="text-xs text-fg-dim">DB</span>
        <span class="badge" :class="health.components.database.status === 'ok' ? 'badge-success' : 'badge-danger'">
          {{ health.components.database.status }}
        </span>
      </div>
      <div v-if="health?.components?.redis_cache" class="status-item">
        <span class="text-xs text-fg-dim">Redis</span>
        <span class="badge" :class="health.components.redis_cache.status === 'ok' ? 'badge-success' : 'badge-danger'">
          {{ health.components.redis_cache.status }}
        </span>
      </div>
      <div v-if="health?.components?.mongodb" class="status-item">
        <span class="text-xs text-fg-dim">Mongo</span>
        <span class="badge" :class="health.components.mongodb.status === 'ok' ? 'badge-success' : 'badge-danger'">
          {{ health.components.mongodb.status }}
        </span>
      </div>
      <div class="status-item ml-auto text-xs text-fg-dim font-mono">
        Last sync: {{ syncTime }}
      </div>
    </div>

    <!-- KPI Grid — driven by /api/v1/health/ + /api/v1/accounts/* -->
    <div class="kpi-grid">
      <div v-for="kpi in kpis" :key="kpi.id" class="kpi-card card card-hover">
        <div class="kpi-top">
          <div class="kpi-icon" :class="`kpi-${kpi.color || 'primary'}`">
            <component :is="iconFor(kpi.id)" :size="16" />
          </div>
        </div>
        <div class="kpi-value">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
      </div>
      <div v-if="!kpis.length" class="kpi-card card">
        <div class="text-sm text-fg-muted">Loading dashboard…</div>
      </div>
    </div>

    <!-- Main Content Row -->
    <div class="main-row">
      <!-- Traffic Flow Chart (placeholder for M02 live feed) -->
      <div class="card chart-card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Traffic Flow</div>
            <div class="text-xs text-fg-muted">Vehicles per hour · Last 24h (mock — M02 live data not yet wired)</div>
          </div>
          <div class="flex gap-2">
            <button v-for="r in ['1H','6H','24H','7D']" :key="r"
              class="btn btn-ghost text-xs py-1 px-2"
              :class="{ 'bg-card-hover text-fg': r === selectedRange }"
              @click="selectedRange = r">{{ r }}</button>
          </div>
        </div>
        <div class="chart-area">
          <svg viewBox="0 0 600 160" class="chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path :d="chartPath" fill="url(#grad1)" />
            <path :d="chartLine" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
          </svg>
          <div class="chart-labels">
            <span v-for="lbl in chartLabels" :key="lbl" class="text-xs text-fg-dim font-mono">{{ lbl }}</span>
          </div>
        </div>
      </div>

      <!-- Live Incidents — backed by /api/v1/incidents/ when ready -->
      <div class="card incidents-card">
        <div class="card-header">
          <div class="text-subhead">Live Incidents</div>
          <span class="badge" :class="incidents.length ? 'badge-danger' : 'badge-neutral'">
            {{ incidents.length }} Active
          </span>
        </div>
        <div v-if="!incidents.length" class="card-body text-fg-muted text-sm">
          No live incidents. The M05 incident feed (<code>/api/v1/incidents/</code>) will populate this card once the backend ships it.
        </div>
        <div v-else class="incidents-list">
          <div v-for="inc in incidents" :key="inc.id" class="incident-row">
            <div class="incident-sev" :class="`sev-${inc.sev}`" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ inc.title }}</div>
              <div class="text-xs text-fg-muted">{{ inc.location }} · {{ inc.time }}</div>
            </div>
            <span class="badge" :class="`badge-${inc.sev === 'high' ? 'danger' : inc.sev === 'med' ? 'warning' : 'neutral'}`">
              {{ inc.sev }}
            </span>
          </div>
        </div>
        <NuxtLink to="/incidents" class="view-all-btn">
          View all incidents <ArrowRight :size="12" />
        </NuxtLink>
      </div>
    </div>

    <!-- Component Health — live from /api/v1/health/components -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="text-subhead">Component Health</div>
        <span class="text-xs text-fg-dim">{{ modules.length }} components monitored</span>
      </div>
      <div v-if="!modules.length" class="card">
        <div class="card-body text-fg-muted">Loading component health…</div>
      </div>
      <div v-else class="modules-grid">
        <div v-for="mod in modules" :key="mod.id" class="module-card card card-hover">
          <div class="flex items-start justify-between mb-3">
            <div class="module-icon">
              <component :is="iconFor(mod.id)" :size="18" />
            </div>
            <span class="badge" :class="mod.status === 'online' ? 'badge-success' : mod.status === 'degraded' ? 'badge-warning' : 'badge-danger'">
              {{ mod.status }}
            </span>
          </div>
          <div class="text-sm font-semibold">{{ mod.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, RefreshCw, ArrowRight, Activity, MapPin, Database, Server, Cpu, Wifi } from 'lucide-vue-next'
import { useDashboard, useDashboardSummary, useServiceHealth } from '~/composables/api'

definePageMeta({ layout: 'default' })

const syncTime = ref('')
const selectedRange = ref('24H')

const dash = useDashboard()
const { health, refresh: refreshHealth } = useServiceHealth()

// Canonical M01 summary — fetched at SSR time so the page renders with
// real data on first paint. The legacy `dash.summary()` is kept as a
// fallback when the canonical endpoint is unavailable.
const { data: canonical, refresh: refreshCanonical } = await useDashboardSummary()

const kpis    = ref<any[]>([])
const modules = ref<any[]>([])
const recent  = ref<any[]>([])

function applyCanonical() {
  if (!canonical.value) return
  kpis.value = canonical.value.kpis ?? []
  modules.value = canonical.value.modules ?? []
  recent.value = canonical.value.recent_activity ?? []
}

async function loadData() {
  applyCanonical()
  // If canonical returned nothing (auth or endpoint missing), fall back
  // to the legacy client-side aggregator.
  if (!kpis.value.length) {
    try {
      const summary = await dash.summary()
      kpis.value = summary.kpis
      if (!modules.value.length) modules.value = summary.modules
    } catch { /* graceful degrade */ }
  }
}

async function reload() {
  await Promise.all([
    refreshCanonical().then(applyCanonical).catch(() => {}),
    refreshHealth(true),
  ])
  if (!kpis.value.length) await loadData()
}

onMounted(async () => {
  const tick = () => { syncTime.value = new Date().toLocaleTimeString('en-KE', { hour12: false }) }
  tick()
  const t = setInterval(tick, 1000)
  onUnmounted(() => clearInterval(t))
  await loadData()
})

// ── Module / KPI → lucide icon mapping ──────────────────────────────────
const iconMap: Record<string, any> = {
  database: Database, redis_cache: Server, redis_channels: Wifi,
  mongodb: Database, gis_engine: MapPin, celery_workers: Cpu,
  websocket: Wifi, agencies: Building, users: Users, health: Server, uptime: Cpu,
  // Canonical M01 KPI ids
  vehicles: Truck, congestion: Activity, incidents_24h: ShieldAlert,
  integrations: Link2, notifications: Bell,
}
import { Building, Users, Truck, ShieldAlert, Link2, Bell } from 'lucide-vue-next'
function iconFor(id: string) { return iconMap[id] ?? Activity }

// ── Live incidents — empty until M05 ships; ref drives the empty-state copy.
const incidents = ref<any[]>([])

// ── Chart data — purely client-side preview until M02 live feed exists.
const chartData = [120,145,132,170,180,165,190,210,195,185,225,240,220,200,215,230,250,240,265,280,260,245,270,295]
const chartLabels = computed(() => {
  if (selectedRange.value === '1H') return Array.from({length:6},(_,i)=>`${60-i*10}m`)
  if (selectedRange.value === '6H') return Array.from({length:7},(_,i)=>`${(i)*1}h`)
  if (selectedRange.value === '24H') return ['00','04','08','12','16','20','24'].map(h=>`${h}:00`)
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
})

function buildPath(pts: number[], close = false) {
  const w = 600, h = 160, pad = 10
  const min = Math.min(...pts), max = Math.max(...pts)
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2)
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  return close ? `${line} L${x(pts.length-1)},${h} L${x(0)},${h} Z` : line
}
const chartLine = computed(() => buildPath(chartData))
const chartPath = computed(() => buildPath(chartData, true))
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.status-strip { display: flex; align-items: center; gap: 20px; padding: 12px 20px; flex-wrap: wrap; }
.status-item { display: flex; align-items: center; gap: 8px; }

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.kpi-card { padding: 18px; }
.kpi-top { display: flex; align-items: center; justify-content: flex-start; margin-bottom: 12px; }
.kpi-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.kpi-primary { background: rgba(59,130,246,0.12); color: #3b82f6; }
.kpi-cyan    { background: rgba(34,211,238,0.12); color: #22d3ee; }
.kpi-green   { background: rgba(16,185,129,0.12); color: #10b981; }
.kpi-amber   { background: rgba(245,158,11,0.12); color: #f59e0b; }
.kpi-red     { background: rgba(239,68,68,0.12); color: #ef4444; }
.kpi-purple  { background: rgba(168,85,247,0.12); color: #a855f7; }
.kpi-value { font-size: 1.625rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 2px; }
.kpi-label { font-size: 0.75rem; color: var(--fg-muted); }

.main-row { display: grid; grid-template-columns: 1fr 340px; gap: 14px; }
@media (max-width: 1100px) { .main-row { grid-template-columns: 1fr; } }

.card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.chart-card { display: flex; flex-direction: column; }
.chart-area { padding: 16px; flex: 1; }
.chart-svg { width: 100%; height: 150px; display: block; }
.chart-labels { display: flex; justify-content: space-between; margin-top: 6px; }

.incidents-card { display: flex; flex-direction: column; }
.incidents-list { display: flex; flex-direction: column; padding: 8px 0; }
.incident-row { display: flex; align-items: center; gap: 12px; padding: 10px 18px; transition: background 0.1s; }
.incident-row:hover { background: rgba(255,255,255,0.025); }
.incident-sev { width: 3px; height: 36px; border-radius: 2px; flex-shrink: 0; }
.sev-high { background: var(--danger); }
.sev-med  { background: var(--warning); }
.sev-low  { background: var(--fg-dim); }
.card-body { padding: 18px; }
.view-all-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 18px; border-top: 1px solid var(--border);
  font-size: 0.75rem; color: var(--primary);
  text-decoration: none; transition: background 0.15s;
}
.view-all-btn:hover { background: rgba(59,130,246,0.06); }

.modules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.module-card { padding: 16px; }
.module-icon { font-size: 24px; color: var(--fg-muted); }
</style>