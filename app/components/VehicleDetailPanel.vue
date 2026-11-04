<script setup lang="ts">
/**
 * VehicleDetailPanel - the drill-down under an opened Vehicle Registry row: the registry fields that do not fit the table,
 * plus this vehicle's latest inspections, route-adherence samples and behaviour events (loaded only while the row is open).
 */
import { ref, onMounted } from 'vue'
import { useApi } from '~/composables/api/_client'

const props = defineProps<{ vehicle: Record<string, any> }>()
const api = useApi()
const F = '/api/v1/fleet'
const loaded = ref(false)
const inspections = ref<any[]>([])
const adherence = ref<any[]>([])
const behaviour = ref<any[]>([])
const rows = (r: any): any[] => r?.results ?? []

onMounted(async () => {
  const id = props.vehicle.id
  const [i, a, b] = await Promise.all([
    api<any>(`${F}/vehicle-inspections/`, { query: { 'f.vehicle__exact': id, ordering: '-inspected_at', page_size: 10 } }).catch(() => null),
    api<any>(`${F}/route-adherence/`, { query: { 'f.vehicle__exact': id, page_size: 10 } }).catch(() => null),
    api<any>(`${F}/driver-behavior-events/`, { query: { 'f.vehicle__exact': id, page_size: 10 } }).catch(() => null),
  ])
  inspections.value = rows(i); adherence.value = rows(a); behaviour.value = rows(b)
  loaded.value = true
})

const num = (v: number | null | undefined) => (v == null ? '-' : Number(v).toLocaleString())
const fmtDate = (s?: string | null) => { if (!s) return '-'; try { return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return s } }
const RESULT = { pass: 'success', fail: 'danger', conditional_pass: 'warning', pending: 'neutral' } as Record<string, string>
const ADH = { on_route: 'success', deviation: 'warning', unknown: 'neutral' } as Record<string, string>
const SEV = { low: 'info', medium: 'warning', high: 'danger', critical: 'danger' } as Record<string, string>
const text = (s: unknown) => String(s ?? '').replace(/_/g, ' ')
</script>

<template>
  <div class="drilldown">
    <div class="dd-col">
      <div class="dd-title">Vehicle / Operator Link</div>
      <div class="dd-list">
        <div class="dd-item dd-item-block"><span class="k">Engine no.</span><span>{{ vehicle.engine_no || '-' }}</span></div>
        <div class="dd-item dd-item-block"><span class="k">Seating / Load</span><span>{{ vehicle.seating_capacity ?? '-' }} seats · {{ num(vehicle.load_capacity_kg) }} kg</span></div>
        <div class="dd-item dd-item-block"><span class="k">Operator / Agency</span><span>{{ vehicle.operator_name ?? '-' }} ({{ vehicle.agency_code ?? '-' }})</span></div>
        <div class="dd-item dd-item-block"><span class="k">Assigned route</span><span>{{ vehicle.route_name ?? 'Unassigned' }}</span></div>
        <div class="dd-item dd-item-block"><span class="k">Speed governor</span><span>{{ vehicle.has_speed_governor ? `Fitted · cap ${vehicle.speed_limit_kmh} km/h` : 'Not fitted' }}</span></div>
      </div>
    </div>
    <div class="dd-col">
      <div class="dd-title">Inspection History</div>
      <div v-if="inspections.length" class="dd-list">
        <div v-for="ins in inspections" :key="ins.id" class="dd-item">
          <BadgePill :variant="RESULT[ins.result] ?? 'neutral'">{{ ins.result }}</BadgePill>
          <span>{{ fmtDate(ins.inspected_at) }} · {{ ins.inspection_centre }}</span>
        </div>
      </div>
      <div v-else class="dd-empty">{{ loaded ? 'No inspection records available.' : 'Loading…' }}</div>
    </div>
    <div class="dd-col">
      <div class="dd-title">Route Adherence</div>
      <div v-if="adherence.length" class="dd-list">
        <div v-for="a in adherence" :key="a.id" class="dd-item">
          <BadgePill :variant="ADH[a.verdict] ?? 'neutral'">{{ text(a.verdict) }}</BadgePill>
          <span>{{ fmtDate(a.sampled_at) }} · {{ a.deviation_m != null ? a.deviation_m + 'm' : '-' }}</span>
        </div>
      </div>
      <div v-else class="dd-empty">{{ loaded ? 'No route-adherence records available.' : 'Loading…' }}</div>
    </div>
    <div class="dd-col">
      <div class="dd-title">Behaviour / Incident Events</div>
      <div v-if="behaviour.length" class="dd-list">
        <div v-for="b in behaviour" :key="b.id" class="dd-item">
          <BadgePill :variant="SEV[b.severity] ?? 'neutral'">{{ b.severity }}</BadgePill>
          <span>{{ text(b.event_type) }} · {{ fmtDate(b.detected_at) }}</span>
        </div>
      </div>
      <div v-else class="dd-empty">{{ loaded ? 'No behaviour events on file.' : 'Loading…' }}</div>
    </div>
  </div>
</template>

<style scoped>
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; padding:6px 4px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.k { color:var(--fg-3); }
.dd-empty { font-size:12px; color:var(--fg-3); }
</style>
