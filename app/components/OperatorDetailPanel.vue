<script setup lang="ts">
/**
 * OperatorDetailPanel - what the Operators table shows when a row is opened: that operator's routes, PSV licences,
 * service-quality history, complaints and route-compliance flags. It exists only while the row is open, and asks the
 * server for just this operator's few most relevant records (no page-sized fetches held for every row).
 */
import { ref, onMounted } from 'vue'
import { useApi } from '~/composables/api/_client'

const props = defineProps<{ sacco: string }>()
const api = useApi()
const PT = '/api/v1/public-transport'
const loading = ref(true)
const routes = ref<any[]>([])
const licences = ref<any[]>([])
const quality = ref<any[]>([])
const feedback = ref<any[]>([])
const compliance = ref<any[]>([])

const rows = (r: any): any[] => r?.results ?? []
onMounted(async () => {
  const bySacco = { 'f.sacco__exact': props.sacco }
  const [r, l, q, f] = await Promise.all([
    api<any>(`${PT}/routes/`, { query: { ...bySacco, page_size: 20, ordering: 'route_name' } }).catch(() => null),
    api<any>(`${PT}/psv-licenses/`, { query: { ...bySacco, page_size: 10, ordering: 'expiry_date' } }).catch(() => null),
    api<any>(`${PT}/service-quality/`, { query: { ...bySacco, page_size: 4, ordering: '-period_end' } }).catch(() => null),
    api<any>(`${PT}/feedback/`, { query: { ...bySacco, page_size: 8, ordering: '-submitted_at' } }).catch(() => null),
  ])
  routes.value = rows(r); licences.value = rows(l); quality.value = rows(q); feedback.value = rows(f)
  const ids = routes.value.map(x => x.id)
  if (ids.length) {
    const c = await api<any>(`${PT}/compliance/`, { query: { 'f.route__in': ids.join(','), page_size: 8, ordering: '-checked_at' } }).catch(() => null)
    compliance.value = rows(c)
  }
  loading.value = false
})

const fmtDate = (s?: string | null) => { if (!s) return '-'; try { return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return s } }
const badge = (s: string, m: Record<string, string>) => m[s] ?? 'neutral'
const STATUS = { active: 'success', expired: 'danger', suspended: 'warning', revoked: 'danger' }
const FB = { open: 'warning', investigating: 'info', resolved: 'success', closed: 'neutral' }
const CMP = { compliant: 'success', flagged: 'warning', violation: 'danger' }
</script>

<template>
  <div class="drilldown">
    <div v-if="loading" class="dd-empty">Loading…</div>
    <template v-else>
      <div class="dd-col">
        <div class="dd-title">Routes Served ({{ routes.length }})</div>
        <div v-if="routes.length" class="dd-list">
          <div v-for="r in routes" :key="r.id" class="dd-item">
            <span style="font-weight:600">{{ r.route_name }}</span>
            <BadgePill variant="info">{{ r.service_type }}</BadgePill>
            <span style="color:var(--fg-3)">{{ r.stop_count }} stops · KES {{ r.fare_kes }}</span>
          </div>
        </div>
        <div v-else class="dd-empty">No routes on file.</div>
      </div>
      <div class="dd-col">
        <div class="dd-title">PSV Licences ({{ licences.length }})</div>
        <div v-if="licences.length" class="dd-list">
          <div v-for="l in licences" :key="l.id" class="dd-item">
            <span style="font-family:monospace">{{ l.license_number }}</span>
            <BadgePill :variant="badge(l.status, STATUS)">{{ l.status }}</BadgePill>
            <span style="color:var(--fg-3)">exp {{ fmtDate(l.expiry_date) }} · GPS {{ Number(l.gps_compliance_pct).toFixed(0) }}%</span>
          </div>
        </div>
        <div v-else class="dd-empty">No PSV licences on file.</div>
      </div>
      <div class="dd-col">
        <div class="dd-title">Service Quality Components</div>
        <div v-if="quality.length" class="dd-list">
          <div v-for="q in quality" :key="q.id" class="dd-item dd-item-block">
            <span style="color:var(--fg-3)">{{ fmtDate(q.period_start) }} – {{ fmtDate(q.period_end) }}</span>
            <span>On-time {{ Number(q.on_time_pct).toFixed(0) }}% · Complaint rate {{ Number(q.complaint_rate).toFixed(2) }} · Vehicle age {{ Number(q.vehicle_age_score).toFixed(0) }} · Occupancy {{ Number(q.occupancy_score).toFixed(0) }}</span>
          </div>
        </div>
        <div v-else class="dd-empty">No service-quality records.</div>
      </div>
      <div class="dd-col">
        <div class="dd-title">Complaints / Feedback ({{ feedback.length }})</div>
        <div v-if="feedback.length" class="dd-list">
          <div v-for="f in feedback" :key="f.id" class="dd-item dd-item-block">
            <span><BadgePill :variant="badge(f.status, FB)">{{ f.status }}</BadgePill> {{ String(f.category).replace(/_/g, ' ') }} · {{ f.rating }}★</span>
            <span style="color:var(--fg-3)">{{ f.text || '(no comment)' }}</span>
          </div>
        </div>
        <div v-else class="dd-empty">No feedback on file.</div>
      </div>
      <div class="dd-col">
        <div class="dd-title">Enforcement / Compliance Flags</div>
        <div v-if="compliance.length" class="dd-list">
          <div v-for="c in compliance" :key="c.id" class="dd-item">
            <BadgePill :variant="badge(c.status, CMP)">{{ c.status }}</BadgePill>
            <span>{{ c.check_type }} · {{ c.route_name ?? c.route }}</span>
          </div>
        </div>
        <div v-else class="dd-empty">No compliance checks recorded.</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; padding:6px 4px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.dd-empty { font-size:12px; color:var(--fg-3); }
</style>
