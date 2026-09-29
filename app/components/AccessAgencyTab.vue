<template>
  <!--
    Agency access: what the agency may have (Allowed - super_admin) and what
    it has switched on within that (Enabled - its own admin). Module rows set
    every page at once; expanding a module exposes per-page overrides.
  -->
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">Modules and pages</div>
        <div class="card-subtitle">
          <template v-if="filtering">{{ visible.length }} of {{ modules.length }} modules match.</template>
          Enabled can never exceed Allowed. Open a module to set its pages individually.
        </div>
      </div>
      <AccessScopeLegend />
    </div>
    <div class="card-body table-scroll">
      <table class="access-table stack-table">
        <colgroup><col class="col-module" /><col /><col /></colgroup>
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col">Allowed by super admin</th>
            <th scope="col">Enabled for agency</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!visible.length">
            <td colspan="3" class="empty-row">No modules or pages match these filters.</td>
          </tr>
          <template v-for="{ moduleId: m, routes } in visible" :key="m">
            <tr class="module-row">
              <td class="stack-title">
                <AccessModuleCell
                  :module-id="m" :label="label(m)" :expanded="isOpen(m)"
                  :hint="!raw('ceiling', m) && ceilingScope(m) !== 'none' && domainLabel(m) ? `${domainLabel(m)} bundle` : null"
                  @toggle="toggle(m)"
                />
              </td>
              <td :data-testid="`ceiling-${m}`" data-label="Allowed by super admin">
                <AccessScopeToggle
                  :model-value="raw('ceiling', m)" allow-inherit
                  :inherited-label="moduleInherited('ceiling', m)"
                  :disabled="!canEditCeiling" :label="`${label(m)}, allowed`"
                  @update:model-value="v => emitScope('ceiling', m, v)"
                />
              </td>
              <td :data-testid="`enabled-${m}`" data-label="Enabled for agency">
                <AccessScopeToggle
                  :model-value="raw('enabled', m)" allow-inherit
                  :inherited-label="moduleInherited('enabled', m)"
                  :max="ceilingScope(m)"
                  :disabled="!canEditEnabled" :label="`${label(m)}, enabled`"
                  @update:model-value="v => emitScope('enabled', m, v)"
                />
              </td>
            </tr>
            <template v-if="isOpen(m)">
              <tr v-for="r in shownRoutes(m, routes)" :key="r" class="page-row">
                <td class="page-cell stack-title"><code>{{ r }}</code></td>
                <td :data-testid="`ceiling-${r}`" data-label="Allowed by super admin">
                  <AccessScopeToggle
                    :model-value="raw('ceiling', r)" allow-inherit compact
                    :inherited-label="pageScope(overrides, code, 'ceiling', null, r, { layer: 'ceiling', key: 'route' })"
                    :disabled="!canEditCeiling" :label="`${r}, allowed`"
                    @update:model-value="v => emitScope('ceiling', r, v)"
                  />
                </td>
                <td :data-testid="`enabled-${r}`" data-label="Enabled for agency">
                  <AccessScopeToggle
                    :model-value="raw('enabled', r)" allow-inherit compact
                    :inherited-label="pageScope(overrides, code, 'enabled', null, r, { layer: 'enabled', key: 'route' })"
                    :max="pageScope(overrides, code, 'ceiling', null, r)"
                    :disabled="!canEditEnabled" :label="`${r}, enabled`"
                    @update:model-value="v => emitScope('enabled', r, v)"
                  />
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  BASE_SETTINGS, editableModules, editableRoutes, inheritedDomainLabel, moduleSummary, pageScope,
  type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'
import { EMPTY_FILTER, filterModules, isFilterActive, type ModuleFilter } from '~/utils/accessFilter'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
  filter?: ModuleFilter
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const modules = editableModules()
const activeFilter = computed(() => props.filter ?? EMPTY_FILTER)
const filtering = computed(() => isFilterActive(activeFilter.value))
/** A module or page counts as custom when either layer on this tab sets it explicitly. */
const visible = computed(() => filterModules(
  props.overrides, props.code, activeFilter.value,
  key => raw('ceiling', key) !== null || raw('enabled', key) !== null,
))

// While filtering, matching modules start open (so "fleet" shows its pages);
// the set then records the ones the user closed. Changing the filter resets it.
const expanded = ref(new Set<string>())
watch(activeFilter, () => { expanded.value = new Set() }, { deep: true })
function isOpen(m: string) {
  return filtering.value ? !expanded.value.has(m) : expanded.value.has(m)
}
function shownRoutes(m: string, matched: string[]) {
  return filtering.value ? matched : editableRoutes(m)
}

function toggle(m: string) {
  const next = new Set(expanded.value)
  if (next.has(m)) next.delete(m)
  else next.add(m)
  expanded.value = next
}
function label(m: string) {
  return BASE_SETTINGS.modules[m]?.label ?? m
}
function domainLabel(m: string) {
  return inheritedDomainLabel(props.code, m)
}
/** The domain-bundle hint is only meaningful when that bundle actually grants the module - not when denies/other layers left it at 'none'. */
function ceilingScope(m: string): ScopeLevel {
  return moduleSummary(props.overrides, props.code, 'ceiling', null, m).scope
}
function raw(layer: EditableLayer, key: string): ScopeLevel | null {
  const l = props.overrides.agencies[props.code]?.[layer]
  return (key.startsWith('/') ? l?.routes?.[key] : l?.modules?.[key]) ?? null
}
function moduleInherited(layer: EditableLayer, m: string): string {
  const s = moduleSummary(props.overrides, props.code, layer, null, m, { layer, key: 'module' })
  return s.mixed ? 'mixed' : s.scope
}
function emitScope(layer: EditableLayer, key: string, value: ScopeLevel | null) {
  emit('edit', { kind: 'scope', layer, key, value })
}
</script>

<style scoped>
.table-scroll { overflow-x: auto; }
.empty-row { padding: 28px 16px; text-align: center; font-size: 12.5px; color: var(--fg-3); }
.page-cell code { font-family: var(--font-mono); font-size: 11px; color: var(--fg-2); }
.page-row td { background: var(--surface-1); }
/* Desktop only: at <=768px the shared .stack-table rules turn each row into a labelled record. */
@media (min-width: 769px) {
  .table-scroll.card-body { padding: 0; }
  .access-table { min-width: 660px; }
  .access-table td { vertical-align: middle; padding-top: 10px; padding-bottom: 10px; }
  .col-module { width: 36%; }
  .page-row td { padding-top: 6px; padding-bottom: 6px; }
  .page-cell { padding-left: 33px; }
}
</style>
