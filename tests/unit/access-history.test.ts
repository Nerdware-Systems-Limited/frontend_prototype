// tests/unit/access-history.test.ts
// ─────────────────────────────────────────────────────────────────────
// Module Access change log (describeChanges / parseStoredHistory) and the
// permissions export builder.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { describeChanges, parseStoredHistory } from '~/utils/accessHistory'
import { buildPermissionExport, pageColumns, permissionsPrintHtml } from '~/utils/accessExport'
import { EMPTY_OVERRIDES, editableModules, editableRoutes, type PolicyOverrides } from '~/utils/resolveAccess'

const ov = (agencies: PolicyOverrides['agencies']): PolicyOverrides => ({ version: 1, agencies })

describe('describeChanges', () => {
  it('describes an enabled-level change in plain words', () => {
    const after = ov({ KRC: { enabled: { routes: { '/fleet': 'none' } } } })
    // KRC reads /fleet by default; the admin switches it off.
    expect(describeChanges(EMPTY_OVERRIDES, after, 'KRC')).toEqual([
      { subject: '/fleet', field: 'Agency access', from: 'Read', to: 'None' },
    ])
  })

  it('names modules by label and calls the ceiling the agency limit', () => {
    const after = ov({ KRC: { ceiling: { modules: { M08: 'read' } } } })
    expect(describeChanges(EMPTY_OVERRIDES, after, 'KRC')).toEqual([
      { subject: 'Railway', field: 'Agency limit', from: 'Full', to: 'Read' },
    ])
  })

  it('marks default vs set when only the source of a value changed', () => {
    const after = ov({ KRC: { ceiling: { modules: { M08: 'full' } } } })
    expect(describeChanges(EMPTY_OVERRIDES, after, 'KRC')[0]).toMatchObject({ from: 'Full (default)', to: 'Full' })
  })

  it('covers role scopes, capabilities and data categories', () => {
    const after = ov({
      KPA: {
        roles: { analyst: { modules: { M12: 'read' }, capabilities: ['run_reports'] } },
        enabled: { categories: { cargo_commercial: 'deny' } },
      },
    })
    const lines = describeChanges(EMPTY_OVERRIDES, after, 'KPA')
    expect(lines).toContainEqual({ subject: 'Data Integration Hub', field: 'Analyst role', from: 'Full', to: 'Read' })
    expect(lines).toContainEqual({ subject: 'Export data', field: 'Analyst role capability', from: 'On', to: 'Off' })
    expect(lines).toContainEqual(expect.objectContaining({ field: 'Agency access data', from: 'Visible', to: 'Masked' }))
  })

  it('describes a reset as the reverse of what was set', () => {
    const before = ov({ KRC: { enabled: { routes: { '/fleet': 'none' } } } })
    expect(describeChanges(before, EMPTY_OVERRIDES, 'KRC')).toEqual([
      { subject: '/fleet', field: 'Agency access', from: 'None', to: 'Read' },
    ])
  })

  it('reports nothing when nothing changed', () => {
    expect(describeChanges(EMPTY_OVERRIDES, EMPTY_OVERRIDES, 'KRC')).toEqual([])
  })
})

describe('parseStoredHistory', () => {
  it('keeps valid entries and drops malformed ones', () => {
    const good = { id: '1', at: '2026-09-28T08:14:00Z', by: 'a@b', agency: 'KRC', changes: [] }
    expect(parseStoredHistory(JSON.stringify([good, { nope: true }]))).toEqual([good])
    expect(parseStoredHistory(null)).toEqual([])
  })

  it('ignores unreadable storage with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseStoredHistory('{broken')).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('buildPermissionExport', () => {
  it('has one page row per editable page with every layer and role', () => {
    const data = buildPermissionExport(EMPTY_OVERRIDES, 'KENHA', false)
    const total = editableModules().reduce((n, m) => n + editableRoutes(m).length, 0)
    expect(data.pages).toHaveLength(total)
    expect(data.roles).toEqual(['admin', 'analyst', 'operator'])
    expect(data.pages.find(p => p.page === '/fleet')).toMatchObject({ allowed: 'Read', enabled: 'Read', operator: 'Read' })
    expect(pageColumns(data).map(c => c.key)).toEqual(['module', 'moduleId', 'page', 'allowed', 'enabled', 'admin', 'analyst', 'operator'])
  })

  it('reflects the draft it is given', () => {
    const data = buildPermissionExport(ov({ KENHA: { enabled: { modules: { M02: 'none' } } } }), 'KENHA', true)
    expect(data.pages.find(p => p.page === '/traffic')!.enabled).toBe('None')
    expect(data.includesUnsavedChanges).toBe(true)
  })

  it('renders an escaped printable document', () => {
    const html = permissionsPrintHtml(buildPermissionExport(EMPTY_OVERRIDES, 'KENHA', true))
    expect(html).toContain('Kenya National Highways Authority (KENHA): module access')
    expect(html).toContain('Includes unsaved changes.')
    expect(html).not.toMatch(/<script/i)
  })
})
