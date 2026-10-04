import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccessScopeToggle from '~/components/AccessScopeToggle.vue'

const opt = (w: any, scope: string) => w.find(`[data-scope="${scope}"]`)

describe('AccessScopeToggle', () => {
  it('marks the current value and emits the chosen scope', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', label: 'Traffic' } })
    expect(opt(w, 'read').attributes('aria-checked')).toBe('true')
    await opt(w, 'none').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['none'])
  })

  it('disables options above max', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', max: 'read', label: 'Traffic' } })
    expect(opt(w, 'full').attributes('disabled')).toBeDefined()
    expect(opt(w, 'read').attributes('disabled')).toBeUndefined()
  })

  it('shows an inherited level as checked but not as set here', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: null, allowInherit: true, inheritedLabel: 'read', label: 'Traffic' } })
    expect(opt(w, 'read').attributes('aria-checked')).toBe('true')
    expect(opt(w, 'read').classes()).toContain('is-inherited')
    expect(opt(w, 'read').classes()).not.toContain('is-set')
    expect(opt(w, 'inherit').exists()).toBe(false) // nothing to reset while inheriting
  })

  it('offers a reset to the inherited value once a value is set, and emits null for it', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'none', allowInherit: true, inheritedLabel: 'full', label: 'Traffic' } })
    expect(opt(w, 'none').classes()).toContain('is-set')
    expect(opt(w, 'inherit').attributes('aria-label')).toContain('full')
    await opt(w, 'inherit').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([null])
  })

  it('flags a mixed inherited module without checking any level', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: null, allowInherit: true, inheritedLabel: 'mixed', label: 'Fleet' } })
    expect(w.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(0)
    expect(w.text()).toContain('Mixed')
  })

  it('shows capped when the stored value is above max', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'full', max: 'read', label: 'Traffic' } })
    expect(w.find('.badge.warning').text()).toBe('Capped')
  })

  it('emits nothing when disabled', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', disabled: true, label: 'Traffic' } })
    await opt(w, 'none').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('has exactly one option with tabindex 0 and it is the checked one', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', label: 'Traffic' } })
    const buttons = w.findAll('[role="radio"]')
    const tabIdx0Buttons = buttons.filter(b => b.attributes('tabindex') === '0')
    expect(tabIdx0Buttons).toHaveLength(1)
    expect(tabIdx0Buttons[0].attributes('data-scope')).toBe('read')
  })

  it('ArrowRight from read with max full emits full', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', max: 'full', label: 'Traffic' } })
    await opt(w, 'read').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['full'])
  })

  it('ArrowRight from read with max read wraps past disabled full to none', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', max: 'read', allowInherit: true, label: 'Traffic' } })
    await opt(w, 'read').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['none'])
  })
})
