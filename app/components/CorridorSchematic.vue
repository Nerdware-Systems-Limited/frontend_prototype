<template>
  <figure class="cs" aria-label="Northern Corridor route schematic: Mombasa to the Malaba and Busia border posts">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" preserveAspectRatio="xMidYMid meet">
      <!-- road segments -->
      <g v-for="(seg, i) in links" :key="seg.key">
        <line :x1="seg.x1" :y1="Y" :x2="seg.x2" :y2="Y" class="road-bed" />
        <line :x1="seg.x1" :y1="Y" :x2="seg.x2" :y2="Y" class="road" :style="{ stroke: seg.color }" />
        <text :x="(seg.x1 + seg.x2) / 2" :y="Y - 16" class="seg-pct" text-anchor="middle">
          {{ seg.pct != null ? `${seg.pct.toFixed(0)}%` : '-' }}
        </text>
        <text :x="(seg.x1 + seg.x2) / 2" :y="Y - 5" class="micro" text-anchor="middle">{{ i === 0 ? 'good road' : 'good' }}</text>
        <text :x="(seg.x1 + seg.x2) / 2" :y="Y + 26" class="seg-name" text-anchor="middle">{{ seg.label }}</text>
      </g>

      <!-- fork to the two main borders -->
      <path :d="`M ${forkX} ${Y} C ${forkX + 36} ${Y}, ${forkX + 36} ${Y - 46}, ${borderX} ${Y - 46}`" class="road-fork" />
      <path :d="`M ${forkX} ${Y} C ${forkX + 36} ${Y}, ${forkX + 36} ${Y + 46}, ${borderX} ${Y + 46}`" class="road-fork" />

      <!-- inland nodes -->
      <g v-for="n in nodes" :key="n.name">
        <circle :cx="n.x" :cy="Y" :r="n.major ? 7 : 5" class="node" :class="{ major: n.major }" />
        <text :x="n.x" :y="Y + 46" class="node-name" text-anchor="middle">{{ n.name }}</text>
        <text v-if="n.sub" :x="n.x" :y="Y + 59" class="micro" text-anchor="middle">{{ n.sub }}</text>
      </g>

      <!-- border posts -->
      <g v-for="b in borders" :key="b.name" :transform="`translate(${borderX} ${b.y})`">
        <circle r="8" class="node border" :style="{ stroke: b.color }" />
        <text x="16" y="-2" class="node-name">{{ b.name }}</text>
        <text x="16" y="12" class="wait" :style="{ fill: b.color }">{{ b.waitText }}</text>
      </g>
      <text :x="W - 6" :y="Y + 4" class="micro" text-anchor="end">→ Kampala · Kigali · Juba</text>
    </svg>
    <figcaption class="cs-key">
      <span><i class="sw" style="background:var(--success)" /> ≥ 65% good</span>
      <span><i class="sw" style="background:var(--warning)" /> 50–64%</span>
      <span><i class="sw" style="background:var(--destructive)" /> &lt; 50%</span>
      <span class="grow" />
      <span class="micro">Border figures: average waiting time, selected window</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { waitTone, fmtHours, CORRIDOR_TONE_COLOR as TONE_COLOR, type BorderPostStatus } from '~/composables/api'

const props = defineProps<{
  /** Road-in-good-condition % per segment, keyed by the segment name ("Mombasa-Nairobi"). */
  segmentGoodPct: Record<string, number>
  posts: BorderPostStatus[]
}>()

const W = 1000, H = 190, Y = 84
const forkX = 700, borderX = 800

const nodes = [
  { name: 'Mombasa Port', sub: 'KPA', x: 50, major: true },
  { name: 'Nairobi', sub: '', x: 280, major: true },
  { name: 'Nakuru', sub: '', x: 480, major: false },
  { name: 'Eldoret', sub: '', x: 640, major: false },
]
const segs = [
  { key: 'a', label: 'Mombasa–Nairobi', name: 'Mombasa-Nairobi', x1: 50, x2: 280 },
  { key: 'b', label: 'Nairobi–Nakuru', name: 'Nairobi-Nakuru', x1: 280, x2: 480 },
  { key: 'c', label: 'Nakuru–Eldoret–Malaba', name: 'Nakuru-Eldoret-Malaba', x1: 480, x2: 700 },
]

function segColor(pct: number | null) {
  return pct == null ? 'var(--border-interactive)' : pct >= 65 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--destructive)'
}
const links = computed(() => segs.map(s => {
  const pct = props.segmentGoodPct[s.name] ?? null
  return { ...s, pct, color: segColor(pct) }
}))

function border(siteId: string, name: string, y: number) {
  const p = props.posts.find(x => x.site_id === siteId)
  const tone = waitTone(p?.avg_waiting_hours)
  return { name, y, color: TONE_COLOR[tone], waitText: p?.avg_waiting_hours != null ? `${fmtHours(p.avg_waiting_hours)} wait` : 'no data' }
}
const borders = computed(() => [border('MALABA-OSBP', 'Malaba', Y - 46), border('BUSIA-OSBP', 'Busia', Y + 46)])
</script>

<style scoped>
.cs { margin: 0; }
svg { width: 100%; height: auto; display: block; }
.road-bed { stroke: var(--surface-sunken); stroke-width: 12; stroke-linecap: round; }
.road { stroke-width: 5; stroke-linecap: round; }
.road-fork { fill: none; stroke: var(--border-strong); stroke-width: 3; stroke-linecap: round; }
.node { fill: var(--surface-2); stroke: var(--primary); stroke-width: 2; }
.node.major { fill: var(--primary-fill); }
.node.border { stroke-width: 3; }
.micro { font: 700 8.5px Inter, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; fill: var(--fg-3); }
.seg-pct { font: 600 15px 'JetBrains Mono', ui-monospace, monospace; fill: var(--fg-1); }
.seg-name { font: 500 11px Inter, system-ui, sans-serif; fill: var(--fg-2); }
.node-name { font: 600 12px Inter, system-ui, sans-serif; fill: var(--fg-1); }
.wait { font: 600 11px 'JetBrains Mono', ui-monospace, monospace; }
.cs-key { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; padding: 8px 14px 0; font-size: 11px; color: var(--fg-2); border-top: 1px solid var(--border-subtle); margin-top: 6px; }
.cs-key .sw { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.grow { flex: 1; }
</style>
