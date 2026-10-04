/**
 * accessExport - one agency's effective Module Access, as data for CSV / JSON
 * export and as a printable HTML document (the browser's print dialog turns
 * it into a PDF; there is no PDF library in this project).
 *
 * Values come from the draft passed in, so an export reflects exactly what
 * the page shows, including unsaved changes - the document says so.
 */

import {
  BASE_SETTINGS, CAPABILITIES, agencyRoleTiers, capabilitySet, categoryState, editableModules, editableRoutes,
  isCategoryLocked, pageScope, type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'
import { capabilityLabel, enforcementLabel } from '~/utils/accessLabels'

const LEVEL: Record<ScopeLevel, string> = { none: 'None', read: 'Read', full: 'Full' }

export interface PermissionExport {
  agency: string
  agencyName: string
  generatedAt: string
  includesUnsavedChanges: boolean
  roles: string[]
  pages: Record<string, string>[]
  categories: Record<string, string | boolean>[]
  capabilities: Record<string, string | boolean>[]
}

export function buildPermissionExport(ov: PolicyOverrides, code: string, includesUnsavedChanges: boolean): PermissionExport {
  const roles = agencyRoleTiers(code)
  const pages = editableModules().flatMap(moduleId => editableRoutes(moduleId).map(route => ({
    module: BASE_SETTINGS.modules[moduleId]?.label ?? moduleId,
    moduleId,
    page: route,
    allowed: LEVEL[pageScope(ov, code, 'ceiling', null, route)],
    enabled: LEVEL[pageScope(ov, code, 'enabled', null, route)],
    ...Object.fromEntries(roles.map(t => [t, LEVEL[pageScope(ov, code, 'role', t, route)]])),
  })))
  const categories = Object.entries(BASE_SETTINGS.restrictedCategories).map(([key, def]) => ({
    category: key,
    label: def.label,
    protection: enforcementLabel(def.enforcement),
    lockedPlatformWide: isCategoryLocked(key),
    allowed: categoryState(ov, code, 'ceiling', key) === 'allow' ? 'Visible' : 'Masked',
    enabled: categoryState(ov, code, 'enabled', key) === 'allow' ? 'Visible' : 'Masked',
  }))
  const allowedCaps = capabilitySet(ov, code, 'ceiling', null)
  const enabledCaps = capabilitySet(ov, code, 'enabled', null)
  const capabilities = CAPABILITIES.map(cap => ({
    capability: capabilityLabel(cap),
    id: cap,
    allowed: allowedCaps.has(cap),
    enabled: enabledCaps.has(cap),
    ...Object.fromEntries(roles.map(t => [t, capabilitySet(ov, code, 'role', t).has(cap)])),
  }))
  return {
    agency: code,
    agencyName: BASE_SETTINGS.agencies[code]?.name ?? code,
    generatedAt: new Date().toISOString(),
    includesUnsavedChanges,
    roles,
    pages,
    categories,
    capabilities,
  }
}

/** Column list for the CSV (one row per page). */
export function pageColumns(data: PermissionExport): { key: string; label: string }[] {
  return [
    { key: 'module', label: 'Module' },
    { key: 'moduleId', label: 'Module ID' },
    { key: 'page', label: 'Page' },
    { key: 'allowed', label: 'Allowed by super admin' },
    { key: 'enabled', label: 'Enabled for agency' },
    ...data.roles.map(t => ({ key: t, label: `${t.charAt(0).toUpperCase()}${t.slice(1)} role` })),
  ]
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]!))
}

/** A self-contained, print-styled HTML document for "Save as PDF". */
export function permissionsPrintHtml(data: PermissionExport): string {
  const cols = pageColumns(data)
  const when = new Date(data.generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
  const yesNo = (v: unknown) => (v ? 'Yes' : 'No')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(data.agency)} module access</title>
<style>
  body { font: 11px/1.45 Inter, system-ui, sans-serif; color: #111823; margin: 24px; }
  h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: .06em; color: #3F4C5C; }
  p { margin: 0 0 4px; color: #3F4C5C; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #D9E0EA; vertical-align: top; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #5B6773; border-bottom-color: #C3CDDA; }
  code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; }
  tr { break-inside: avoid; }
</style></head><body>
<h1>${esc(data.agencyName)} (${esc(data.agency)}): module access</h1>
<p>Generated ${esc(when)}${data.includesUnsavedChanges ? '. Includes unsaved changes.' : '.'}</p>
<h2>Pages</h2>
<table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
${data.pages.map(r => `<tr>${cols.map(c => `<td>${c.key === 'page' ? `<code>${esc(r[c.key])}</code>` : esc(r[c.key])}</td>`).join('')}</tr>`).join('\n')}
</tbody></table>
<h2>Data categories</h2>
<table><thead><tr><th>Category</th><th>Protection</th><th>Allowed</th><th>Enabled</th></tr></thead><tbody>
${data.categories.map(c => `<tr><td>${esc(c.label)}</td><td>${esc(c.protection)}${c.lockedPlatformWide ? ' (platform-wide)' : ''}</td><td>${esc(c.allowed)}</td><td>${esc(c.enabled)}</td></tr>`).join('\n')}
</tbody></table>
<h2>Capabilities</h2>
<table><thead><tr><th>Capability</th><th>Allowed</th><th>Enabled</th>${data.roles.map(t => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>
${data.capabilities.map(c => `<tr><td>${esc(c.capability)}</td><td>${yesNo(c.allowed)}</td><td>${yesNo(c.enabled)}</td>${data.roles.map(t => `<td>${yesNo(c[t])}</td>`).join('')}</tr>`).join('\n')}
</tbody></table>
</body></html>`
}
