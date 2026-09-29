<template>
  <!--
    Routing control for an un-routed upload (template-late intake). Shows
    the file's detected headers and a server-ranked list of candidate
    feeds; the human picks one, nothing is auto-applied. See
    apps/integrations/views.py::DataUploadRouteView.
  -->
  <div class="route-panel">
    <header class="route-panel-head">
      <div>
        <SectionTitle>Assign a template</SectionTitle>
        <p class="route-panel-lead">
          This file is in the routing queue. No feed has been matched to its
          format yet. Pick the feed whose template it should be validated
          against. Nothing is written until you review the result.
        </p>
      </div>
    </header>

    <div v-if="error" class="route-panel-banner route-panel-banner--error">⚠ {{ error }}</div>

    <!-- ── The file's columns ─────────────────────────────────────────── -->
    <section class="route-panel-section">
      <div class="route-panel-section-label">
        Detected columns
        <span v-if="headers.length" class="route-panel-count">{{ headers.length }}</span>
      </div>
      <div v-if="headers.length" class="route-panel-chips">
        <span v-for="h in headers" :key="h" class="route-panel-chip">{{ h || '-' }}</span>
      </div>
      <p v-else class="route-panel-muted">
        No header row could be read from this file. You can still route it, but
        it may fail validation once a template is applied.
      </p>
    </section>

    <!-- ── Candidate feeds ────────────────────────────────────────────── -->
    <section class="route-panel-section">
      <div class="route-panel-section-label">Feeds for {{ agencyLabel }}</div>

      <EmptyState
        v-if="loading" loading compact
      />
      <EmptyState
        v-else-if="!candidates.length" compact icon="inbox"
        message="No templated feeds are registered for your agency yet. Routing this file is a code change: a template has to be added first."
      />
      <ul v-else class="route-panel-options" role="radiogroup" aria-label="Candidate feeds">
        <li v-for="c in candidates" :key="c.source_id">
          <button
            type="button" class="route-option" role="radio"
            :class="{ selected: picked === c.source_id }" :aria-checked="picked === c.source_id"
            @click="picked = c.source_id"
          >
            <span class="route-option-radio" aria-hidden="true" />
            <span class="route-option-body">
              <span class="route-option-top">
                <span class="route-option-id mono-sm">{{ c.source_id }}</span>
                <span class="route-option-sys">{{ c.system_source }}</span>
              </span>
              <span class="route-option-meta">
                template {{ c.schema_version }}
                <template v-if="c.expected_columns">
                  · <span :class="matchClass(c)">{{ c.matched_columns }}/{{ c.expected_columns }} columns line up</span>
                </template>
              </span>
              <span v-if="c.expected_columns" class="route-option-meter" aria-hidden="true">
                <span class="route-option-meter-fill" :class="matchClass(c)" :style="{ transform: `scaleX(${matchPct(c) / 100})` }" />
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <footer class="route-panel-foot">
      <span class="route-panel-muted">
        <template v-if="picked">Validates against <strong>{{ picked }}</strong>. You review before any commit.</template>
        <template v-else>Choose a feed to continue.</template>
      </span>
      <button
        class="btn btn-primary" :disabled="!picked || routing"
        @click="submit"
      >{{ routing ? 'Routing…' : 'Route this file →' }}</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useIntegrations } from '~/composables/api'
import type { RouteCandidate } from '~/composables/api'

const props = defineProps<{
  uploadId: string
  /** Falls back to the routeInfo response if not supplied by the parent. */
  detectedHeaders?: string[]
  agencyCode?: string
}>()
const emit = defineEmits<{ routed: [] }>()

const api = useIntegrations()

const loading = ref(true)
const error = ref<string | null>(null)
const routing = ref(false)
const candidates = ref<RouteCandidate[]>([])
const fetchedHeaders = ref<string[]>([])
const picked = ref<string>('')

const headers = computed(() => props.detectedHeaders?.length ? props.detectedHeaders : fetchedHeaders.value)
const agencyLabel = computed(() => props.agencyCode || candidates.value[0]?.agency_code || 'your agency')

function matchPct(c: RouteCandidate): number {
  if (!c.expected_columns) return 0
  return Math.round((c.matched_columns / c.expected_columns) * 100)
}
function matchClass(c: RouteCandidate): string {
  const p = matchPct(c)
  return p >= 80 ? 'is-strong' : p >= 40 ? 'is-partial' : 'is-weak'
}

async function load() {
  loading.value = true
  try {
    const info = await api.uploads.routeInfo(props.uploadId)
    candidates.value = info.candidates
    fetchedHeaders.value = info.detected_headers
    // Pre-select the top candidate only when it's an unambiguous winner -
    // a clear column-overlap lead over the next one. Never when it's a
    // toss-up; the point is a deliberate human choice.
    const [first, second] = info.candidates
    if (first && (!second || first.matched_columns > second.matched_columns)) {
      picked.value = first.source_id
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load routing options.'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!picked.value) return
  routing.value = true
  error.value = null
  try {
    await api.uploads.route(props.uploadId, picked.value)
    emit('routed')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not route this file.'
  } finally {
    routing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.route-panel {
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  box-shadow: var(--elev-1); overflow: hidden;
}
.route-panel-head { padding: 18px 20px 6px; }
.route-panel-lead { font-size: 12.5px; color: var(--fg-2); line-height: 1.55; margin: 8px 0 0; max-width: 68ch; }

.route-panel-banner { margin: 0 20px; border-radius: var(--r-sm); padding: 9px 12px; font-size: 12px; }
.route-panel-banner--error { background: var(--danger-bg); border: 1px solid var(--danger-fg); color: var(--danger-fg); }

.route-panel-section { padding: 14px 20px; border-top: 1px solid var(--border-subtle); }
.route-panel-section:first-of-type { border-top: none; }
.route-panel-section-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  color: var(--fg-3); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}
.route-panel-count {
  font-size: 10.5px; font-weight: 700; background: var(--surface-sunken); color: var(--fg-2);
  border-radius: var(--r-pill); padding: 1px 7px;
}
.route-panel-muted { font-size: 12px; color: var(--fg-3); line-height: 1.5; }

.route-panel-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.route-panel-chip {
  font: 500 11.5px/1.4 var(--font-mono);
  background: var(--surface-quiet); border: 1px solid var(--border-subtle); border-radius: var(--r-xs);
  padding: 3px 8px; color: var(--fg-2); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.route-panel-options { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.route-option {
  width: 100%; display: flex; gap: 12px; align-items: flex-start; text-align: left;
  background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  padding: 12px 14px; cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-base) var(--ease-out);
}
.route-option:hover { border-color: var(--border-interactive); }
.route-option.selected { border-color: var(--primary); background: var(--info-bg); box-shadow: var(--elev-1); }
.route-option:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }

.route-option-radio {
  width: 16px; height: 16px; border-radius: var(--r-pill); border: 2px solid var(--border-interactive);
  flex-shrink: 0; margin-top: 2px; transition: border-color var(--dur-fast) var(--ease-standard);
}
.route-option.selected .route-option-radio { border-color: var(--primary); box-shadow: inset 0 0 0 3px var(--primary); }

.route-option-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
.route-option-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.route-option-id { font-size: 13px; font-weight: 700; color: var(--fg-1); }
.route-option-sys { font-size: 11.5px; color: var(--fg-3); }
.route-option-meta { font-size: 11.5px; color: var(--fg-3); }
.route-option-meta .is-strong { color: var(--success-fg); font-weight: 600; }
.route-option-meta .is-partial { color: var(--warning-fg); font-weight: 600; }
.route-option-meta .is-weak { color: var(--fg-3); }

.route-option-meter { display: block; height: 4px; border-radius: var(--r-pill); background: var(--surface-sunken); overflow: hidden; margin-top: 2px; }
.route-option-meter-fill {
  display: block; width: 100%; height: 100%; border-radius: var(--r-pill); background: var(--fg-3);
  transform-origin: left center; transition: transform var(--dur-slow) var(--ease-out);
}
.route-option-meter-fill.is-strong { background: var(--success-fg); }
.route-option-meter-fill.is-partial { background: var(--warning-fg); }

.route-panel-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 14px 20px; border-top: 1px solid var(--border-subtle); background: var(--surface-1);
}
.route-panel-foot .route-panel-muted { font-size: 12px; }
</style>
