// tests/unit/collapsible-section.test.ts
// A map or incident list folds to one header and keeps its state while folded.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import CollapsibleSection from '~/components/CollapsibleSection.vue'

const store = new Map<string, any>()
beforeEach(() => {
  store.clear()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
})

// A body that remembers a value typed into it, standing in for a map's zoom or a filter.
const Body = defineComponent({
  setup() { const text = ref(''); return { text } },
  template: '<input class="body-input" v-model="text" />',
})
const mountSection = (props: Record<string, unknown> = {}, slots: Record<string, any> = { default: Body }) =>
  mount(CollapsibleSection, { props: { title: 'Map', ...props }, slots, global: { stubs: { ChevronDown: true } } })

describe('CollapsibleSection', () => {
  it('starts collapsed and does not mount its body (a map costs nothing until asked for)', () => {
    const w = mountSection()
    expect(w.find('.cs-toggle').attributes('aria-expanded')).toBe('false')
    expect(w.find('.body-input').exists()).toBe(false)
  })
  it('opens on click and the header says so', async () => {
    const w = mountSection()
    await w.find('.cs-toggle').trigger('click')
    expect(w.find('.cs-toggle').attributes('aria-expanded')).toBe('true')
    expect(w.find('.body-input').exists()).toBe(true)
    expect(w.find('.cs-hint').text()).toBe('Hide')
  })
  it('keeps the body mounted when collapsed again, so its state survives reopening', async () => {
    const w = mountSection()
    await w.find('.cs-toggle').trigger('click')
    await w.find('.body-input').setValue('Kiambu')
    await w.find('.cs-toggle').trigger('click') // collapse
    expect(w.find('.cs-body').attributes('style')).toContain('display: none')
    await w.find('.cs-toggle').trigger('click') // reopen
    expect((w.find('.body-input').element as HTMLInputElement).value).toBe('Kiambu')
  })
  it('can start open, e.g. incident lists', () => {
    const w = mountSection({ defaultOpen: true })
    expect(w.find('.body-input').exists()).toBe(true)
  })
  it('shows a count and its tone in the header so it stays visible while folded', () => {
    const w = mountSection({ count: 7, tone: 'danger' })
    const badge = w.find('.cs-count')
    expect(badge.text()).toBe('7')
    expect(badge.classes()).toContain('danger')
  })
  it('a zero count is shown, not hidden', () => {
    expect(mountSection({ count: 0 }).find('.cs-count').text()).toBe('0')
  })
  it('keeps the choice for the session under a storage key, shared by every copy of that key', async () => {
    const a = mountSection({ storageKey: 'map:test' })
    await a.find('.cs-toggle').trigger('click')
    const b = mountSection({ storageKey: 'map:test' })
    expect(b.find('.cs-toggle').attributes('aria-expanded')).toBe('true')
  })
  it('opens when a KPI card drills to something inside it', async () => {
    const w = mount(CollapsibleSection, {
      props: { title: 'Incidents' }, attachTo: document.body,
      slots: { default: '<div id="inside-target">row</div>' },
    })
    expect(w.find('#inside-target').exists()).toBe(false)
    // The target does not exist yet (lazy body): the reveal request is for an id the section will own.
    await w.find('.cs-toggle').trigger('click'); await w.find('.cs-toggle').trigger('click') // mounted, collapsed
    window.dispatchEvent(new CustomEvent('uapts:reveal', { detail: { id: 'inside-target' } }))
    await w.vm.$nextTick()
    expect(w.find('.cs-toggle').attributes('aria-expanded')).toBe('true')
    w.unmount()
  })
  it('ignores a reveal for something outside it', async () => {
    const w = mountSection()
    window.dispatchEvent(new CustomEvent('uapts:reveal', { detail: { id: 'somewhere-else' } }))
    await w.vm.$nextTick()
    expect(w.find('.cs-toggle').attributes('aria-expanded')).toBe('false')
  })
})
