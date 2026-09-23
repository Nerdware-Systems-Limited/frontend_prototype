// tests/unit/kpi-card.test.ts
// ─────────────────────────────────────────────────────────────────────
// Focused behaviour tests for the redesigned KpiCard:
//   - status vocabulary + colour class (never "up = good")
//   - favorable / unfavorable trend interpretation
//   - unavailable data never renders as "0", trend, or bullet bar
//   - target bullet bar only appears when a real target is supplied
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

// KpiCard calls Nuxt's auto-imported useRouter()/useRoute() in setup.
beforeAll(() => {
  ;(globalThis as any).useRouter = () => ({ push: vi.fn(), replace: vi.fn() })
  ;(globalThis as any).useRoute = () => ({ query: {} })
})

import KpiCard from '~/components/KpiCard.vue'

const mountCard = (props: Record<string, unknown>) =>
  mount(KpiCard, {
    props,
    global: { stubs: { NuxtLink: true, Sparkline: true } },
  })

/** Root `.kpi-card` element - the dynamic `<component :is>` root isn't the
 *  wrapper root under test-utils, so query it explicitly. */
const card = (w: ReturnType<typeof mountCard>) => w.get('.kpi-card')

describe('KpiCard - status semantics', () => {
  it('renders the canonical status word and colour class', () => {
    const w = mountCard({ label: 'Road Safety', value: '1,339', status: 'critical', period: 'LIVE' })
    expect(w.get('.kpi-card__status').text()).toBe('Critical')
    expect(card(w).classes()).toContain('is-critical')
    expect(card(w).classes()).not.toContain('is-healthy')
  })

  it('maps legacy status aliases through to the new vocabulary', () => {
    expect(mountCard({ label: 'x', value: '1', status: 'ontarget' }).get('.kpi-card').classes()).toContain('is-healthy')
    expect(mountCard({ label: 'x', value: '1', status: 'below' }).get('.kpi-card').classes()).toContain('is-warning')
    expect(mountCard({ label: 'x', value: '1', status: 'monitoring' }).get('.kpi-card').classes()).toContain('is-neutral')
    expect(mountCard({ label: 'x', value: '1', status: 'crit' }).get('.kpi-card').classes()).toContain('is-critical')
  })

  it('always shows the period badge when provided', () => {
    const w = mountCard({ label: 'Rail', value: '0.0', unit: '%', period: '30D' })
    expect(w.get('.kpi-card__period').text()).toBe('30D')
  })

  it('renders the unit subordinate to the value', () => {
    const w = mountCard({ label: 'Rail', value: '47.0', unit: '%' })
    expect(w.get('.kpi-card__value').text()).toContain('47.0')
    expect(w.get('.kpi-card__unit').text()).toBe('%')
  })
})

describe('KpiCard - trend direction is interpreted, not assumed', () => {
  it('an increasing negative metric reads as unfavorable (red)', () => {
    // fatalities went UP -> that direction is NOT favorable
    const w = mountCard({
      label: 'Fatalities', value: '252', period: '30D',
      comparisonValue: '18 more', comparisonPeriod: 'vs prior 15 days',
      trendDirection: 'up', trendFavorable: false,
    })
    const cmp = w.get('.kpi-card__comparison')
    expect(cmp.classes()).toContain('is-bad')
    expect(cmp.text()).toContain('▲')
    expect(cmp.text()).toContain('18 more')
  })

  it('a decreasing negative metric reads as favorable (green)', () => {
    const w = mountCard({
      label: 'Incidents', value: '40', period: '7D',
      comparisonValue: '12 below 30-day pace',
      trendDirection: 'down', trendFavorable: true,
    })
    const cmp = w.get('.kpi-card__comparison')
    expect(cmp.classes()).toContain('is-good')
    expect(cmp.text()).toContain('▼')
  })

  it('a flat trend is neutral regardless of favorability', () => {
    const w = mountCard({
      label: 'x', value: '1', comparisonValue: 'On 7-day pace', trendDirection: 'flat',
    })
    expect(w.get('.kpi-card__comparison').classes()).toContain('is-neutral')
  })

  it('maps the legacy `delta` prop onto the comparison line', () => {
    const w = mountCard({
      label: 'x', value: '1',
      delta: { value: '5 fewer', label: 'vs last week', direction: 'down', intent: 'good' },
    })
    const cmp = w.get('.kpi-card__comparison')
    expect(cmp.classes()).toContain('is-good')
    expect(cmp.text()).toContain('5 fewer')
    expect(cmp.text()).toContain('vs last week')
  })
})

describe('KpiCard - unavailable data', () => {
  it('renders a placeholder and NO DATA, never a zero, and no trend/bar', () => {
    const w = mountCard({
      label: 'Active Fleet', value: '0', unavailable: true,
      unavailableReason: 'No live telemetry received', period: 'LIVE',
      comparisonValue: '10 more', trendDirection: 'up', trendFavorable: false,
      progress: { min: 0, max: 100, current: 0, target: 80 },
    })
    const val = w.get('.kpi-card__value').text()
    expect(val).toBe('-')
    expect(val).not.toContain('0')
    expect(w.get('.kpi-card__reason').text()).toContain('No data')
    expect(w.get('.kpi-card__reason').text()).toContain('No live telemetry received')
    expect(card(w).classes()).toContain('is-unavailable')
    expect(w.find('.kpi-card__comparison').exists()).toBe(false)
    expect(w.find('.kpi-card__bullet').exists()).toBe(false)
  })

  it('status="unavailable" behaves the same as unavailable=true', () => {
    const w = mountCard({ label: 'x', value: '5', status: 'unavailable' })
    expect(w.get('.kpi-card__value').text()).toBe('-')
    expect(card(w).classes()).toContain('is-unavailable')
  })

  it('a genuine zero is shown as 0, not as unavailable', () => {
    const w = mountCard({ label: 'Black spots', value: '0', status: 'healthy', description: 'No critical clusters active' })
    expect(w.get('.kpi-card__value').text()).toBe('0')
    expect(card(w).classes()).not.toContain('is-unavailable')
    expect(w.get('.kpi-card__status').text()).toBe('On target')
  })
})

describe('KpiCard - target bullet bar', () => {
  it('is omitted when no target/progress is supplied', () => {
    const w = mountCard({ label: 'x', value: '47.0', unit: '%', status: 'warning' })
    expect(w.find('.kpi-card__bullet').exists()).toBe(false)
    expect(w.find('.kpi-card__target').exists()).toBe(false)
  })

  it('renders the bar with a target marker when progress is real', () => {
    const w = mountCard({
      label: 'Rail OTP', value: '72.0', unit: '%', status: 'warning',
      target: '80%', targetLabel: 'SLA',
      progress: { min: 0, max: 100, current: 72, target: 80 },
    })
    const bar = w.get('.kpi-card__bullet')
    expect(bar.find('.kpi-card__bullet-marker').exists()).toBe(true)
    expect(bar.get('.kpi-card__bullet-fill').attributes('style')).toContain('scaleX(0.72')
    expect(bar.get('.kpi-card__bullet-marker').attributes('style')).toContain('left: 80')
    expect(bar.text()).toContain('SLA')
    expect(bar.text()).toContain('80%')
  })

  it('shows a plain target line when a target exists but no progress bar', () => {
    const w = mountCard({ label: 'x', value: '50', target: '≥ 60', status: 'warning' })
    expect(w.find('.kpi-card__bullet').exists()).toBe(false)
    expect(w.get('.kpi-card__target').text()).toContain('Target')
    expect(w.get('.kpi-card__target').text()).toContain('≥ 60')
  })
})
