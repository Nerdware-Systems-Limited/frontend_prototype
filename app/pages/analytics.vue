<template>
  <PageHeader
    eyebrow="Analytics & Predictive Intelligence"
    title="Analytics Workbench"
    subtitle="KeNHA · KURA · KMD · NTSA · NaMATA · KRC · KPA · KAA · KCAA - Multi-domain AI forecasts across traffic, safety risk, infrastructure deterioration, and public transport demand"
  >
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Traffic Forecasts"      :value="fmtNum(trafficForecasts.length)"  sub="Predictive segments (24h)"        source="batch" source-title="AI Model · NTSA" />
    <KpiCard label="Safety Hotspots"        :value="fmtNum(safetyHotspots.length)"    sub="Predicted risk zones"             source="batch" source-title="AI Model · NTSA" />
    <KpiCard label="At-Risk Road Segments"  :value="fmtNum(atRiskSegments.length)"    sub="Deterioration forecast (12mo)"    source="batch" source-title="AI Model · KeNHA" />
    <KpiCard label="PT Demand Forecasts"    :value="fmtNum(demandForecasts.length)"   sub="Route demand predictions"         source="batch" source-title="AI Model · NTSA" />
    <KpiCard label="High-Severity Congestion" :value="fmtNum(heavyCongestion.length)" sub="Predicted heavy/severe events"    source="batch" source-title="AI Model · KeNHA" />
    <KpiCard label="Critical Failure Risk"  :value="fmtNum(criticalFailure.length)"   sub="Failure probability ≥ 70%"        :trend-direction="criticalFailure.length === 0 ? 'up' : 'down'" source="batch" source-title="AI Model · KeNHA" />
  </div>

  <!-- ── Prediction Assistant ──────────────────────────────────────── -->
  <div class="chat-panel">
    <div class="chat-panel-header">
      <SectionTitle pill="Analyses loaded ML model forecasts">Prediction Assistant</SectionTitle>
      <div class="chat-header-actions">
        <button class="chat-clear-btn" @click="clearChat" title="Clear conversation">Clear</button>
      </div>
    </div>

    <!-- Message thread -->
    <div class="chat-messages" ref="messagesEl">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-msg"
        :class="`chat-msg--${msg.role}`"
      >
        <div class="chat-bubble" :class="{ 'chat-bubble--error': msg.isError }">

          <!-- Typing indicator -->
          <div v-if="msg.loading" class="typing-dots">
            <span /><span /><span />
          </div>

          <!-- Text content -->
          <div v-else class="chat-text">{{ msg.content }}</div>

          <!-- Source pill -->
          <div v-if="msg.result && !msg.loading" class="query-meta-pill">
            <span class="qm-dataset">{{ msg.result.source }}</span>
          </div>

          <!-- Result table -->
          <div v-if="msg.result && msg.result.rows && msg.result.rows.length" class="result-wrap">
            <div class="result-header">
              <span class="result-count-badge">{{ msg.result.rows.length }} of {{ msg.result.total }} predictions</span>
            </div>
            <div class="result-table-scroll">
              <table class="result-table">
                <thead>
                  <tr>
                    <th v-for="col in resultColumns(msg.result)" :key="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in msg.result.rows.slice(0, 12)" :key="ri">
                    <td v-for="col in resultColumns(msg.result)" :key="col" class="result-cell">
                      {{ formatCell(row[col]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="msg.result.total > 12" class="result-overflow">
              … {{ msg.result.total - 12 }} more predictions - see full tables below
            </div>
          </div>

          <!-- Zero results -->
          <div v-if="msg.result && (!msg.result.rows || !msg.result.rows.length) && !msg.loading" class="zero-result">
            No records matched those criteria.
          </div>

          <div class="msg-time">{{ fmtMsgTime(msg.timestamp) }}</div>
        </div>
      </div>
    </div>

    <!-- Quick suggestion chips -->
    <div class="suggestion-row">
      <button
        v-for="s in SUGGESTIONS"
        :key="s.label"
        class="suggestion-chip"
        :disabled="querying"
        @click="sendText(s.query)"
      >{{ s.label }}</button>
    </div>

    <!-- Input bar -->
    <div class="chat-input-bar">
      <input
        ref="inputEl"
        v-model="inputText"
        class="chat-input"
        placeholder="Ask about traffic forecasts, safety hotspots, road deterioration, PT demand…"
        :disabled="querying"
        @keyup.enter="send"
      />
      <button
        class="chat-send-btn"
        :disabled="!inputText.trim() || querying"
        @click="send"
      >
        <span v-if="querying" class="send-spinner" />
        <span v-else>Ask</span>
      </button>
    </div>
  </div>
  <!-- ── End NLP Assistant ─────────────────────────────────────────── -->

  <!-- Traffic forecast panel -->
  <SectionTitle pill="AI Model · KeNHA ATC · Next 24h">Traffic Forecasts</SectionTitle>
  <div class="card">
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
          <tr v-for="f in trafficForecasts.slice(0, 20)" :key="f.id">
            <td class="mono-cell">{{ f.segment }}</td>
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
            <td class="dim-cell">{{ fmtTime(f.computed_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" class="empty-row">{{ loading ? 'Loading forecasts…' : 'No traffic forecast data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Safety hotspots + infrastructure deterioration -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Predictive Safety Hotspots<span class="card-header-meta">Risk Ranking · AI Model · NTSA</span></div>
      <div class="card-body">
        <table>
          <thead>
            <tr><th>Road Segment</th><th>Tier</th><th>Risk Score</th><th>Horizon</th><th>Factors</th></tr>
          </thead>
          <tbody v-if="safetyHotspots.length">
            <tr v-for="h in safetyHotspots.slice(0, 10)" :key="h.id">
              <td class="mono-cell">{{ h.segment_road_code ?? h.road_segment }}</td>
              <td><BadgePill :variant="riskBadge(h.risk_tier)">{{ h.risk_tier }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${(h.predicted_risk_score ?? 0) * 100}%`, background: riskColor(h.risk_tier) }" />
                </div>
                <span class="score-label">{{ ((h.predicted_risk_score ?? 0) * 100).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ h.horizon_days }}d</td>
              <td>
                <div class="factor-chips">
                  <span v-for="fc in toFactors(h.contributing_factors).slice(0, 3)" :key="fc" class="factor-chip">{{ fc.replace(/_/g,' ') }}</span>
                  <span v-if="!h.contributing_factors?.length" class="dim-cell">-</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No safety hotspot data.' }}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Road Deterioration Forecasts<span class="card-header-meta">At-Risk Segments · AI Model · KeNHA</span></div>
      <div class="card-body">
        <table>
          <thead>
            <tr><th>Road Code</th><th>Predicted Class</th><th>Failure Probability</th><th>Horizon</th><th>Computed</th></tr>
          </thead>
          <tbody v-if="atRiskSegments.length">
            <tr v-for="s in atRiskSegments.slice(0, 10)" :key="s.id">
              <td class="mono-cell">{{ s.road_code ?? s.segment_road_code }}</td>
              <td><BadgePill :variant="condBadge(s.predicted_condition_class)">{{ (s.predicted_condition_class ?? '-').replace(/_/g,' ') }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${(s.failure_probability ?? 0) * 100}%`, background: (s.failure_probability ?? 0) >= 0.7 ? '#ef4444' : (s.failure_probability ?? 0) >= 0.4 ? '#f59e0b' : '#22c55e' }" />
                </div>
                <span class="score-label">{{ ((s.failure_probability ?? 0) * 100).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ s.horizon_months }}mo</td>
              <td class="dim-cell">{{ s.computed_at ? fmtTime(s.computed_at) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No deterioration forecast data.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- PT demand forecasts -->
  <SectionTitle pill="AI Model · NTSA · PT Demand">Public Transport Demand Forecasts</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Route</th><th>Model</th><th>Version</th><th>Predicted Passengers</th><th>Confidence Range</th><th>Horizon</th><th>Computed</th></tr>
        </thead>
        <tbody v-if="demandForecasts.length">
          <tr v-for="f in demandForecasts.slice(0, 15)" :key="f.id">
            <td class="num-bold">{{ f.route_name ?? f.route ?? '-' }}</td>
            <td><span class="model-badge" style="background:#818cf81a;color:#4f46e5;border-color:#818cf844">{{ f.model_name }}</span></td>
            <td class="dim-cell">v{{ f.model_version }}</td>
            <td class="pax-big">{{ fmtNum(f.predicted_passengers) }}</td>
            <td class="conf-range">{{ fmtNum(f.lower_passengers) }} – {{ fmtNum(f.upper_passengers) }}</td>
            <td class="dim-cell">{{ f.horizon_hours }}h</td>
            <td class="ts-cell">{{ fmtTime(f.computed_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="7" class="empty-row">{{ loading ? 'Loading…' : 'No demand forecast data.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Analytics')

import { useTraffic, useSafety, useInfrastructure, usePublicTransport } from '~/composables/api'
import type { TrafficForecast } from '~/composables/api'

// ── Forecast data ──────────────────────────────────────────────────────

const trafficForecasts = ref<TrafficForecast[]>([])
const safetyHotspots   = ref<any[]>([])
const atRiskSegments   = ref<any[]>([])
const demandForecasts  = ref<any[]>([])
const loading          = ref(true)
const error            = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value   = null

  const [tfRes, shRes, arRes, dfRes] = await Promise.allSettled([
    useTraffic().forecasts({ page_size: 24 }),
    useSafety().hotspots({ page_size: 12 }),
    useInfrastructure().atRiskForecasts(),
    usePublicTransport().demandForecasts({ page_size: 15 }),
  ])

  if (tfRes.status === 'fulfilled') trafficForecasts.value = (tfRes.value as any).results ?? []
  if (shRes.status === 'fulfilled') safetyHotspots.value   = (shRes.value as any).results ?? []
  if (arRes.status === 'fulfilled') atRiskSegments.value   = (arRes.value as any).results ?? []
  if (dfRes.status === 'fulfilled') demandForecasts.value  = (dfRes.value as any).results ?? []

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

// ── Prediction Assistant ───────────────────────────────────────────────
// Works entirely on forecast data already loaded from the ML model APIs.
// No additional API calls - pure client-side analysis of predictions.

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

const messages  = ref<ChatMessage[]>([])
const inputText = ref('')
const querying  = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const inputEl    = ref<HTMLInputElement | null>(null)

const SUGGESTIONS = [
  { label: 'Worst congestion',      query: 'Show the worst traffic congestion forecasts' },
  { label: 'Critical safety zones', query: 'Which safety hotspots are critical risk?' },
  { label: 'Roads near failure',    query: 'Roads with highest failure probability' },
  { label: 'Top PT demand',         query: 'Highest passenger demand route forecasts' },
  { label: 'Forecast summary',      query: 'Give me an overview of all forecasts' },
  { label: 'Heavy traffic',         query: 'Show heavy and severe traffic segments' },
]

const WELCOME = `Hello! I analyse UAPTS transport predictions from our ML forecast models.\n\nI can summarise and filter:\n• Traffic congestion forecasts (NTSA)\n• Safety hotspot risk rankings (NTSA)\n• Road deterioration predictions (KeNHA)\n• Public transport demand forecasts (NTSA)\n\nNote: models are in pre-production - predictions will improve as training data accumulates.`

function initChat() {
  messages.value = [{
    id: 'welcome',
    role: 'assistant',
    content: WELCOME,
    timestamp: new Date().toISOString(),
  }]
}

// ── Local prediction analyser ─────────────────────────────────────────
// Interprets natural language and computes answers from in-memory data.

interface AnalysisResult {
  text: string
  result: ChatResult | null
}

function analysePredictions(input: string): AnalysisResult {
  const t = input.toLowerCase()

  const isTraffic  = /\b(traffic|congest|volume|speed|flow|jam|gridlock|road speed)\b/.test(t)
  const isSafety   = /\b(safety|hotspot|risk|danger|blackspot|accident|crash|hazard)\b/.test(t)
  const isInfra    = /\b(road|deteriorat|failure|infrastructure|maintenance|pavement|pothole|bridge)\b/.test(t)
  const isPT       = /\b(transport|bus|route|passenger|demand|matatu|sacco|public transit|pt)\b/.test(t)
  const isSummary  = /\b(summary|overview|all|everything|status|report|total)\b/.test(t)

  // ── Summary ──────────────────────────────────────────────────────────
  if (isSummary || (!isTraffic && !isSafety && !isInfra && !isPT)) {
    const criticalHotspots = safetyHotspots.value.filter(h => h.risk_tier === 'critical').length
    const topRoute = [...demandForecasts.value].sort((a, b) => b.predicted_passengers - a.predicted_passengers)[0]
    return {
      text: [
        'ML forecast snapshot (pre-production models):',
        `• Traffic: ${trafficForecasts.value.length} segments · ${heavyCongestion.value.length} heavy/severe congestion`,
        `• Safety: ${safetyHotspots.value.length} hotspots · ${criticalHotspots} at critical risk`,
        `• Roads: ${atRiskSegments.value.length} at-risk segments · ${criticalFailure.value.length} critical failure probability`,
        `• PT Demand: ${demandForecasts.value.length} routes · highest demand on ${topRoute?.route_name ?? topRoute?.route ?? 'N/A'}`,
      ].join('\n'),
      result: null,
    }
  }

  // ── Traffic forecasts ─────────────────────────────────────────────────
  if (isTraffic) {
    let data = [...trafficForecasts.value]
    let filterDesc = ''

    if (/\b(heavy|severe|worst|bad|congest|jam|gridlock)\b/.test(t)) {
      data = data.filter(f => f.predicted_congestion === 'heavy' || f.predicted_congestion === 'severe')
      filterDesc = 'heavy or severe congestion'
    } else if (/\b(free.?flow|clear|light|good)\b/.test(t)) {
      data = data.filter(f => f.predicted_congestion === 'free_flow')
      filterDesc = 'free-flow'
    } else if (/\bmoderate\b/.test(t)) {
      data = data.filter(f => f.predicted_congestion === 'moderate')
      filterDesc = 'moderate congestion'
    }

    if (/\b(slow|lowest speed|speed)\b/.test(t))
      data.sort((a, b) => a.predicted_speed_kmh - b.predicted_speed_kmh)
    else
      data.sort((a, b) => b.predicted_volume - a.predicted_volume)

    const rows = data.slice(0, 10).map(f => ({
      Segment:        f.segment,
      Congestion:     f.predicted_congestion.replace(/_/g, ' '),
      'Volume':       f.predicted_volume,
      'Speed km/h':   Number(f.predicted_speed_kmh.toFixed(1)),
      Model:          f.model_name,
      'Target':       fmtTime(f.target_at),
    }))

    const horizon = trafficForecasts.value[0]?.horizon_hours ?? '?'
    return {
      text: data.length
        ? `${data.length} segment${data.length > 1 ? 's' : ''} predicted with ${filterDesc || 'traffic activity'} over the next ${horizon}h. Model inference based on historical patterns - training ongoing.`
        : `No traffic segments predicted with ${filterDesc || 'that condition'} in current model outputs.`,
      result: data.length ? { rows, total: data.length, source: 'Traffic Forecasts · KeNHA ML Model' } : null,
    }
  }

  // ── Safety hotspots ───────────────────────────────────────────────────
  if (isSafety) {
    let data = [...safetyHotspots.value]
    let filterDesc = ''

    if (/\b(critical|extreme|worst|highest)\b/.test(t)) {
      data = data.filter(h => h.risk_tier === 'critical')
      filterDesc = 'critical tier'
    } else if (/\bhigh\b/.test(t)) {
      data = data.filter(h => h.risk_tier === 'critical' || h.risk_tier === 'high')
      filterDesc = 'high or critical tier'
    } else if (/\blow\b/.test(t)) {
      data = data.filter(h => h.risk_tier === 'low')
      filterDesc = 'low tier'
    }

    data.sort((a, b) => (b.predicted_risk_score ?? 0) - (a.predicted_risk_score ?? 0))

    const top = data[0]
    const rows = data.slice(0, 10).map(h => ({
      'Road Segment':  h.segment_road_code ?? h.road_segment ?? '-',
      'Risk Tier':     h.risk_tier,
      'Risk Score':    `${((h.predicted_risk_score ?? 0) * 100).toFixed(0)}%`,
      'Horizon (d)':   h.horizon_days,
      'Key Factors':   toFactors(h.contributing_factors).slice(0, 2).map((f: string) => f.replace(/_/g, ' ')).join(', ') || '-',
    }))

    return {
      text: data.length
        ? `${data.length} predicted safety hotspot${data.length > 1 ? 's' : ''}${filterDesc ? ` at ${filterDesc}` : ''}. Highest risk: ${top?.segment_road_code ?? top?.road_segment ?? 'unknown'} at ${((top?.predicted_risk_score ?? 0) * 100).toFixed(0)}%. Model is pre-production; predictions will sharpen with more incident history.`
        : `No safety hotspots${filterDesc ? ` at ${filterDesc}` : ''} in current model outputs.`,
      result: data.length ? { rows, total: data.length, source: 'Safety Hotspots · NTSA ML Model' } : null,
    }
  }

  // ── Road deterioration ────────────────────────────────────────────────
  if (isInfra) {
    let data = [...atRiskSegments.value]
    let filterDesc = ''

    if (/\b(critical|worst|fail|collapse|urgent)\b/.test(t)) {
      data = data.filter(s => (s.failure_probability ?? 0) >= 0.7)
      filterDesc = 'critical failure probability ≥ 70%'
    } else if (/\b(poor|bad|deteriorat)\b/.test(t)) {
      data = data.filter(s => s.predicted_condition_class === 'poor' || s.predicted_condition_class === 'critical')
      filterDesc = 'predicted poor or critical condition'
    }

    data.sort((a, b) => (b.failure_probability ?? 0) - (a.failure_probability ?? 0))

    const top = data[0]
    const rows = data.slice(0, 10).map(s => ({
      'Road Code':      s.road_code ?? s.segment_road_code ?? '-',
      'Condition':      (s.predicted_condition_class ?? '-').replace(/_/g, ' '),
      'Failure Prob.':  `${((s.failure_probability ?? 0) * 100).toFixed(0)}%`,
      'Horizon (mo)':   s.horizon_months,
    }))

    return {
      text: data.length
        ? `${data.length} road segment${data.length > 1 ? 's' : ''} predicted for deterioration${filterDesc ? ` (${filterDesc})` : ''}. Highest risk: ${top?.road_code ?? top?.segment_road_code ?? 'unknown'} at ${((top?.failure_probability ?? 0) * 100).toFixed(0)}% failure probability. Infrastructure ML model is in pre-production.`
        : `No road segments${filterDesc ? ` matching ${filterDesc}` : ''} found in current model outputs.`,
      result: data.length ? { rows, total: data.length, source: 'Road Deterioration · KeNHA ML Model' } : null,
    }
  }

  // ── PT demand ─────────────────────────────────────────────────────────
  if (isPT) {
    const data = [...demandForecasts.value]

    if (/\b(low|least|quiet|lowest)\b/.test(t))
      data.sort((a, b) => a.predicted_passengers - b.predicted_passengers)
    else
      data.sort((a, b) => b.predicted_passengers - a.predicted_passengers)

    const top = data[0]
    const rows = data.slice(0, 10).map(f => ({
      Route:           f.route_name ?? f.route ?? '-',
      'Pred. Pax':     f.predicted_passengers,
      'Lower':         f.lower_passengers,
      'Upper':         f.upper_passengers,
      Model:           f.model_name,
      'Horizon (h)':   f.horizon_hours,
    }))

    return {
      text: data.length
        ? `${data.length} PT route demand forecast${data.length > 1 ? 's' : ''}. ${/low/.test(t) ? 'Lowest' : 'Highest'} demand: ${top?.route_name ?? top?.route ?? 'N/A'} with ${fmtNum(top?.predicted_passengers)} predicted passengers. Demand model is in pre-production.`
        : 'No public transport demand forecasts in current model outputs.',
      result: data.length ? { rows, total: data.length, source: 'PT Demand Forecasts · NTSA ML Model' } : null,
    }
  }

  return {
    text: 'I can analyse: traffic congestion forecasts, safety risk hotspots, road deterioration predictions, and public transport demand. Try asking about one of those.',
    result: null,
  }
}

// ── Send a message ────────────────────────────────────────────────────

async function send() {
  const text = inputText.value.trim()
  if (!text || querying.value) return
  inputText.value = ''

  const uid = `u-${Date.now()}`
  const bid = `b-${Date.now() + 1}`

  messages.value.push({ id: uid, role: 'user', content: text, timestamp: new Date().toISOString() })
  messages.value.push({ id: bid, role: 'assistant', content: '', timestamp: new Date().toISOString(), loading: true })

  await nextTick()
  scrollDown()
  querying.value = true

  // Short processing pause so the typing indicator is visible
  await new Promise(r => setTimeout(r, 400))

  const { text: responseText, result } = analysePredictions(text)

  replaceMsg(bid, { content: responseText, result: result ?? undefined })

  querying.value = false
  await nextTick()
  scrollDown()
  inputEl.value?.focus()
}

function sendText(query: string) {
  inputText.value = query
  send()
}

function replaceMsg(id: string, patch: Partial<ChatMessage>) {
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx !== -1) messages.value[idx] = { ...messages.value[idx], loading: false, ...patch }
}

function clearChat() { initChat() }

function scrollDown() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

// ── Result table helpers ──────────────────────────────────────────────

function resultColumns(result: ChatResult): string[] {
  if (!result.rows?.length) return []
  return Object.keys(result.rows[0])
}

function formatCell(v: unknown): string {
  if (v == null) return '-'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return v.toLocaleString()
  const s = String(v)
  // ISO date → short format
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
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[t] ?? 'neutral'
}
function riskColor(t: string) {
  const m: Record<string,string> = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#22c55e' }
  return m[t] ?? '#94a3b8'
}
function condBadge(c: string) {
  const m: Record<string,string> = { good:'success', fair:'fair', poor:'warning', critical:'danger', failed:'danger' }
  return m[c] ?? 'neutral'
}
function modelColor(m: string) {
  const c: Record<string,string> = { arima:'#3b82f6', prophet:'#22c55e', lstm:'#a855f7', gradient_boost:'#f59e0b', xgboost:'#ef4444' }
  return c[m] ?? '#64748b'
}
function toFactors(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) return v.split(',').map(s => s.trim())
  return []
}

onMounted(initChat)
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.card-header-meta { font-size:11px; font-weight:400; color:#94a3b8; margin-left:auto; }

/* ── NLP Chat Panel ── */
.chat-panel {
  background:#fff;
  border:1px solid #e2e8f0;
  border-radius:12px;
  margin-bottom:24px;
  overflow:hidden;
  box-shadow:0 2px 12px rgba(0,0,0,.06);
}

.chat-panel-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:12px 16px;
  color:#fff;
}
.chat-panel-title {
  display:flex;
  align-items:center;
  gap:10px;
  font-weight:700;
  font-size:14px;
}
.chat-icon { font-size:16px; color:#60a5fa; }
.chat-subtitle { font-size:11px; font-weight:400; color:#94a3b8; }
.chat-header-actions { display:flex; align-items:center; gap:8px; }
.dataset-count { font-size:11px; color:#64748b; background:#1e293b; padding:2px 8px; border-radius:4px; }
.chat-clear-btn {
  font-size:12px; padding:4px 10px; border-radius:6px; cursor:pointer; border:none;
  background:#10e83b; color:#f4f6f9; font-weight:500; text-decoration:none; display:inline-flex; align-items:center;
}
.chat-clear-btn:hover { background:#10e83b; color:#fff; }

/* Messages area */
.chat-messages {
  height:340px;
  overflow-y:auto;
  padding:16px;
  display:flex;
  flex-direction:column;
  gap:12px;
  background:#f8fafc;
  scroll-behavior:smooth;
}

.chat-msg { display:flex; }
.chat-msg--user      { justify-content:flex-end; }
.chat-msg--assistant { justify-content:flex-start; }

.chat-bubble {
  max-width:75%;
  border-radius:12px;
  padding:10px 14px;
  font-size:13px;
  line-height:1.55;
  position:relative;
}
.chat-msg--user .chat-bubble {
  background:#2563eb;
  color:#fff;
  border-bottom-right-radius:3px;
}
.chat-msg--assistant .chat-bubble {
  background:#fff;
  color:#1e293b;
  border:1px solid #e2e8f0;
  border-bottom-left-radius:3px;
  box-shadow:0 1px 4px rgba(0,0,0,.06);
}
.chat-bubble--error { border-color:#fca5a5 !important; background:#fff5f5 !important; }

.chat-text { white-space:pre-line; }

.msg-time { font-size:10px; color:#94a3b8; margin-top:4px; text-align:right; }
.chat-msg--user .msg-time { color:#bfdbfe; }

/* Query meta pill */
.query-meta-pill {
  display:inline-flex;
  gap:6px;
  align-items:center;
  margin-top:8px;
  padding:3px 8px;
  border-radius:20px;
  background:#f1f5f9;
  font-size:10px;
}
.qm-dataset { font-weight:700; color:#0369a1; font-family:monospace; }
.qm-filters { color:#d97706; }
.qm-limit   { color:#94a3b8; }

/* Result table */
.result-wrap { margin-top:10px; }
.result-header { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
.result-count-badge {
  font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px;
  background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;
}
.result-dataset-badge {
  font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px;
  background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;
  font-family:monospace;
}
.result-table-scroll { overflow-x:auto; max-width:100%; border-radius:6px; border:1px solid #e2e8f0; }
.result-table { width:100%; border-collapse:collapse; font-size:11px; }
.result-table thead tr { background:#f1f5f9; }
.result-table th { padding:5px 8px; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; white-space:nowrap; border-bottom:1px solid #e2e8f0; }
.result-table tbody tr:nth-child(even) { background:#f8fafc; }
.result-table tbody tr:hover { background:#eff6ff; }
.result-cell { padding:4px 8px; color:#1e293b; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; border-bottom:1px solid #f1f5f9; }
.result-overflow { font-size:11px; color:#94a3b8; padding:6px 2px 0; }
.result-link { color:#2563eb; text-decoration:underline; }
.zero-result { font-size:12px; color:#94a3b8; font-style:italic; margin-top:4px; }

/* Typing animation */
.typing-dots { display:flex; gap:4px; align-items:center; padding:4px 2px; }
.typing-dots span {
  width:7px; height:7px; border-radius:50%; background:#94a3b8;
  animation:typing-bounce 1.2s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay:.2s; }
.typing-dots span:nth-child(3) { animation-delay:.4s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform:scale(0.8); opacity:.5; }
  40%           { transform:scale(1.1); opacity:1; }
}

/* Suggestion chips */
.suggestion-row {
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  padding:10px 16px;
  border-top:1px solid #f1f5f9;
  background:#fff;
}
.suggestion-chip {
  font-size:12px;
  padding:4px 12px;
  border-radius:20px;
  border:1px solid #cbd5e1;
  background:#f8fafc;
  color:#374151;
  cursor:pointer;
  font-weight:500;
  white-space:nowrap;
  transition:all .15s;
}
.suggestion-chip:hover:not(:disabled) { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
.suggestion-chip:disabled { opacity:.5; cursor:default; }

/* Input bar */
.chat-input-bar {
  display:flex;
  gap:8px;
  padding:12px 16px;
  border-top:1px solid #e2e8f0;
  background:#fff;
}
.chat-input {
  flex:1;
  padding:8px 14px;
  border:1px solid #d1d5db;
  border-radius:8px;
  font-size:13px;
  outline:none;
  transition:border-color .15s;
}
.chat-input:focus { border-color:#3b82f6; box-shadow:0 0 0 2px #dbeafe; }
.chat-input:disabled { background:#f8fafc; }
.chat-send-btn {
  padding:8px 20px;
  background:#2563eb;
  color:#fff;
  border:none;
  border-radius:8px;
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  white-space:nowrap;
  min-width:60px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:background .15s;
}
.chat-send-btn:hover:not(:disabled) { background:#1d4ed8; }
.chat-send-btn:disabled { opacity:.5; cursor:default; }
.send-spinner {
  width:14px; height:14px; border:2px solid rgba(255,255,255,.4);
  border-top-color:#fff; border-radius:50%;
  animation:spin .7s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Existing table/model styles ── */
.model-legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.model-chip { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px; background:#f8fafc; border:1px solid #e2e8f0; color:#374151; }
.model-dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex-shrink:0; }
.model-legend-note { font-size:11px; color:#94a3b8; margin-left:auto; }
.model-badge { font-size:11px; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid transparent; }
.score-bar-wrap { background:#f1f5f9; border-radius:5px; height:8px; overflow:hidden; margin-bottom:3px; min-width:80px; }
.score-bar { height:100%; border-radius:5px; transition:width .4s ease; }
.score-label { font-size:11px; color:#64748b; font-weight:600; font-variant-numeric:tabular-nums; }
.factor-chips { display:flex; flex-wrap:wrap; gap:3px; max-width:180px; }
.factor-chip { font-size:10px; padding:2px 6px; border-radius:4px; background:#f1f5f9; color:#475569; white-space:nowrap; font-weight:500; }
.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; }
.num-bold   { font-weight:700; color:#1e293b; }
.num-cell   { font-size:12px; color:#374151; }
.dim-cell   { font-size:11px; color:#94a3b8; white-space:nowrap; }
.ts-cell    { font-size:11px; white-space:nowrap; color:#64748b; }
.empty-row  { text-align:center; color:#94a3b8; padding:16px; }
.pax-big    { font-size:15px; font-weight:800; color:#1e293b; font-variant-numeric:tabular-nums; }
.conf-range { font-size:12px; color:#64748b; font-variant-numeric:tabular-nums; }
</style>
