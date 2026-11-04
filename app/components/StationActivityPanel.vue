<script setup lang="ts">
/**
 * StationActivityPanel - what opens under a station row: passenger activity and recent train occupancy at that station,
 * counted and averaged by the server (the page's period and county apply). Mounted only while the row is open.
 */
import { computed } from 'vue'
import { useServerCount } from '~/composables/useServerCount'

const props = defineProps<{ code: string; scope: Record<string, unknown> }>()
const RAIL = '/api/v1/railway'
const scope = () => props.scope
const boardings = useServerCount(`${RAIL}/tickets/`, () => ({ ...scope(), 'f.origin_code__exact': props.code }), { aggregate: ['sum:fare_kes'] })
const alightings = useServerCount(`${RAIL}/tickets/`, () => ({ ...scope(), 'f.destination_code__exact': props.code }), { aggregate: ['sum:fare_kes'] })
const ops = useServerCount(`${RAIL}/operations/`, () => ({ ...scope(), 'f.current_station_code__exact': props.code }), { aggregate: ['avg:occupancy_pct'] })

const fmt = (v: number | null) => (v === null ? '-' : v.toLocaleString())
const kes = (n: number | null) => (n === null ? '-' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : Math.round(n).toLocaleString())
const revenue = computed(() => {
  const a = boardings.sum('fare_kes'), b = alightings.sum('fare_kes')
  return boardings.count.value === null ? null : (a ?? 0) + (b ?? 0)
})
const occupancy = computed(() => ops.avg('occupancy_pct'))
</script>

<template>
  <div class="drilldown">
    <div class="dd-col">
      <div class="dd-title">Passenger Activity</div>
      <div class="dd-list">
        <div class="dd-item"><span class="k">Boardings (origin)</span><span>{{ fmt(boardings.count.value) }}</span></div>
        <div class="dd-item"><span class="k">Alightings (destination)</span><span>{{ fmt(alightings.count.value) }}</span></div>
        <div class="dd-item"><span class="k">Revenue</span><span>KES {{ kes(revenue) }}</span></div>
      </div>
    </div>
    <div class="dd-col">
      <div class="dd-title">Occupancy at Station</div>
      <div class="dd-list">
        <div class="dd-item"><span class="k">Avg occupancy</span><span>{{ occupancy != null ? occupancy.toFixed(0) + '%' : 'no operations' }}</span></div>
        <div class="dd-item"><span class="k">Operations observed</span><span>{{ fmt(ops.count.value) }}</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; padding:6px 4px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.k { color:var(--fg-3); }
</style>
