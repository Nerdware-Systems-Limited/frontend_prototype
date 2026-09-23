<template>
  <PageHeader
    eyebrow="Machine Learning · Predictive Intelligence"
    title="AI Predictive Workbench"
    subtitle="KeNHA · KURA · KMD · NTSA · NaMATA · KRC · KPA · KAA · KCAA - Forecasting, anomaly detection & what-if simulation across traffic, safety risk, infrastructure deterioration, and public transport demand"
  >
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Traffic Forecasts" :value="fmtNum(trafficForecasts.length)" :unavailable="loading || tfError" :unavailable-note="loading ? 'Loading…' : 'AI Model · NTSA feed unavailable'" period="24H" description="Predictive segments (24h)" to="#traffic-forecast-table" />
    <KpiCard label="Safety Hotspots" :value="fmtNum(safetyHotspots.length)" :unavailable="loading || shError" :unavailable-note="loading ? 'Loading…' : 'AI Model · NTSA feed unavailable'" period="LIVE" description="Predicted risk zones" to="#safety-hotspots-table" />
    <KpiCard label="At-Risk Road Segments" :value="fmtNum(atRiskSegments.length)" :unavailable="loading || arError" :unavailable-note="loading ? 'Loading…' : 'AI Model · KeNHA feed unavailable'" period="12MO" description="Deterioration forecast (12mo)" to="#deterioration-table" />
    <KpiCard label="PT Demand Forecasts" :value="fmtNum(demandForecasts.length)" :unavailable="loading || dfError" :unavailable-note="loading ? 'Loading…' : 'AI Model · NTSA feed unavailable'" period="24H" description="Route demand predictions" to="#pt-demand-table" />
    <KpiCard label="High-Severity Congestion" :value="fmtNum(heavyCongestion.length)" :unavailable="loading || tfError" :unavailable-note="loading ? 'Loading…' : 'AI Model · KeNHA feed unavailable'" period="24H" description="Predicted heavy/severe events" to="#traffic-forecast-table" />
    <KpiCard label="Critical Failure Risk" :value="fmtNum(criticalFailure.length)" :unavailable="loading || arError" :unavailable-note="loading ? 'Loading…' : 'AI Model · KeNHA feed unavailable'" period="12MO" description="Failure probability ≥ 70%" :status="loading || arError ? undefined : criticalFailure.length === 0 ? 'healthy' : 'critical'" to="#deterioration-table" />
  </div>

  <!-- ── Prediction Assistant ──────────────────────────────────────── -->
   <!-- ── Prediction Assistant ──────────────────────────────────────── -->
  <section class="chat-panel" aria-labelledby="pa-title">
    <div class="chat-panel-header">
      <SectionTitle id="pa-title" pill="Analyses loaded ML model forecasts">Prediction Assistant</SectionTitle>
      <div class="chat-header-actions">
        <button
          type="button"
          class="chat-clear-btn"
          :disabled="!hasConversation"
          title="Clear conversation"
          @click="clearChat"
        >Clear</button>
      </div>
    </div>
 
    <!-- Message thread -->
    <div
      ref="messagesEl"
      class="chat-messages"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Prediction Assistant conversation"
      tabindex="0"
      @scroll.passive="onThreadScroll"
    >
      <!-- Empty state: the four model domains ARE the entry points -->
      <div v-if="!hasConversation" class="pa-start">
        <p class="pa-start-lede">Ask about any forecast batch currently loaded on this page.</p>
 
        <ul class="pa-domains">
          <li v-for="d in DOMAINS" :key="d.key">
            <button
              type="button"
              class="pa-domain"
              :class="`pa-domain--${d.agency.toLowerCase()}`"
              :disabled="querying"
              @click="sendText(d.query)"
            >
              <span class="pa-domain-agency">{{ d.agency }}</span>
              <span class="pa-domain-title">{{ d.title }}</span>
              <span class="pa-domain-blurb">{{ d.blurb }}</span>
              <span class="pa-domain-count">{{ fmtNum(d.count.value) }} loaded</span>
            </button>
          </li>
        </ul>
 
        <p class="pa-start-note">
          Models are pre-production - predictions sharpen as training data accumulates.
        </p>
      </div>
 
      <!-- `thread` (not `messages`): columns and the row preview are derived
           once per message instead of once per cell on every render. -->
      <article
        v-for="msg in thread"
        :key="msg.id"
        class="chat-msg"
        :class="`chat-msg--${msg.role}`"
      >
        <!-- User turn -->
        <div v-if="msg.role === 'user'" class="pa-ask">{{ msg.content }}</div>
 
        <!-- Assistant turn: a readout, not a bubble - tables need the width -->
        <div v-else class="pa-answer" :class="{ 'pa-answer--error': msg.isError }">
          <div class="pa-answer-meta">
            <span v-if="msg.result" class="pa-source" :class="agencyClass(msg.result.source)">{{ msg.result.source }}</span>
            <span v-else-if="msg.isError" class="pa-source pa-source--error">Query failed</span>
            <span v-else class="pa-source pa-source--model">Loaded forecasts</span>
            <time class="pa-time" :datetime="msg.timestamp">{{ fmtMsgTime(msg.timestamp) }}</time>
          </div>
 
          <!-- Loading: says what it is doing, instead of three bouncing dots -->
          <div v-if="msg.loading" class="pa-loading">
            <span class="pa-loading-label">Querying forecast tables…</span>
            <span class="pa-loading-rule" aria-hidden="true"><i /></span>
          </div>
 
          <template v-else>
            <p class="pa-text">{{ msg.content }}</p>
 
            <!-- Result table -->
            <div v-if="msg.columns.length" class="result-wrap">
              <div class="result-header">
                <span class="result-count-badge">
                  <strong>{{ msg.preview.length }}</strong> of {{ msg.result!.total }} predictions
                </span>
                <button type="button" class="pa-copy" @click="copyRows(msg)">
                  {{ copiedId === msg.id ? 'Copied' : 'Copy as TSV' }}
                </button>
              </div>
 
              <div class="result-table-scroll" tabindex="0" role="region" aria-label="Prediction results">
                <table class="result-table">
                  <thead>
                    <tr>
                      <th v-for="col in msg.columns" :key="col" scope="col" :class="{ 'is-num': msg.numericCols[col] }">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in msg.preview" :key="ri">
                      <td
                        v-for="col in msg.columns"
                        :key="col"
                        class="result-cell"
                        :class="{ 'is-num': msg.numericCols[col] }"
                      >{{ formatCell(row[col]) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
 
              <p v-if="msg.hiddenCount" class="result-overflow">
                {{ fmtNum(msg.hiddenCount) }} more in the full tables below.
              </p>
            </div>
 
            <!-- Zero results: says what to do next -->
            <p v-else-if="msg.askedForRows" class="zero-result">
              No predictions matched. Try a wider risk tier, a different corridor, or drop the condition filter.
            </p>
          </template>
        </div>
      </article>
    </div>
 
    <!-- Only while the user has scrolled away from the newest turn -->
    <button v-if="hasConversation && !atBottom" type="button" class="pa-jump" @click="scrollToLatest">
      Jump to latest
    </button>
 
    <!-- Composer -->
    <div class="pa-composer">
      <!-- Chips move into the empty state before the first turn -->
      <div v-if="hasConversation" class="suggestion-row" role="group" aria-label="Common queries">
        <button
          v-for="s in SUGGESTIONS"
          :key="s.label"
          type="button"
          class="suggestion-chip"
          :disabled="querying"
          @click="sendText(s.query)"
        >{{ s.label }}</button>
      </div>
 
      <div class="chat-input-bar">
        <label class="pa-sr-only" for="pa-input">Ask about the loaded forecasts</label>
        <textarea
          id="pa-input"
          ref="inputEl"
          v-model="inputText"
          class="chat-input"
          rows="1"
          placeholder="Ask about traffic forecasts, safety hotspots, road deterioration, PT demand…"
          @input="autoGrow"
          @keydown.enter.exact.prevent="send"
        />
        <!-- While a query runs the button stops it, rather than sitting disabled -->
        <button v-if="querying" type="button" class="chat-send-btn chat-send-btn--stop" @click="stopQuery">Stop</button>
        <button v-else type="button" class="chat-send-btn" :disabled="!inputText.trim()" @click="send">Ask</button>
      </div>
    </div>
  </section>
  <!-- ── End Prediction Assistant ──────────────────────────────────── -->
  <!-- ── End NLP Assistant ─────────────────────────────────────────── -->

  <!-- ── Anomaly Detection Feed ─────────────────────────────────────── -->
  <SectionTitle pill="Isolation Forest · Live scan">Anomaly Detection Feed</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body scroll-body">
      <div v-if="anomalies.length">
        <AlertItem
          v-for="a in anomalies" :key="a.id"
          :severity="a.severity"
          :title="a.title"
          :meta="a.meta"
        />
      </div>
      <div v-else class="empty-row" style="padding:16px 0">
        {{ loading ? 'Scanning for anomalies…' : 'No statistically significant anomalies in the current forecast batch.' }}
      </div>
    </div>
  </div>

  <!-- ── What-If Scenario Modelling ─────────────────────────────────── -->
  <SectionTitle pill="Client-side projection">What-If Scenario Modelling</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <div class="scenario-controls">
        <label class="scenario-slider">
          <span class="slider-label">Traffic demand growth <strong>{{ trafficGrowthPct > 0 ? '+' : '' }}{{ trafficGrowthPct }}%</strong></span>
          <input type="range" min="-30" max="60" step="5" v-model.number="trafficGrowthPct" />
        </label>
        <label class="scenario-slider">
          <span class="slider-label">Infrastructure capacity change <strong>{{ capacityChangePct > 0 ? '+' : '' }}{{ capacityChangePct }}%</strong></span>
          <input type="range" min="-20" max="40" step="5" v-model.number="capacityChangePct" />
        </label>
        <label class="scenario-slider">
          <span class="slider-label">PT ridership / policy shift <strong>{{ demandGrowthPct > 0 ? '+' : '' }}{{ demandGrowthPct }}%</strong></span>
          <input type="range" min="-30" max="60" step="5" v-model.number="demandGrowthPct" />
        </label>
      </div>

      <div class="scenario-grid">
        <div class="scenario-item">
          <div class="scenario-label">Avg Traffic Volume</div>
          <div class="scenario-val" :class="scenario.volumeClass">{{ fmtNum(scenario.projectedVolume) }}</div>
          <div class="scenario-sub">Baseline {{ fmtNum(scenario.baselineVolume) }} · {{ trafficGrowthPct >= 0 ? '+' : '' }}{{ trafficGrowthPct }}%</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">Projected Congestion</div>
          <div class="scenario-val" :class="scenario.congestionClass">{{ scenario.congestionLabel }}</div>
          <div class="scenario-sub">Effective load vs capacity: {{ scenario.loadRatio.toFixed(2) }}×</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">PT Ridership Demand</div>
          <div class="scenario-val" :class="scenario.demandClass">{{ fmtNum(scenario.projectedDemand) }}</div>
          <div class="scenario-sub">Baseline {{ fmtNum(scenario.baselineDemand) }} · {{ demandGrowthPct >= 0 ? '+' : '' }}{{ demandGrowthPct }}%</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">Avg Safety Risk Score</div>
          <div class="scenario-val" :class="scenario.riskClass">{{ scenario.projectedRisk.toFixed(0) }}%</div>
          <div class="scenario-sub">Baseline {{ scenario.baselineRisk.toFixed(0) }}% · {{ scenario.riskDelta >= 0 ? '+' : '' }}{{ scenario.riskDelta.toFixed(0) }}pp</div>
        </div>
      </div>
      <div class="scenario-note">Heuristic projection from currently loaded forecasts, for directional planning discussion - not a calibrated simulation model.</div>
    </div>
  </div>

  <!-- Traffic forecast panel -->
  <SectionTitle pill="AI Model · KeNHA ATC · Next 24h">Traffic Forecasts</SectionTitle>
  <div id="traffic-forecast-table" class="card drill-target">
    <div class="card-body">
      <div class="model-legend">
        <span v-for="m in trafficModels" :key="m" class="model-chip">
          <span class="model-dot" :style="{ background: modelColor(m) }" />{{ m }}
        </span>
        <span class="model-legend-note">{{ trafficForecasts.length }} forecasts</span>
      </div>
      <table>
        <thead>
          <tr><th>Segment</th><th>Model</th><th>Target Time</th><th>Volume</th><th>Speed</th><th>Congestion</th><th>Horizon</th><th>Computed</th></tr>
        </thead>
        <tbody v-if="trafficForecasts.length">
          <tr v-for="f in trafficForecastsPageRows" :key="f.id">
            <td class="mono-cell">{{ f.segment_road_code ?? f.segment }}</td>
            <td>
              <span class="model-badge" :style="{ background: modelColor(f.model_name) + '1a', color: modelColor(f.model_name), borderColor: modelColor(f.model_name) + '44' }">
                {{ f.model_name }}
              </span>
            </td>
            <td class="ts-cell">{{ fmtTime(f.target_at) }}</td>
            <td class="num-bold">{{ fmtNum(f.predicted_volume) }}</td>
            <td class="num-cell">{{ f.predicted_speed_kmh.toFixed(0) }} km/h</td>
            <td><BadgePill :variant="congBadge(f.predicted_congestion)">{{ f.predicted_congestion.replace(/_/g,' ') }}</BadgePill></td>
            <td class="dim-cell">{{ f.horizon_hours }}h</td>
            <td class="dim-cell">{{ fmtTime(f.generated_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" class="empty-row">{{ loading ? 'Loading forecasts…' : 'No traffic forecast data.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="trafficForecastsPage" :total-pages="trafficForecastsTotalPages" :total="trafficForecastsTotal"
        @prev="trafficForecastsPrev" @next="trafficForecastsNext"
      />
    </div>
  </div>

  <!-- Safety hotspots + infrastructure deterioration -->
  <div class="two-col">
    <div id="safety-hotspots-table" class="card drill-target">
      <div class="card-header">Predictive Safety Hotspots<span class="card-header-meta">Risk Ranking · AI Model · NTSA</span></div>
      <div class="card-body">
        <table>
          <thead>
            <tr><th>Road Segment</th><th>Tier</th><th>Risk Score</th><th>Horizon</th><th>Factors</th></tr>
          </thead>
          <tbody v-if="safetyHotspots.length">
            <tr v-for="h in safetyHotspotsPageRows" :key="h.id">
              <td class="mono-cell">{{ h.segment_road_code ?? h.road_segment }}</td>
              <td><BadgePill :variant="riskBadge(h.risk_tier)">{{ h.risk_tier }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ transform: `scaleX(${(h.predicted_risk_score ?? 0) / 100})`, background: riskColor(h.risk_tier) }" />
                </div>
                <span class="score-label">{{ (h.predicted_risk_score ?? 0).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ h.horizon_days }}d</td>
              <td>
                <div class="factor-chips">
                  <span v-for="fc in toFactors(h.contributing_factors).slice(0, 3)" :key="fc" class="factor-chip">{{ fc.replace(/_/g,' ') }}</span>
                  <span v-if="!toFactors(h.contributing_factors).length" class="dim-cell">-</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No safety hotspot data.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="safetyHotspotsPage" :total-pages="safetyHotspotsTotalPages" :total="safetyHotspotsTotal"
          @prev="safetyHotspotsPrev" @next="safetyHotspotsNext"
        />
      </div>
    </div>

    <div id="deterioration-table" class="card drill-target">
      <div class="card-header">Road Deterioration Forecasts<span class="card-header-meta">At-Risk Segments · AI Model · KeNHA</span></div>
      <div class="card-body">
        <table>
          <thead>
            <tr><th>Road Code</th><th>Predicted Class</th><th>Failure Probability</th><th>Horizon</th><th>Computed</th></tr>
          </thead>
          <tbody v-if="atRiskSegments.length">
            <tr v-for="s in atRiskSegmentsPageRows" :key="s.id">
              <td class="mono-cell">{{ s.segment_road_code }}</td>
              <td><BadgePill :variant="condBadge(s.predicted_condition_class)">{{ (s.predicted_condition_class ?? '-').replace(/_/g,' ') }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ transform: `scaleX(${s.failure_probability ?? 0})`, background: (s.failure_probability ?? 0) >= 0.7 ? 'var(--destructive)' : (s.failure_probability ?? 0) >= 0.4 ? 'var(--warning)' : 'var(--success)' }" />
                </div>
                <span class="score-label">{{ ((s.failure_probability ?? 0) * 100).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ s.horizon_months }}mo</td>
              <td class="dim-cell">{{ s.computed_at ? fmtTime(s.computed_at) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No deterioration forecast data.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="atRiskSegmentsPage" :total-pages="atRiskSegmentsTotalPages" :total="atRiskSegmentsTotal"
          @prev="atRiskSegmentsPrev" @next="atRiskSegmentsNext"
        />
      </div>
    </div>
  </div>

  <!-- PT demand forecasts -->
  <SectionTitle pill="AI Model · NTSA · PT Demand">Public Transport Demand Forecasts</SectionTitle>
  <div id="pt-demand-table" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Route</th><th>Model</th><th>Version</th><th>Predicted Passengers</th><th>Confidence Range</th><th>Horizon</th><th>Computed</th></tr>
        </thead>
        <tbody v-if="demandForecasts.length">
          <tr v-for="f in demandForecastsPageRows" :key="f.id">
            <td class="num-bold">{{ f.route_name ?? f.route ?? '-' }}</td>
            <td><span class="model-badge" style="background:var(--info-bg);color:var(--info-fg);border-color:var(--info-fg)">{{ f.model_name }}</span></td>
            <td class="dim-cell">v{{ f.model_version }}</td>
            <td class="pax-big">{{ fmtNum(f.predicted_passengers) }}</td>
            <td class="conf-range">{{ fmtNum(f.lower_passengers) }} – {{ fmtNum(f.upper_passengers) }}</td>
            <td class="dim-cell">{{ f.horizon_hours }}h</td>
            <td class="ts-cell">{{ fmtTime(f.generated_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="7" class="empty-row">{{ loading ? 'Loading…' : 'No demand forecast data.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="demandForecastsPage" :total-pages="demandForecastsTotalPages" :total="demandForecastsTotal"
        @prev="demandForecastsPrev" @next="demandForecastsNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useTraffic, useSafety, useInfrastructure, usePublicTransport, useMlPredictive } from '~/composables/api'
import type { TrafficForecast, MLModelRegistryEntry } from '~/composables/api'
import type { Paged } from '~/types/uapts'

// ── Forecast data ──────────────────────────────────────────────────────

const trafficForecasts = ref<TrafficForecast[]>([])
const safetyHotspots   = ref<any[]>([])
const atRiskSegments   = ref<any[]>([])
const demandForecasts  = ref<any[]>([])
const modelRegistry    = ref<MLModelRegistryEntry[]>([])
const loading          = ref(true)
const error            = ref<string | null>(null)
const tfError = ref(false)
const shError = ref(false)
const arError = ref(false)
const dfError = ref(false)

// Multiple forecasting models (ARIMA/LSTM/Gradient Boost/TimesFM) now
// coexist in TrafficForecast/DemandForecast, so a single capped page can
// silently truncate to just one or two of them - e.g. page_size:24 over
// 160 traffic-forecast rows only shows whichever models happen to sort
// into the first page by target_at. Page through the *server's* max
// page_size (100) instead, so the client-side table pagination below
// (usePagination + TablePagination) works over the complete result set.
async function fetchAllPages<T>(fetchPage: (page: number) => Promise<Paged<T>>, maxPages = 20): Promise<T[]> {
  const first = await fetchPage(1)
  const results = [...(first.results ?? [])]
  const totalPages = first.total_pages ?? 1
  for (let page = 2; page <= Math.min(totalPages, maxPages); page++) {
    const next = await fetchPage(page)
    results.push(...(next.results ?? []))
  }
  return results
}

async function load() {
  loading.value = true
  error.value   = null

  const [tfRes, shRes, arRes, dfRes, mrRes] = await Promise.allSettled([
    fetchAllPages(page => useTraffic().forecasts({ page, page_size: 100 })),
    useSafety().hotspots({ page_size: 12 }),
    useInfrastructure().atRiskForecasts(),
    fetchAllPages(page => usePublicTransport().demandForecasts({ page, page_size: 100 })),
    useMlPredictive().models(),
  ])

  if (tfRes.status === 'fulfilled') trafficForecasts.value = tfRes.value
  if (shRes.status === 'fulfilled') safetyHotspots.value   = (shRes.value as any).results ?? []
  if (arRes.status === 'fulfilled') atRiskSegments.value   = (arRes.value as any).results ?? []
  if (dfRes.status === 'fulfilled') demandForecasts.value  = dfRes.value
  if (mrRes.status === 'fulfilled') modelRegistry.value    = mrRes.value

  tfError.value = tfRes.status === 'rejected'
  shError.value = shRes.status === 'rejected'
  arError.value = arRes.status === 'rejected'
  dfError.value = dfRes.status === 'rejected'

  if ([tfRes, shRes, arRes, dfRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Analytics API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const heavyCongestion = computed(() =>
  trafficForecasts.value.filter(f => f.predicted_congestion === 'heavy' || f.predicted_congestion === 'severe'),
)
const criticalFailure = computed(() =>
  atRiskSegments.value.filter(s => (s.failure_probability ?? 0) >= 0.7),
)
const trafficModels = computed(() => [...new Set(trafficForecasts.value.map(f => f.model_name))])

// ── Model status strip - driven by the real MLModelRegistry, not hardcoded ──
const avgModelLatencyMs = computed(() => {
  const vals = modelRegistry.value.map(m => m.avg_latency_ms).filter((v): v is number => v != null)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
})
const trafficAccuracyPct = computed(() =>
  modelRegistry.value.find(m => m.task_type === 'traffic_forecast')?.accuracy_pct ?? null,
)
const registryAlgorithms = computed(() => [...new Set(modelRegistry.value.map(m => m.algorithm))].join(' · '))
const registryFrameworks = computed(() => [...new Set(modelRegistry.value.map(m => m.framework))].join(' · '))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: trafficForecastsPageRows, page: trafficForecastsPage, totalPages: trafficForecastsTotalPages,
  total: trafficForecastsTotal, next: trafficForecastsNext, prev: trafficForecastsPrev,
} = usePagination(trafficForecasts, 15)

const {
  pageRows: safetyHotspotsPageRows, page: safetyHotspotsPage, totalPages: safetyHotspotsTotalPages,
  total: safetyHotspotsTotal, next: safetyHotspotsNext, prev: safetyHotspotsPrev,
} = usePagination(safetyHotspots, 15)

const {
  pageRows: atRiskSegmentsPageRows, page: atRiskSegmentsPage, totalPages: atRiskSegmentsTotalPages,
  total: atRiskSegmentsTotal, next: atRiskSegmentsNext, prev: atRiskSegmentsPrev,
} = usePagination(atRiskSegments, 15)

const {
  pageRows: demandForecastsPageRows, page: demandForecastsPage, totalPages: demandForecastsTotalPages,
  total: demandForecastsTotal, next: demandForecastsNext, prev: demandForecastsPrev,
} = usePagination(demandForecasts, 15)

// ── Anomaly Detection Feed ──────────────────────────────────────────────
// Isolation-Forest-style outlier scan (z-score threshold) over the forecast
// batches already loaded above - no separate anomaly API exists yet.

interface Anomaly {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  meta: string
}

function meanStd(vals: number[]) {
  if (!vals.length) return { mean: 0, std: 0 }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  return { mean, std: Math.sqrt(variance) }
}

const anomalies = computed<Anomaly[]>(() => {
  const out: Anomaly[] = []

  const { mean: volMean, std: volStd } = meanStd(trafficForecasts.value.map(f => f.predicted_volume))
  if (volStd > 0) {
    for (const f of trafficForecasts.value) {
      const z = (f.predicted_volume - volMean) / volStd
      if (z <= -1.75) out.push({
        id: `tv-${f.id}`,
        severity: z <= -2.5 ? 'critical' : 'warning',
        title: `Traffic Volume Drop · ${f.segment_road_code ?? f.segment}`,
        meta: `Predicted ${fmtNum(f.predicted_volume)} vs network avg ${fmtNum(volMean)} (z=${z.toFixed(1)}) - check for an unreported closure`,
      })
    }
  }

  const { mean: paxMean, std: paxStd } = meanStd(demandForecasts.value.map(f => f.predicted_passengers))
  if (paxStd > 0) {
    for (const f of demandForecasts.value) {
      const z = (f.predicted_passengers - paxMean) / paxStd
      if (z >= 1.75) out.push({
        id: `pt-${f.id}`,
        severity: z >= 2.5 ? 'critical' : 'warning',
        title: `Unusual Demand Spike · ${f.route_name ?? f.route ?? 'Unknown route'}`,
        meta: `Predicted ${fmtNum(f.predicted_passengers)} passengers vs network avg ${fmtNum(paxMean)} (z=${z.toFixed(1)})`,
      })
    }
  }

  const { mean: fpMean, std: fpStd } = meanStd(atRiskSegments.value.map(s => s.failure_probability ?? 0))
  if (fpStd > 0) {
    for (const s of atRiskSegments.value) {
      const fp = s.failure_probability ?? 0
      const z = (fp - fpMean) / fpStd
      if (z >= 1.75) out.push({
        id: `if-${s.id}`,
        severity: z >= 2.5 ? 'critical' : 'warning',
        title: `Failure Probability Spike · ${s.segment_road_code ?? 'Unknown segment'}`,
        meta: `${(fp * 100).toFixed(0)}% vs network avg ${(fpMean * 100).toFixed(0)}% (z=${z.toFixed(1)})`,
      })
    }
  }

  const order: Record<Anomaly['severity'], number> = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
})

// ── What-If Scenario Modelling ──────────────────────────────────────────
// Client-side heuristic projection driven by the sliders below - lets
// analysts sanity-check the directional impact of demand growth, capacity
// changes, or policy shocks against the currently loaded forecast baseline.

const trafficGrowthPct  = ref(0)
const capacityChangePct = ref(0)
const demandGrowthPct   = ref(0)

const scenario = computed(() => {
  const baselineVolume = trafficForecasts.value.length
    ? trafficForecasts.value.reduce((a, f) => a + f.predicted_volume, 0) / trafficForecasts.value.length
    : 0
  const baselineDemand = demandForecasts.value.length
    ? demandForecasts.value.reduce((a, f) => a + f.predicted_passengers, 0) / demandForecasts.value.length
    : 0
  const baselineRisk = safetyHotspots.value.length
    ? safetyHotspots.value.reduce((a, h) => a + (h.predicted_risk_score ?? 0), 0) / safetyHotspots.value.length
    : 0

  const projectedVolume = baselineVolume * (1 + trafficGrowthPct.value / 100)
  const projectedDemand = baselineDemand * (1 + demandGrowthPct.value / 100)

  const capacityFactor = 1 + capacityChangePct.value / 100
  const loadRatio = capacityFactor > 0 ? (1 + trafficGrowthPct.value / 100) / capacityFactor : Infinity

  let congestionLabel = 'Free Flow'
  let congestionClass = 'good'
  if (loadRatio >= 1.3)       { congestionLabel = 'Severe';   congestionClass = 'crit' }
  else if (loadRatio >= 1.1)  { congestionLabel = 'Heavy';    congestionClass = 'warn' }
  else if (loadRatio >= 0.95) { congestionLabel = 'Moderate'; congestionClass = 'warn' }

  const riskDelta = (loadRatio - 1) * 40
  const projectedRisk = Math.min(100, Math.max(0, baselineRisk + riskDelta))

  return {
    baselineVolume, projectedVolume,
    baselineDemand, projectedDemand,
    baselineRisk, projectedRisk, riskDelta,
    loadRatio, congestionLabel, congestionClass,
    volumeClass: trafficGrowthPct.value > 0 ? 'warn' : trafficGrowthPct.value < 0 ? 'good' : '',
    demandClass: demandGrowthPct.value < 0 ? 'warn' : 'good',
    riskClass: riskDelta > 5 ? 'crit' : riskDelta > 0 ? 'warn' : 'good',
  }
})

// ── Prediction Assistant ───────────────────────────────────────────────
// Works entirely on forecast data already loaded from the ML model APIs.
// No additional API calls - pure client-side analysis of predictions.

// ── Prediction Assistant ───────────────────────────────────────────────
// Answers come from useMlPredictive().ask(); if that call fails for any
// reason the client-side analysePredictions() below takes over, exactly
// as before.
 
interface ChatResult {
  rows: Record<string, unknown>[]
  total: number
  source: string
}
 
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
  isError?: boolean
  result?: ChatResult | null
}
 
interface ThreadMessage extends ChatMessage {
  columns: string[]
  preview: Record<string, unknown>[]
  numericCols: Record<string, boolean>
  hiddenCount: number
  askedForRows: boolean
}
 
const PREVIEW_ROWS = 12
const NUMERIC_RE = /^-?[\d,]*\.?\d+\s*(%|km\/h|pp)?$/
 
const messages   = ref<ChatMessage[]>([])
const inputText  = ref('')
const querying   = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const inputEl    = ref<HTMLTextAreaElement | null>(null)
const atBottom   = ref(true)
const copiedId   = ref<string | null>(null)
 
const SUGGESTIONS = [
  { label: 'Worst congestion',      query: 'Show the worst traffic congestion forecasts' },
  { label: 'Critical safety zones', query: 'Which safety hotspots are critical risk?' },
  { label: 'Roads near failure',    query: 'Roads with highest failure probability' },
  { label: 'Top PT demand',         query: 'Highest passenger demand route forecasts' },
  { label: 'Forecast summary',      query: 'Give me an overview of all forecasts' },
  { label: 'Heavy traffic',         query: 'Show heavy and severe traffic segments' },
]
 
// The empty state replaces the old WELCOME message: same four capabilities,
// but each one runs the query instead of only describing it. Agency labels
// match the `source` string each branch of analysePredictions() returns.
const DOMAINS = [
  { key: 'traffic', agency: 'KeNHA', title: 'Traffic congestion', blurb: 'Volume, speed and congestion class by segment',  count: computed(() => trafficForecasts.value.length), query: 'Show the worst traffic congestion forecasts' },
  { key: 'safety',  agency: 'NTSA',  title: 'Safety hotspots',    blurb: 'Ranked risk tiers and contributing factors',      count: computed(() => safetyHotspots.value.length),   query: 'Which safety hotspots are critical risk?' },
  { key: 'infra',   agency: 'KeNHA', title: 'Road deterioration', blurb: 'Segments by predicted failure probability',       count: computed(() => atRiskSegments.value.length),   query: 'Roads with highest failure probability' },
  { key: 'pt',      agency: 'NTSA',  title: 'PT demand',          blurb: 'Projected passengers per route, with bounds',     count: computed(() => demandForecasts.value.length),  query: 'Highest passenger demand route forecasts' },
]
 
const hasConversation = computed(() => messages.value.length > 0)
 
// Derive table shape once per message. The old template called
// resultColumns(msg.result) inside BOTH v-for loops, so a 10 × 6 result
// rebuilt the column list 70 times per render - and again on every tick.
const thread = computed<ThreadMessage[]>(() =>
  messages.value.map((m) => {
    const rows = m.result?.rows ?? []
    const columns = rows.length ? Object.keys(rows[0]!) : []
    const preview = rows.slice(0, PREVIEW_ROWS)
    const numericCols: Record<string, boolean> = {}
    for (const col of columns) numericCols[col] = preview.every(r => isNumeric(r[col]))
    return {
      ...m,
      columns,
      preview,
      numericCols,
      // Counted against rows actually rendered. analysePredictions() caps
      // rows at 10 while `total` is the unclipped count, so the old
      // `total - 12` under-reported by 2 and the `total > 12` guard hid
      // the note entirely for totals of 11 or 12.
      hiddenCount: Math.max(0, (m.result?.total ?? rows.length) - preview.length),
      askedForRows: !!m.result,
    }
  }),
)
 
function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return true
  return typeof v === 'string' && v.trim() !== '' && NUMERIC_RE.test(v.trim())
}
 
function agencyClass(source = ''): string {
  if (/kenha/i.test(source)) return 'pa-source--kenha'
  if (/ntsa/i.test(source))  return 'pa-source--ntsa'
  return 'pa-source--model'
}

// ── Client-side fallback analysis ───────────────────────────────────────
// Used only when useMlPredictive().ask() throws (API unreachable). Answers
// purely from the forecast batches already loaded into this page's refs -
// no network call.
const CONGESTION_RANK: Record<string, number> = { free_flow: 0, moderate: 1, heavy: 2, severe: 3 }

function toChatResult(rows: Record<string, unknown>[], source: string): ChatResult {
  return { rows: rows.slice(0, 10), total: rows.length, source }
}

function analysePredictions(text: string): { text: string; result: ChatResult | null } {
  const q = text.toLowerCase()

  // Safety hotspots
  if (/safety|hotspot|risk/.test(q)) {
    if (!safetyHotspots.value.length)
      return { text: 'No safety hotspot forecasts are currently loaded on this page.', result: null }

    let rows = [...safetyHotspots.value]
    if (/critical|very.?high|worst/.test(q)) {
      const critical = rows.filter(h => h.risk_tier === 'very_high')
      if (critical.length) rows = critical
    }
    rows.sort((a, b) => (b.predicted_risk_score ?? 0) - (a.predicted_risk_score ?? 0))
    const top = rows[0]
    const mapped = rows.map(h => ({
      Segment: h.segment_road_code ?? h.road_segment ?? '-',
      Tier: (h.risk_tier ?? '-').replace(/_/g, ' '),
      'Risk Score': h.predicted_risk_score ?? 0,
      'Horizon (d)': h.horizon_days ?? '-',
      Factors: toFactors(h.contributing_factors).join(', ') || '-',
    }))
    return {
      text: `${rows.length} safety hotspot${rows.length === 1 ? '' : 's'} match. Highest risk: ${top.segment_road_code ?? top.road_segment ?? 'unknown segment'} at ${(top.predicted_risk_score ?? 0).toFixed(0)}% (${(top.risk_tier ?? '-').replace(/_/g, ' ')}).`,
      result: toChatResult(mapped, 'AI Model · NTSA'),
    }
  }

  // Road deterioration / failure probability
  if (/failure|deteriorat|condition|road/.test(q)) {
    if (!atRiskSegments.value.length)
      return { text: 'No road deterioration forecasts are currently loaded on this page.', result: null }

    const rows = [...atRiskSegments.value].sort((a, b) => (b.failure_probability ?? 0) - (a.failure_probability ?? 0))
    const top = rows[0]
    const mapped = rows.map(s => ({
      'Road Code': s.segment_road_code ?? '-',
      'Predicted Class': (s.predicted_condition_class ?? '-').replace(/_/g, ' '),
      'Failure Probability': `${((s.failure_probability ?? 0) * 100).toFixed(0)}%`,
      'Horizon (mo)': s.horizon_months ?? '-',
    }))
    return {
      text: `${rows.length} road segment${rows.length === 1 ? '' : 's'} ranked by failure probability. Highest risk: ${top.segment_road_code ?? 'unknown segment'} at ${((top.failure_probability ?? 0) * 100).toFixed(0)}% (${(top.predicted_condition_class ?? '-').replace(/_/g, ' ')}).`,
      result: toChatResult(mapped, 'AI Model · KeNHA'),
    }
  }

  // PT demand
  if (/demand|passenger|route|\bpt\b/.test(q)) {
    if (!demandForecasts.value.length)
      return { text: 'No PT demand forecasts are currently loaded on this page.', result: null }

    const rows = [...demandForecasts.value].sort((a, b) => (b.predicted_passengers ?? 0) - (a.predicted_passengers ?? 0))
    const top = rows[0]
    const mapped = rows.map(f => ({
      Route: f.route_name ?? f.route ?? '-',
      Model: f.model_name ?? '-',
      'Predicted Passengers': f.predicted_passengers ?? 0,
      'Confidence Range': `${fmtNum(f.lower_passengers)} – ${fmtNum(f.upper_passengers)}`,
      'Horizon (h)': f.horizon_hours ?? '-',
    }))
    return {
      text: `${rows.length} PT demand forecast${rows.length === 1 ? '' : 's'} ranked by predicted passengers. Highest: ${top.route_name ?? top.route ?? 'unknown route'} at ${fmtNum(top.predicted_passengers)} passengers.`,
      result: toChatResult(mapped, 'AI Model · NTSA'),
    }
  }

  // Traffic congestion - checked after the domains above so a stray "road"
  // in a deterioration query doesn't get pulled in here.
  if (/traffic|congestion|volume|speed|heavy|severe/.test(q)) {
    if (!trafficForecasts.value.length)
      return { text: 'No traffic forecasts are currently loaded on this page.', result: null }

    let rows = [...trafficForecasts.value]
    if (/heavy|severe/.test(q)) {
      rows = rows.filter(f => f.predicted_congestion === 'heavy' || f.predicted_congestion === 'severe')
      if (!rows.length)
        return { text: 'No segments are currently forecast at heavy or severe congestion.', result: null }
    }
    rows.sort((a, b) =>
      (CONGESTION_RANK[b.predicted_congestion] ?? 0) - (CONGESTION_RANK[a.predicted_congestion] ?? 0)
      || b.predicted_volume - a.predicted_volume,
    )
    const top = rows[0]!
    const mapped = rows.map(f => ({
      Segment: f.segment_road_code ?? f.segment,
      Model: f.model_name,
      'Target Time': fmtTime(f.target_at),
      Volume: f.predicted_volume,
      'Speed (km/h)': f.predicted_speed_kmh,
      Congestion: (f.predicted_congestion ?? '-').replace(/_/g, ' '),
      'Horizon (h)': f.horizon_hours,
    }))
    return {
      text: `${rows.length} traffic segment${rows.length === 1 ? '' : 's'} ranked by congestion severity. Worst: ${top.segment_road_code ?? top.segment} at ${(top.predicted_congestion ?? '-').replace(/_/g, ' ')} congestion (${fmtNum(top.predicted_volume)} vehicles).`,
      result: toChatResult(mapped, 'AI Model · KeNHA'),
    }
  }

  // Overview / summary across all domains
  if (/overview|summary|all forecast/.test(q)) {
    return {
      text: `Currently loaded: ${trafficForecasts.value.length} traffic forecasts, ${safetyHotspots.value.length} safety hotspots, ${atRiskSegments.value.length} at-risk road segments, ${demandForecasts.value.length} PT demand forecasts. ${heavyCongestion.value.length} segment${heavyCongestion.value.length === 1 ? '' : 's'} show heavy/severe congestion and ${criticalFailure.value.length} segment${criticalFailure.value.length === 1 ? '' : 's'} have failure probability ≥ 70%.`,
      result: null,
    }
  }

  return {
    text: 'The prediction API is unreachable, so this is a local read of the forecasts already loaded on this page. Try asking about traffic congestion, safety hotspots, road deterioration, or PT demand - e.g. "Show the worst traffic congestion forecasts".',
    result: null,
  }
}

// ── Send ──────────────────────────────────────────────────────────────
// requestSeq lets Stop discard an in-flight answer without the composable
// needing to support AbortController.
let requestSeq = 0
 
async function send() {
  const text = inputText.value.trim()
  if (!text || querying.value) return
  inputText.value = ''
  resetInputHeight()
 
  const seq = ++requestSeq
  const uid = `u-${Date.now()}`
  const bid = `b-${Date.now() + 1}`
 
  messages.value.push({ id: uid, role: 'user', content: text, timestamp: new Date().toISOString() })
  messages.value.push({ id: bid, role: 'assistant', content: '', timestamp: new Date().toISOString(), loading: true })
 
  atBottom.value = true
  await nextTick()
  scrollDown()
  querying.value = true
 
  let responseText: string
  let result: ChatResult | null
 
  try {
    const ask = await useMlPredictive().ask(text)
    responseText = ask.answer
    result = ask.rows.length
      ? { rows: ask.rows, total: ask.total, source: ask.source === 'openai' ? `OpenAI · ${ask.model_used}` : 'AI Model · Server Analysis' }
      : null
  } catch {
    await new Promise(r => setTimeout(r, 400))
    const local = analysePredictions(text)
    responseText = local.text
    result = local.result
  }
 
  if (seq !== requestSeq) return  // stopped or superseded - drop the stale answer
 
  replaceMsg(bid, { content: responseText, result: result ?? undefined })
  querying.value = false
 
  await scrollIfPinned()
  inputEl.value?.focus()
}
 
function sendText(query: string) {
  inputText.value = query
  send()
}
 
function stopQuery() {
  requestSeq++
  const last = messages.value[messages.value.length - 1]
  if (last?.loading) replaceMsg(last.id, { content: 'Query stopped.' })
  querying.value = false
  inputEl.value?.focus()
}
 
function replaceMsg(id: string, patch: Partial<ChatMessage>) {
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx !== -1) messages.value[idx] = { ...messages.value[idx]!, loading: false, ...patch }
}
 
function clearChat() {
  requestSeq++
  messages.value = []
  inputText.value = ''
  querying.value = false
  atBottom.value = true
  resetInputHeight()
}
 
// ── Scrolling ─────────────────────────────────────────────────────────
function onThreadScroll() {
  const el = messagesEl.value
  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 48
}
 
function scrollDown() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}
 
function scrollToLatest() {
  const el = messagesEl.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  atBottom.value = true
}
 
// Only follows the thread when the user is already at the bottom, so an
// arriving answer can't yank them off a table they are mid-read.
async function scrollIfPinned() {
  if (!atBottom.value) return
  await nextTick()
  scrollDown()
}
 
// ── Composer ──────────────────────────────────────────────────────────
function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 132)}px`
}
 
function resetInputHeight() {
  if (inputEl.value) inputEl.value.style.height = 'auto'
}
 
// ── Result helpers ────────────────────────────────────────────────────
async function copyRows(msg: ThreadMessage) {
  const rows = msg.result?.rows ?? []
  if (!rows.length) return
  const cols = Object.keys(rows[0]!)
  const tsv = [
    cols.join('\t'),
    ...rows.map(r => cols.map(c => formatCell(r[c])).join('\t')),
  ].join('\n')
  try {
    await navigator.clipboard.writeText(tsv)
    copiedId.value = msg.id
    setTimeout(() => { copiedId.value = null }, 1600)
  } catch { /* clipboard unavailable - no-op */ }
}
 
function formatCell(v: unknown): string {
  if (v == null) return '-'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return v.toLocaleString()
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      return new Date(s).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch {}
  }
  return s.length > 32 ? s.slice(0, 30) + '…' : s
}
 
function fmtMsgTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

// ── Existing helpers ──────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string | undefined) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function congBadge(s: string) {
  const m: Record<string,string> = { free_flow:'success', moderate:'fair', heavy:'warning', severe:'danger' }
  return m[s] ?? 'neutral'
}
function riskBadge(t: string) {
  const m: Record<string,string> = { very_high:'danger', high:'warning', medium:'fair', low:'success' }
  return m[t] ?? 'neutral'
}
function riskColor(t: string) {
  const m: Record<string,string> = { very_high:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#22c55e' }
  return m[t] ?? '#94a3b8'
}
function condBadge(c: string) {
  const m: Record<string,string> = { very_good:'success', good:'success', fair:'fair', poor:'warning', very_poor:'danger', under_con:'neutral' }
  return m[c] ?? 'neutral'
}
function modelColor(m: string) {
  const c: Record<string,string> = { arima:'#3b82f6', lstm:'#a855f7', gradient_boost:'#f59e0b', timesfm:'#22c55e' }
  return c[m] ?? '#64748b'
}
function toFactors(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) return v.split(',').map(s => s.trim())
  if (v && typeof v === 'object') return Object.keys(v as Record<string, unknown>)
  return []
}

</script>

<style scoped>

/* ── Model status strip ── */
.model-status-strip { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 16px; }
.ms-chip { font-size:11px; font-weight:500; color:var(--fg-2); background:var(--surface-1); border:1px solid var(--border-subtle); border-radius:20px; padding:5px 12px; }
.ms-chip strong { font-weight:800; color:var(--fg-1); }
.ms-target { color:var(--fg-3); }

/* ── Scenario / what-if simulator ── */
.scenario-controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:16px; }
.scenario-slider { display:flex; flex-direction:column; gap:6px; }
.slider-label { font-size:12px; color:var(--fg-2); }
.slider-label strong { color:var(--fg-1); font-variant-numeric:tabular-nums; }
.scenario-slider input[type="range"] { width:100%; accent-color:var(--primary-fill); }
.scenario-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:4px; }
@media(max-width:900px) { .scenario-grid { grid-template-columns:repeat(2,1fr); } }
.scenario-item { background:var(--surface-1); border:1px solid var(--border-subtle); border-radius:6px; padding:10px; }
.scenario-label { font-size:10px; font-weight:600; color:var(--fg-3); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
.scenario-val { font-size:16px; font-weight:600; margin-bottom:3px; color:var(--fg-2); }
.scenario-val.good { color:var(--success-fg); }
.scenario-val.warn { color:var(--warning-fg); }
.scenario-val.crit { color:var(--danger-fg); }
.scenario-sub { font-size:10px; color:var(--fg-3); line-height:1.4; }
.scenario-note { font-size:11px; color:var(--fg-3); margin-top:10px; font-style:italic; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.card-header-meta { font-size:11px; font-weight:400; color:var(--fg-3); margin-left:auto; }

/* ── NLP Chat Panel ── */
/* ── Prediction Assistant ──────────────────────────────────────────
   Every --pa-* colour resolves to the app's own theme tokens (not
   fixed hex) so the whole panel repaints correctly under
   [data-theme="dark"] instead of staying a light-only island.
   --pa-ntsa/--pa-kenha reuse the existing info/warning semantic
   pair rather than inventing new agency-specific hues.
──────────────────────────────────────────────────────────────────── */
.chat-panel {
  --pa-ink: var(--fg-1);
  --pa-ink-soft: var(--fg-2);
  --pa-mute: var(--fg-3);
  --pa-line: var(--border-subtle);
  --pa-line-soft: var(--surface-1);
  --pa-well: var(--surface-1);
  --pa-accent: var(--primary-fill);
  --pa-ntsa: var(--info-fg);
  --pa-kenha: var(--warning-fg);
  --pa-danger: var(--danger-fg);
  --pa-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  position: relative;
  background: var(--surface-2);
  border: 1px solid var(--pa-line);
  border-radius: 12px;
  margin-bottom: 24px;
  overflow: hidden;
}
 
.chat-panel :is(button, textarea):focus-visible {
  outline: 2px solid var(--pa-accent);
  outline-offset: 2px;
}
 
.pa-sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
 
.chat-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--pa-line);
}
.chat-header-actions { display: flex; align-items: center; gap: 8px; }
 
/* Was #10e83b neon on white - unreadable, and it out-shouted the Ask
   button. Destructive-ish action, so it stays quiet until hovered. */
.chat-clear-btn {
  font-size: 12px; font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--pa-line);
  background: transparent;
  color: var(--pa-ink-soft);
  cursor: pointer;
  transition: color .15s, border-color .15s;
}
.chat-clear-btn:hover:not(:disabled) { color: var(--pa-ink); border-color: var(--pa-mute); }
.chat-clear-btn:disabled { opacity: .4; cursor: default; }
 
/* ── Thread ── */
.chat-messages {
  height: 340px;
  overflow-y: auto;
  padding: 16px;
  background: var(--pa-well);
  scroll-behavior: smooth;
}
 
.chat-msg { max-width: 1080px; margin: 0 auto 18px; }
.chat-msg:last-child { margin-bottom: 0; }
 
.chat-msg--user { display: flex; justify-content: flex-end; }
.pa-ask {
  max-width: 46ch;
  padding: 9px 13px;
  border-radius: 12px 12px 3px 12px;
  background: var(--pa-accent);
  color: #fff;
  font-size: 13px;
  line-height: 1.55;
}
 
/* Assistant replies are a readout, not a bubble - an 8-column table
   inside a 75%-width rounded bubble fights itself. */
.pa-answer { border-top: 1px solid var(--pa-line); padding-top: 10px; }
.pa-answer--error .pa-text { color: var(--pa-danger); }
 
.pa-answer-meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
 
.pa-source {
  font-family: var(--pa-mono);
  font-size: 10px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase;
  padding-left: 7px;
  border-left: 2px solid currentColor;
}
.pa-source--ntsa  { color: var(--pa-ntsa); }
.pa-source--kenha { color: var(--pa-kenha); }
.pa-source--model { color: var(--pa-mute); }
.pa-source--error { color: var(--pa-danger); }
 
.pa-time {
  font-family: var(--pa-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--pa-mute);
}
 
.pa-text {
  margin: 0;
  max-width: 78ch;
  font-size: 13px;
  line-height: 1.6;
  color: var(--pa-ink);
  white-space: pre-line;   /* analysePredictions() returns \n bullets */
}
 
/* ── Loading ── */
.pa-loading { display: flex; flex-direction: column; gap: 7px; }
.pa-loading-label { font-size: 12px; color: var(--pa-ink-soft); }
.pa-loading-rule { display: block; height: 2px; background: var(--pa-line); overflow: hidden; }
.pa-loading-rule i {
  display: block; width: 33%; height: 100%;
  background: var(--pa-accent);
  animation: pa-sweep 1.1s ease-in-out infinite;
}
@keyframes pa-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
 
/* ── Results ── */
.result-wrap { margin-top: 12px; }
.result-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
 
.result-count-badge {
  font-family: var(--pa-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--pa-ink-soft);
}
.result-count-badge strong { color: var(--pa-ink); font-weight: 700; }
 
.pa-copy {
  font-size: 11px; font-weight: 500;
  color: var(--pa-ink-soft);
  background: none; border: 0; padding: 3px;
  cursor: pointer;
}
.pa-copy:hover { color: var(--pa-accent); }
 
.result-table-scroll {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--pa-line);
  border-radius: 6px;
  background: var(--surface-2);
}
 
.result-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; }
 
.result-table th {
  position: sticky; top: 0; z-index: 1;   /* header survived nothing before */
  padding: 6px 8px;
  text-align: left;
  font-family: var(--pa-mono);
  font-size: 10px; font-weight: 700;
  letter-spacing: .05em; text-transform: uppercase;
  color: var(--pa-ink-soft);
  background: var(--pa-line-soft);
  border-bottom: 1px solid var(--pa-line);
  white-space: nowrap;
}
 
.result-cell {
  padding: 5px 8px;
  color: var(--pa-ink);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden; text-overflow: ellipsis;
  border-bottom: 1px solid var(--pa-line);
}
.result-table tbody tr:last-child .result-cell { border-bottom: 0; }
.result-table tbody tr:hover .result-cell { background: var(--primary-wash); }
 
/* Numbers read as data, not prose */
.result-table .is-num {
  text-align: right;
  font-family: var(--pa-mono);
  font-variant-numeric: tabular-nums;
}
 
.result-overflow { margin: 6px 0 0; font-size: 11px; color: var(--pa-mute); }
.zero-result { margin: 8px 0 0; font-size: 12px; color: var(--pa-ink-soft); }
 
/* ── Empty state ── */
.pa-start { max-width: 1080px; margin: 0 auto; }
.pa-start-lede { margin: 0 0 12px; font-size: 14px; color: var(--pa-ink); }
 
.pa-domains {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}
 
.pa-domain {
  display: flex; flex-direction: column; gap: 4px;
  width: 100%; height: 100%;
  text-align: left;
  padding: 11px 13px;
  background: var(--surface-2);
  border: 1px solid var(--pa-line);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color .15s, transform .15s;
}
.pa-domain:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--pa-mute); }
.pa-domain:disabled { opacity: .5; cursor: default; }
/* Source is carried by the agency label's own colour, not a coloured
   border-left slab. */
.pa-domain--ntsa  .pa-domain-agency { color: var(--pa-ntsa); }
.pa-domain--kenha .pa-domain-agency { color: var(--pa-kenha); }

.pa-domain-agency { font-family: var(--pa-mono); font-size: 9px; font-weight: 700; letter-spacing: .1em; color: var(--pa-mute); }
.pa-domain-title  { font-size: 13px; font-weight: 700; color: var(--pa-ink); }
.pa-domain-blurb  { font-size: 11px; line-height: 1.45; color: var(--pa-ink-soft); }
.pa-domain-count  { margin-top: 2px; font-family: var(--pa-mono); font-size: 10px; font-variant-numeric: tabular-nums; color: var(--pa-mute); }
 
.pa-start-note {
  margin: 0;
  padding-top: 11px;
  border-top: 1px solid var(--pa-line);
  font-size: 11px;
  color: var(--pa-mute);
}
 
/* ── Jump to latest ── */
.pa-jump {
  position: absolute;
  left: 50%; bottom: 106px;
  transform: translateX(-50%);
  font-size: 12px; font-weight: 500;
  padding: 5px 13px;
  border-radius: 20px;
  border: 1px solid var(--pa-line);
  background: var(--surface-2);
  color: var(--pa-ink);
  box-shadow: var(--elev-2);
  cursor: pointer;
  z-index: 2;
}

/* ── Composer ── */
.pa-composer { border-top: 1px solid var(--pa-line); background: var(--surface-2); }
 
.suggestion-row {
  display: flex;
  gap: 6px;
  padding: 10px 16px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.suggestion-row::-webkit-scrollbar { display: none; }
 
.suggestion-chip {
  flex: 0 0 auto;
  font-size: 12px; font-weight: 500;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-interactive);
  background: var(--pa-well);
  color: var(--fg-2);
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.suggestion-chip:hover:not(:disabled) { background: var(--primary-wash); border-color: var(--primary); color: var(--primary); }
.suggestion-chip:disabled { opacity: .5; cursor: default; }

.chat-input-bar { display: flex; align-items: flex-end; gap: 8px; padding: 12px 16px; }

.chat-input {
  flex: 1;
  resize: none;
  min-height: 38px;
  max-height: 132px;
  padding: 9px 13px;
  border: 1px solid var(--border-interactive);
  border-radius: 8px;
  background: var(--surface-2);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--pa-ink);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.chat-input::placeholder { color: var(--pa-mute); }
.chat-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-wash); }

.chat-send-btn {
  flex: 0 0 auto;
  height: 38px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: var(--pa-accent);
  color: #fff;
  font-size: 13px; font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s;
}
.chat-send-btn:hover:not(:disabled) { background: var(--primary-dark); }
.chat-send-btn:disabled { background: var(--pa-line); color: var(--pa-mute); cursor: default; }
.chat-send-btn--stop { background: var(--primary-dark); }
.chat-send-btn--stop:hover { background: var(--primary-darker); }
 
@media (max-width: 640px) {
  .pa-domains { grid-template-columns: 1fr; }
  .pa-ask { max-width: 100%; }
}
 
@media (prefers-reduced-motion: reduce) {
  .chat-messages { scroll-behavior: auto; }
  .pa-loading-rule i { animation: none; width: 100%; opacity: .4; }
  .pa-domain, .pa-domain:hover { transition: none; transform: none; }
}

/* ── Existing table/model styles ── */
.model-legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.model-chip { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px; background:var(--surface-1); border:1px solid var(--border-subtle); color:var(--fg-2); }
.model-dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex-shrink:0; }
.model-legend-note { font-size:11px; color:var(--fg-3); margin-left:auto; }
.model-badge { font-size:11px; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid transparent; }
.score-bar-wrap { background:var(--surface-sunken); border-radius:5px; height:8px; overflow:hidden; margin-bottom:3px; min-width:80px; }
.score-bar { height:100%; width:100%; border-radius:5px; transform-origin:left; transition:transform .4s ease; }
.score-label { font-size:11px; color:var(--fg-3); font-weight:600; font-variant-numeric:tabular-nums; }
.factor-chips { display:flex; flex-wrap:wrap; gap:3px; max-width:180px; }
.factor-chip { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--surface-sunken); color:var(--fg-2); white-space:nowrap; font-weight:500; }
.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:var(--fg-1); }
.num-bold   { font-weight:700; color:var(--fg-1); }
.num-cell   { font-size:12px; color:var(--fg-2); }
.dim-cell   { font-size:11px; color:var(--fg-3); white-space:nowrap; }
.ts-cell    { font-size:11px; white-space:nowrap; color:var(--fg-3); }
.empty-row  { text-align:center; color:var(--fg-3); padding:16px; }
.pax-big    { font-size:15px; font-weight:800; color:var(--fg-1); font-variant-numeric:tabular-nums; }
.conf-range { font-size:12px; color:var(--fg-3); font-variant-numeric:tabular-nums; }
</style>
