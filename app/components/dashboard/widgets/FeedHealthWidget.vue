<template>
  <div class="feed-health">
    <EmptyState v-if="loading && !feeds.length" loading compact />
    <EmptyState v-else-if="error" compact :message="`Integration Hub unavailable - ${error}`" />
    <template v-else>
      <div class="fh-counts">
        <div v-for="s in STATES" :key="s.key" class="fh-count" :class="s.tone">
          <span class="fh-n">{{ counts[s.key] ?? 0 }}</span>
          <span class="fh-l">{{ s.label }}</span>
        </div>
      </div>
      <div class="fh-agencies" role="group" aria-label="Filter linked widgets by agency">
        <button
          v-for="a in agencies" :key="a.code" type="button" class="fh-agency"
          :class="[a.worst, { active: selected === a.code }]" :aria-pressed="selected === a.code"
          :title="`${a.code}: ${a.total} feed(s), worst status ${a.worst}`" @click="pick(a.code)"
        ><span class="fh-dot" aria-hidden="true" />{{ a.code }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useIntegrations } from '~/composables/api'
import type { WidgetInstance } from '~/types/dashboard'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { context, emit } = useWidgetFilters(() => props.instance.id)
const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))

const STATES = [
  { key: 'connected', label: 'Connected', tone: 'good' },
  { key: 'degraded', label: 'Degraded', tone: 'warn' },
  { key: 'disconnected', label: 'Offline', tone: 'crit' },
  { key: 'pending', label: 'Pending', tone: 'muted' },
] as const
const RANK: Record<string, number> = { disconnected: 3, degraded: 2, pending: 1, connected: 0 }

const feeds = ref<{ status: string; agency_code: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const agency = context.value.agency
    // The integrations list filters on `agency_code`; one agency at a time.
    const res = await useIntegrations().list({ page_size: 200, ...(typeof agency === 'string' && agency ? { agency_code: agency } : {}) })
    feeds.value = res.results ?? []
    error.value = null
  } catch (e) {
    const err = e as { data?: { detail?: string }; message?: string } | null
    error.value = err?.data?.detail || err?.message || 'request failed'
  } finally { loading.value = false }
}
watch(() => JSON.stringify(context.value), load, { immediate: true })
watch(tick, load)

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const f of feeds.value) c[f.status] = (c[f.status] ?? 0) + 1
  return c
})
const agencies = computed(() => {
  const m = new Map<string, { code: string; total: number; worst: string }>()
  for (const f of feeds.value) {
    const cur = m.get(f.agency_code) ?? { code: f.agency_code, total: 0, worst: 'connected' }
    cur.total++
    if ((RANK[f.status] ?? 0) > (RANK[cur.worst] ?? 0)) cur.worst = f.status
    m.set(f.agency_code, cur)
  }
  return [...m.values()].sort((a, b) => (RANK[b.worst] ?? 0) - (RANK[a.worst] ?? 0) || a.code.localeCompare(b.code))
})

const selected = ref<string | null>(null)
function pick(code: string) {
  selected.value = selected.value === code ? null : code
  emit('agency', selected.value)
}
</script>

<style scoped>
.feed-health { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.fh-counts { display: flex; gap: 20px; flex-wrap: wrap; }
.fh-count { display: flex; flex-direction: column; }
.fh-n { font-family: var(--font-mono); font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg-1); }
.fh-count.warn .fh-n { color: var(--warning-fg); }
.fh-count.crit .fh-n { color: var(--danger-fg); }
.fh-l { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-3); }
.fh-agencies { display: flex; flex-wrap: wrap; gap: 6px; }
.fh-agency {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; font-size: 10.5px; font-weight: 600; font-family: var(--font-mono);
  border: 1px solid var(--border-subtle); border-radius: var(--r-xs); background: var(--surface-1); color: var(--fg-2); cursor: pointer;
}
.fh-agency:hover { border-color: var(--border-interactive); }
.fh-agency.active { border-color: var(--primary); color: var(--primary); background: var(--primary-wash); }
.fh-agency:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.fh-dot { width: 6px; height: 6px; border-radius: var(--r-pill); background: var(--success); }
.fh-agency.degraded .fh-dot { background: var(--warning); }
.fh-agency.disconnected .fh-dot { background: var(--destructive); }
.fh-agency.pending .fh-dot { background: var(--fg-3); }
</style>
