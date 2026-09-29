// tests/unit/national-heatmap.test.ts
// ─────────────────────────────────────────────────────────────────────
// The National Incident Heatmap on the command centre: what the map is
// handed, what the header says, and what the widget says when there is
// nothing (or nothing reachable) to plot.
//   - a hotspot/black spot with a null position never reaches the map
//     (one bad coordinate makes Leaflet throw and drops every marker);
//   - the header reports real API totals, not the size of the page it loaded;
//   - an empty map explains itself instead of just showing roads;
//   - black-spot tiers colour-match the legend (low is gray, not medium's yellow).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { onUnmounted, watch } from 'vue'

beforeAll(() => {
  ;(globalThis as any).onUnmounted = onUnmounted
  ;(globalThis as any).watch = watch
  ;(globalThis as any).useNavSubtitle = () => {}
  ;(globalThis as any).useRouter = () => ({ push: vi.fn(), replace: vi.fn() })
  ;(globalThis as any).useRoute  = () => ({ query: {} })
})

// What each mocked feed resolves with. Everything the widget does not
// need rejects - the component reads every feed through Promise.allSettled,
// so a dead feed must degrade that one section, never throw. (vi.mock is
// hoisted above the file's own top-level consts, hence vi.hoisted.)
const { feeds, dead } = vi.hoisted(() => ({
  feeds: {
    hotspots:   { count: 0, results: [] as any[] } as any,
    blackspots: { count: 0, results: [] as any[] } as any,
    hotspotsFail: false,
    blackspotsFail: false,
    roads: { type: 'FeatureCollection', features: [] } as any,
  },
  dead: () => new Proxy({}, { get: () => () => Promise.reject(new Error('feed down')) }),
}))

vi.mock('~/composables/api', async () => {
  const actual = await vi.importActual<any>('~/composables/api')
  return {
    ...actual,
    useSafety: () => ({
      summary: () => Promise.reject(new Error('feed down')),
      hotspots: () => (feeds.hotspotsFail ? Promise.reject(new Error('down')) : Promise.resolve(feeds.hotspots)),
      topBlackspots: () => (feeds.blackspotsFail ? Promise.reject(new Error('down')) : Promise.resolve(feeds.blackspots)),
    }),
    useGis: () => ({ roads: () => Promise.resolve(feeds.roads) }),
    useFleet: dead, useRailway: dead, useAviationMaritime: dead, useInfrastructure: dead, useIntegrations: dead,
  }
})

// Nuxt auto-registers app/components/*.vue; outside its build they are registered by hand.
import KpiCard from '~/components/KpiCard.vue'
import EmptyState from '~/components/EmptyState.vue'
import SectionTitle from '~/components/SectionTitle.vue'
import NationalCommandCentre from '~/components/NationalCommandCentre.vue'

const hotspot = (id: string, over: Record<string, unknown> = {}) => ({
  id, segment: null, segment_road_code: 'A104', latitude: -1.2, longitude: 36.8, grid_cell_id: `cell-${id}`,
  predicted_risk_score: 80, risk_tier: 'very_high', horizon_days: 7, confidence_pct: 90,
  contributing_factors: null, model_name: 'gbm', model_version: '1', computed_at: '', created_at: '', updated_at: '',
  ...over,
})
const blackspot = (id: string, tier: string | null, over: Record<string, unknown> = {}) => ({
  id, segment: null, segment_road_code: 'A104', segment_road_name: 'Nairobi-Nakuru', accident_count_rolling: 5,
  fatality_count_rolling: 1, ranking_tier: tier, kde_intensity: 0.5, radius_m: 300, window_days: 90,
  centroid_latitude: -0.3, centroid_longitude: 36.1, last_computed_at: null, created_at: '', updated_at: '',
  ...over,
})

// The real UaptsMap needs Leaflet + a browser; a stub that publishes the
// markers it was handed is enough to assert on what would be plotted.
const UaptsMap = {
  name: 'UaptsMap',
  props: ['markers', 'roads'],
  template: `<div data-testid="map"
    :data-ids="(markers ?? []).map(m => m.id).join(',')"
    :data-colors="(markers ?? []).map(m => m.color).join(',')" />`,
}

async function mountCentre() {
  const w = mount(NationalCommandCentre, {
    global: {
      components: { KpiCard, EmptyState, SectionTitle },
      stubs: { NuxtLink: true, Sparkline: true, ClientOnly: { template: '<div><slot /></div>' }, UaptsMap },
      renderStubDefaultSlot: true,
    },
  })
  await flushPromises()
  return w
}
const map = (w: any) => w.find('[data-testid="map"]')
const ids = (w: any): string[] => (map(w).attributes('data-ids') || '').split(',').filter(Boolean)
const head = (w: any) => w.find('.map-head-meta').text()

beforeEach(() => {
  feeds.hotspots = { count: 0, results: [] }
  feeds.blackspots = { count: 0, results: [] }
  feeds.hotspotsFail = false
  feeds.blackspotsFail = false
  feeds.roads = { type: 'FeatureCollection', features: [] }
})

describe('National Incident Heatmap', () => {
  it('plots hotspots and black spots that have a position', async () => {
    feeds.hotspots = { count: 2, results: [hotspot('h1'), hotspot('h2', { latitude: 0.5, longitude: 37.2 })] }
    feeds.blackspots = { count: 1, results: [blackspot('b1', 'critical')] }
    const w = await mountCentre()
    expect(ids(w)).toEqual(['hs-h1', 'hs-h2', 'bs-b1'])
    expect(w.find('.map-empty').exists()).toBe(false)
  })

  it('never hands the map a row with a missing position (one null takes every marker down)', async () => {
    feeds.hotspots = { count: 3, results: [hotspot('h1'), hotspot('bad-lat', { latitude: null }), hotspot('bad-lon', { longitude: Number.NaN })] }
    feeds.blackspots = { count: 2, results: [blackspot('b1', 'high'), blackspot('b-null', 'high', { centroid_latitude: null })] }
    const w = await mountCentre()
    expect(ids(w)).toEqual(['hs-h1', 'bs-b1'])
  })

  it('header reports the real total, not the size of the page it loaded', async () => {
    feeds.hotspots = { count: 412, results: [hotspot('h1'), hotspot('h2')] }
    feeds.blackspots = { count: 1, results: [blackspot('b1', 'medium')] }
    const w = await mountCentre()
    expect(head(w)).toContain('top 2 of 412 hotspots')
    expect(head(w)).toContain('1 black spot')
    expect(head(w)).not.toContain('1 black spots')
  })

  it('says why the map is empty when the feeds work but hold nothing - never a blank roads-only map', async () => {
    const w = await mountCentre()
    expect(ids(w)).toEqual([])
    expect(w.find('.map-empty').text()).toMatch(/no predictive hotspots or black spots yet/i)
    expect(head(w)).toContain('0 hotspots')
  })

  it('says the feed is unavailable, not "no data", when both requests fail', async () => {
    feeds.hotspotsFail = true
    feeds.blackspotsFail = true
    const w = await mountCentre()
    expect(w.find('.map-empty').text()).toMatch(/unavailable/i)
    expect(w.find('.map-empty').text()).not.toMatch(/no predictive hotspots/i)
  })

  it('still plots what it has when only one of the two feeds fails', async () => {
    feeds.hotspotsFail = true
    feeds.blackspots = { count: 1, results: [blackspot('b1', 'critical')] }
    const w = await mountCentre()
    expect(ids(w)).toEqual(['bs-b1'])
    expect(w.find('.map-empty').exists()).toBe(false)
  })

  it('colours black spots to match the legend: critical red, high orange, medium yellow, low/unranked gray', async () => {
    feeds.blackspots = {
      count: 5,
      results: [blackspot('c', 'critical'), blackspot('h', 'high'), blackspot('m', 'medium'), blackspot('l', 'low'), blackspot('u', null)],
    }
    const w = await mountCentre()
    expect(map(w).attributes('data-colors')).toBe('red,orange,yellow,gray,gray')
  })
})
