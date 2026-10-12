<template>
  <!--
    CertificateExpiryPanel - which certificates and licences need renewing, most urgent first.

    Reads every certificate source the viewer may open (config/certificateSources.ts),
    classifies each by days left in East Africa Time, and shows:
      counters   expired / critical / expiring soon / upcoming  (click one to filter)
      filters    needs attention · expired · short-term · medium-term
      list       certificate, category, owner, expiry date, days left, status, view/renew link
    The windows come from a policy (default 14 / 30 / 90 days) that is stated on
    the panel, so nobody has to guess what "soon" means.
  -->
  <CollapsibleSection
    class="card cert-panel" default-open :title="title" :count="needAttention" :tone="headTone"
    :source="sourceNote" :storage-key="`certs:${storageKey}`"
  >
    <div class="card-body">
      <div class="cert-counters" role="group" aria-label="Certificates by status">
        <button
          v-for="c in COUNTERS" :key="c.status" type="button" class="cert-counter" :class="`cert-counter--${c.status}`"
          :aria-pressed="filter === c.filter" @click="setFilter(c.filter)"
        >
          <span class="cert-counter-n">{{ c.n() }}</span>
          <span class="cert-counter-l">{{ c.label }}</span>
        </button>
      </div>

      <div class="cert-filters">
        <div class="segmented" role="group" aria-label="Expiry window">
          <button v-for="f in FILTERS" :key="f.key" type="button" :class="{ active: filter === f.key }" :aria-pressed="filter === f.key" @click="setFilter(f.key)">
            {{ f.label }}
          </button>
        </div>
        <span class="cert-policy">{{ policyText }}</span>
      </div>

      <div v-if="failed.length" class="cert-note" role="status">
        Could not load: {{ failed.join(', ') }}. The rest is shown.
      </div>

      <div v-if="shown.length" class="table-scroll">
        <table class="cert-table">
          <thead>
            <tr>
              <th>Certificate</th><th>Owner</th><th>Expiry</th><th class="num">Days left</th><th>Status</th><th><span class="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in pageRows" :key="c.key">
              <td>
                <strong class="cert-name">{{ c.name }}</strong>
                <span class="cert-cat">{{ c.category }}</span>
              </td>
              <td>{{ c.owner ?? '-' }}</td>
              <td class="cert-date">{{ fmtDate(c.expiry) }}</td>
              <td class="num cert-days" :class="`cert-days--${c.status}`">{{ daysText(c) }}</td>
              <td><span class="badge" :class="STATUS_TONE[c.status]">{{ STATUS_LABEL[c.status] }}</span></td>
              <td class="cert-act">
                <NuxtLink v-if="c.route" :to="c.route" class="link-sm">{{ c.status === 'valid' ? 'View' : 'View / renew' }}<ArrowRight :size="12" aria-hidden="true" /></NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
        <TablePagination :page="page" :total-pages="totalPages" :total="total" @prev="prev" @next="next" />
      </div>
      <EmptyState
        v-else :loading="loading" compact
        :message="emptyMessage"
      />
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import {
  DEFAULT_CERT_POLICY, STATUS_LABEL, STATUS_TONE, filterCertificates, remainingText,
  type CertFilter, type CertificatePolicy, type CertificateView,
} from '~/utils/certificateExpiry'

const props = withDefaults(defineProps<{
  title?: string
  /** Only these certificate source ids (a module overview shows its own). Default: every source the viewer may open. */
  sources?: string[]
  policy?: CertificatePolicy
  /** Identifies this panel's open/closed state for the session. */
  storageKey?: string
}>(), { title: 'Certificate renewals', sources: undefined, policy: () => DEFAULT_CERT_POLICY, storageKey: 'default' })

const { all, counts, loading, loaded, failed, permitted, load } = useCertificateExpiry({ sources: props.sources, policy: props.policy })

const filter = ref<CertFilter>('all')
function setFilter(f: CertFilter) { filter.value = f }

const FILTERS: { key: CertFilter; label: string }[] = [
  { key: 'all', label: 'Needs attention' },
  { key: 'expired', label: 'Expired' },
  { key: 'short', label: 'Short-term' },
  { key: 'medium', label: 'Medium-term' },
]
const COUNTERS: { status: string; filter: CertFilter; label: string; n: () => number }[] = [
  { status: 'expired', filter: 'expired', label: 'Expired', n: () => counts.value.expired },
  { status: 'critical', filter: 'short', label: 'Critical', n: () => counts.value.critical },
  { status: 'soon', filter: 'short', label: 'Expiring soon', n: () => counts.value.soon },
  { status: 'upcoming', filter: 'medium', label: 'Upcoming', n: () => counts.value.upcoming },
]

const shown = computed<CertificateView[]>(() => filterCertificates(all.value, filter.value, props.policy))
const { pageRows, page, totalPages, total, next, prev } = usePagination(shown, 15)
watch(filter, () => { page.value = 1 })

const needAttention = computed(() => loaded.value ? counts.value.expired + counts.value.critical + counts.value.soon + counts.value.upcoming : null)
const headTone = computed(() => !loaded.value ? '' : counts.value.expired || counts.value.critical ? 'danger' : counts.value.soon ? 'warning' : counts.value.upcoming ? 'info' : 'success')
const sourceNote = computed(() => permitted.value.length ? `${permitted.value.length} source${permitted.value.length === 1 ? '' : 's'}` : '')

const policyText = computed(() => {
  const p = props.policy
  return `Critical within ${p.criticalDays} days · short-term within ${p.soonDays} · medium-term within ${p.upcomingDays}`
})
const emptyMessage = computed(() => {
  if (!permitted.value.length) return 'No certificate sources are available to your role.'
  switch (filter.value) {
    case 'expired': return 'No expired certificates.'
    case 'short': return `Nothing expires in the next ${props.policy.soonDays} days.`
    case 'medium': return `Nothing expires between ${props.policy.soonDays} and ${props.policy.upcomingDays} days from now.`
    default: return `Nothing is expired or expiring within ${props.policy.upcomingDays} days.`
  }
})

function fmtDate(s: string) {
  return new Date(`${s}T00:00:00Z`).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function daysText(c: CertificateView) { return remainingText(c.daysRemaining) }

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.cert-counters { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 12px; }
.cert-counter {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start; padding: 10px 12px; text-align: left; cursor: pointer;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); color: var(--fg-1);
}
.cert-counter:hover { background: var(--surface-quiet); }
.cert-counter:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.cert-counter-n { font: 700 20px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
.cert-counter-l { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg-2); }
/* Severity is a small dot beside the label (plus the word itself), not a coloured edge on the card. */
.cert-counter-l::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--fg-3); flex-shrink: 0; }
.cert-counter--expired .cert-counter-l::before, .cert-counter--critical .cert-counter-l::before { background: var(--danger-fg); }
.cert-counter--soon .cert-counter-l::before { background: var(--warning-fg); }
.cert-counter--upcoming .cert-counter-l::before { background: var(--info-fg); }
.cert-counter[aria-pressed="true"] { border-color: var(--primary); background: var(--surface-quiet); }
.cert-filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.cert-policy { font-size: 11px; color: var(--fg-3); }
.cert-note { font-size: 12px; color: var(--warning-fg); background: var(--warning-bg); border-radius: var(--r-sm); padding: 6px 10px; margin-bottom: 10px; }
.cert-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.cert-name { display: block; font-family: var(--font-mono); font-size: 12px; }
.cert-cat { display: block; font-size: 11px; color: var(--fg-3); }
.cert-date { white-space: nowrap; font-size: 12px; }
.cert-days { font-weight: 700; white-space: nowrap; }
.cert-days--expired, .cert-days--critical { color: var(--danger-fg); }
.cert-days--soon { color: var(--warning-fg); }
.cert-days--upcoming { color: var(--info-fg); }
.cert-act { text-align: right; white-space: nowrap; }
.link-sm { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--link); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
