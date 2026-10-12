<template>
  <!--
    HqSummary - the cross-module view for headquarters, below the national
    health ribbon on the Command Centre.

    The ribbon already carries the safety, fleet, rail, aviation, maritime and
    infrastructure headlines, so this adds what it does not:
      - live status of the remaining modules (traffic, public transport)
      - performance over the selected range (history, driven by the unified
        time-range control), kept visibly apart from live status
      - what needs attention: feeds that are down, figures past a threshold
      - certificate and licence renewals across every module the viewer can open
    Every block loads and fails on its own; none can blank the page. Only what
    the viewer's agency scope allows is fetched or shown.
  -->
  <section class="hq" aria-labelledby="hq-title">
    <div class="hq-bar">
      <div>
        <h2 id="hq-title" class="hq-title">Cross-module summary</h2>
        <p class="hq-dek">Live status, then performance over the range you choose</p>
      </div>
      <TimeRangeSelector :range="range" @change="loadHistory" />
    </div>

    <div v-if="issues.length" class="hq-issues" role="status" aria-label="Needs attention">
      <strong class="hq-issues-h"><AlertTriangle :size="14" aria-hidden="true" />Needs attention</strong>
      <ul>
        <li v-for="i in issues" :key="i.key" :class="`hq-issue--${i.tone}`">
          <NuxtLink :to="i.to">{{ i.text }}</NuxtLink>
        </li>
      </ul>
    </div>

    <template v-if="tiles.length">
      <SectionTitle pill="Live">Operational status</SectionTitle>
      <div class="hq-grid">
        <KpiCard
          v-for="t in tiles" :key="t.moduleId"
          :label="t.entry.label"
          :value="t.primary.value ?? '-'" :unit="t.primary.unit"
          :loading="t.loading"
          :unavailable="!t.loading && t.primary.value == null"
          :unavailable-reason="t.fetchFailed ? `${t.entry.label} feed unavailable` : 'No value reported'"
          :description="t.secondary.map(k => `${k.label}: ${k.value ?? '-'}`).join(' · ')"
          :class="{ 'hq-muted': t.scope === 'read' }"
          :period="t.entry.period" :to="t.entry.route"
        />
      </div>
    </template>

    <template v-if="metrics.length">
      <SectionTitle :pill="range.label.value">Performance over the range</SectionTitle>
      <div class="hq-grid">
        <KpiCard
          v-for="m in metrics" :key="m.def.id"
          :label="m.def.label" :value="m.text" :loading="m.loading"
          :unavailable="!m.loading && m.value == null"
          :unavailable-reason="m.failed ? `${m.def.label} feed unavailable` : 'No records in this range'"
          :description="m.description" :status="m.status"
          :period="range.period.value" :to="m.def.route"
        />
      </div>
    </template>

    <CertificateExpiryPanel title="Certificate &amp; licence renewals" storage-key="hq" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { HQ_METRICS, metricStatus, type HqMetric } from '~/config/hqPerformance'
import type { Status } from '~/utils/thresholds'

// The ribbon above this section already covers the other six modules.
const { tiles, load: loadTiles } = useModuleSummaries({ modules: ['M02', 'M04'] })
const { canAccessRoute } = useAccessControl()
const range = useTimeRange('hq', { default: '7d' })

interface MetricState {
  def: HqMetric
  loading: boolean
  failed: boolean
  value: number | null
  text: string
  description: string
  status: Status | undefined
}
const metrics = ref<MetricState[]>([])

function fmt(value: number | null, unit: 'pct' | 'kes' | 'count'): string {
  if (value == null) return '-'
  if (unit === 'pct') return `${value.toFixed(1)}%`
  if (unit === 'kes') return value >= 1_000_000 ? `KES ${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `KES ${(value / 1_000).toFixed(1)}k` : `KES ${Math.round(value).toLocaleString('en-KE')}`
  return Math.round(value).toLocaleString('en-KE')
}

async function loadHistory() {
  const allowed = HQ_METRICS.filter(m => canAccessRoute(m.route))
  const built: MetricState[] = allowed.map(def => ({ def, loading: true, failed: false, value: null, text: '-', description: '', status: undefined }))
  metrics.value = built
  // Written through the reactive array, never the raw objects (see useModuleSummaries).
  await Promise.allSettled(built.map(async (_, i) => {
    const m = metrics.value[i]!
    try {
      const r = await m.def.fetch(range.days.value)
      m.value = r.value
      m.text = fmt(r.value, r.unit)
      m.description = r.description
      m.status = metricStatus(r.value, r.threshold)
    } catch {
      m.failed = true
    } finally {
      m.loading = false
    }
  }))
}

onMounted(() => { loadTiles(); loadHistory() })

const issues = computed(() => {
  const out: { key: string; tone: 'danger' | 'warning'; text: string; to: string }[] = []
  for (const t of tiles.value) {
    if (t.fetchFailed) out.push({ key: `tile:${t.moduleId}`, tone: 'warning', text: `${t.entry.label}: live feed unavailable`, to: t.entry.route })
  }
  for (const m of metrics.value) {
    if (m.failed) out.push({ key: `fail:${m.def.id}`, tone: 'warning', text: `${m.def.label}: data unavailable for this range`, to: m.def.route })
    else if (m.status === 'critical') out.push({ key: `crit:${m.def.id}`, tone: 'danger', text: `${m.def.label} is critical: ${m.text} over ${range.label.value.toLowerCase()}`, to: m.def.route })
    else if (m.status === 'warning') out.push({ key: `warn:${m.def.id}`, tone: 'warning', text: `${m.def.label} is below target: ${m.text} over ${range.label.value.toLowerCase()}`, to: m.def.route })
  }
  return out
})
</script>

<style scoped>
.hq { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
.hq-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hq-title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.01em; color: var(--fg-1); }
.hq-dek { margin: 2px 0 0; font-size: 12px; color: var(--fg-3); }
.hq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.hq-muted { opacity: .7; }
.hq-issues { border: 1px solid var(--border-subtle); border-left: 3px solid var(--warning-fg); border-radius: var(--r-sm); background: var(--surface-1); padding: 10px 14px; }
.hq-issues-h { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-1); }
.hq-issues ul { margin: 6px 0 0; padding-left: 18px; font-size: 12px; }
.hq-issues li { margin: 2px 0; }
.hq-issues a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.hq-issue--danger { color: var(--danger-fg); }
.hq-issue--warning { color: var(--warning-fg); }
</style>
