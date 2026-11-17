<script setup lang="ts">
/** The follow-up re-inspections filed after one inspection. Mounted only while its table row is open, so it loads on demand. */
import { ref, onMounted } from 'vue'
import { useVehicleInspections } from '~/composables/api/useVehicleInspections'

const props = defineProps<{ inspection: string }>()
const rows = ref<any[]>([])
const loaded = ref(false)
onMounted(async () => {
  const res: any = await useVehicleInspections().reinspections(props.inspection).catch(() => null)
  rows.value = res ? (Array.isArray(res) ? res : res.results ?? []) : []
  loaded.value = true
})
const BADGE: Record<string, string> = { pass: 'success', fail: 'danger', conditional_pass: 'warning' }
const fmtDate = (s?: string | null) => { if (!s) return '-'; try { return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return s } }
</script>

<template>
  <div>
    <div class="dd-title">Re-inspection Chain</div>
    <div v-if="rows.length" class="dd-list">
      <div v-for="r in rows" :key="r.id" class="dd-item">
        <BadgePill :variant="BADGE[r.result] ?? 'neutral'">{{ String(r.result).replace(/_/g, ' ') }}</BadgePill>
        <span>{{ fmtDate(r.inspected_at) }} · {{ r.inspection_centre }}</span>
      </div>
    </div>
    <div v-else class="dd-empty">{{ loaded ? 'No follow-up re-inspections on file.' : 'Loading…' }}</div>
  </div>
</template>

<style scoped>
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; }
.dd-empty { font-size:12px; color:var(--fg-3); }
</style>
