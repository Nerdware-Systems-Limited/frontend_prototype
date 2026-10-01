<template>
  <!--
    Role permissions: what each role inside the agency may reach (capped at
    the agency's Enabled level), then one capability matrix - the agency's
    Allowed / Enabled sets next to each role's own set (capped at Enabled).
  -->
  <div class="roles-tab">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Pages by role</div>
          <div class="card-subtitle">
            <template v-if="filtering">{{ visible.length }} of {{ modules.length }} modules match.</template>
            A role can never exceed what the agency has enabled.
          </div>
        </div>
        <AccessScopeLegend />
      </div>
      <div class="card-body table-scroll">
        <table class="access-table role-grid stack-table">
          <thead>
            <tr>
              <th scope="col" class="col-module">Module</th>
              <th v-for="t in tiers" :key="t" scope="col">{{ t }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!visible.length">
              <td :colspan="tiers.length + 1" class="empty-row">No modules or pages match these filters.</td>
            </tr>
            <template v-for="{ moduleId: m, routes } in visible" :key="m">
              <tr class="module-row">
                <td class="stack-title">
                  <AccessModuleCell :module-id="m" :label="label(m)" :expanded="isOpen(m)" @toggle="toggle(m)" />
                </td>
                <td v-for="t in tiers" :key="t" :data-testid="`role-${t}-${m}`" :data-label="t">
                  <AccessScopeToggle
                    compact allow-inherit
                    :model-value="rawRole(t, m)" :inherited-label="roleInherited(t, m)"
                    :max="moduleSummary(overrides, code, 'enabled', null, m).scope"
                    :disabled="!canEditEnabled" :label="`${label(m)} for ${t}`"
                    @update:model-value="v => emit('edit', { kind: 'roleScope', tier: t, key: m, value: v })"
                  />
                </td>
              </tr>
              <template v-if="isOpen(m)">
                <tr v-for="r in shownRoutes(m, routes)" :key="r" class="page-row">
                  <td class="page-cell stack-title"><code>{{ r }}</code></td>
                  <td v-for="t in tiers" :key="t" :data-testid="`role-${t}-${r}`" :data-label="t">
                    <AccessScopeToggle
                      compact allow-inherit
                      :model-value="rawRole(t, r)"
                      :inherited-label="pageScope(overrides, code, 'role', t, r, { layer: 'role', key: 'route' })"
                      :max="pageScope(overrides, code, 'enabled', null, r)"
                      :disabled="!canEditEnabled" :label="`${r} for ${t}`"
                      @update:model-value="v => emit('edit', { kind: 'roleScope', tier: t, key: r, value: v })"
                    />
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Capabilities</div>
          <div class="card-subtitle">Reflected in Preview and applied to the export, query builder and user management controls.</div>
        </div>
      </div>
      <div class="table-scroll">
        <table class="access-table cap-table">
          <thead>
            <tr class="group-row">
              <th scope="col" rowspan="2" class="col-cap">Capability</th>
              <th scope="colgroup" colspan="2" class="group-start">Agency</th>
              <th scope="colgroup" :colspan="tiers.length" class="group-start">Roles</th>
            </tr>
            <tr>
              <th scope="col" class="group-start">Allowed</th>
              <th scope="col">Enabled</th>
              <th v-for="(t, i) in tiers" :key="t" scope="col" :class="{ 'group-start': i === 0 }">{{ t }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in CAPABILITIES" :key="c">
              <th scope="row" class="cap-name">{{ capabilityLabel(c) }}</th>
              <td class="group-start">
                <input
                  type="checkbox" :checked="ceilingCaps.has(c)" :disabled="!canEditCeiling"
                  :aria-label="`${capabilityLabel(c)}, allowed`" :data-testid="`cap-ceiling-${c}`"
                  @change="ev => onBox(ev, ceilingCaps.has(c), () => toggleAgencyCap('ceiling', c))"
                />
              </td>
              <td>
                <input
                  type="checkbox" :checked="enabledCaps.has(c)" :disabled="!canEditEnabled || !ceilingCaps.has(c)"
                  :aria-label="`${capabilityLabel(c)}, enabled`" :data-testid="`cap-enabled-${c}`"
                  @change="ev => onBox(ev, enabledCaps.has(c), () => toggleAgencyCap('enabled', c))"
                />
              </td>
              <td v-for="(t, i) in tiers" :key="t" :class="{ 'group-start': i === 0 }">
                <input
                  type="checkbox" :checked="roleCaps(t).has(c)" :disabled="!canEditEnabled || !enabledCaps.has(c)"
                  :aria-label="`${capabilityLabel(c)} for ${t}`" :data-testid="`cap-${t}-${c}`"
                  @change="ev => onBox(ev, roleCaps(t).has(c), () => toggleRoleCap(t, c))"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  BASE_SETTINGS, CAPABILITIES, agencyRoleTiers, capabilitySet, editableModules, editableRoutes, moduleSummary, pageScope,
  type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'
import { capabilityLabel } from '~/utils/accessLabels'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'
import { EMPTY_FILTER, filterModules, isFilterActive, type ModuleFilter } from '~/utils/accessFilter'
import { useRoles } from '~/composables/api'
import type { Role } from '~/types/uapts'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
  filter?: ModuleFilter
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const modules = editableModules()

// Custom, per-agency roles (Roles & Permissions page) are a more specific
// key into this same per-agency "roles" override layer - see the backend's
// Role model docstring. Fetched once (agency-scoped server-side for an
// agency admin, every agency for a super_admin) and filtered per `code`
// here rather than re-fetched on every agency switch.
const allRoles = ref<Role[]>([])
onMounted(async () => {
  try { allRoles.value = (await useRoles().list({ page_size: 200 })).results } catch { /* custom tiers just won't show */ }
})
const customTierNames = computed(() =>
  allRoles.value.filter(r => r.base_tier && r.agency_code?.toUpperCase() === props.code.toUpperCase()).map(r => r.role_name),
)
const tiers = computed<string[]>(() => [...agencyRoleTiers(props.code), ...customTierNames.value])

const activeFilter = computed(() => props.filter ?? EMPTY_FILTER)
const filtering = computed(() => isFilterActive(activeFilter.value))
/** On this tab a module or page counts as custom when any role sets it explicitly. */
const visible = computed(() => filterModules(
  props.overrides, props.code, activeFilter.value,
  key => tiers.value.some(t => rawRole(t, key) !== null),
  !props.canEditCeiling,
))

// While filtering, matching modules start open; the set then records the ones
// the user closed. Changing the filter resets it (same as AccessAgencyTab).
const expanded = ref(new Set<string>())
watch(activeFilter, () => { expanded.value = new Set() }, { deep: true })
function isOpen(m: string) {
  return filtering.value ? !expanded.value.has(m) : expanded.value.has(m)
}
function shownRoutes(m: string, matched: string[]) {
  return filtering.value ? matched : editableRoutes(m)
}

const ceilingCaps = computed(() => capabilitySet(props.overrides, props.code, 'ceiling', null))
const enabledCaps = computed(() => capabilitySet(props.overrides, props.code, 'enabled', null))
function roleCaps(tier: string) {
  return capabilitySet(props.overrides, props.code, 'role', tier)
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
function rawRole(tier: string, key: string): ScopeLevel | null {
  const l = props.overrides.agencies[props.code]?.roles?.[tier]
  return (key.startsWith('/') ? l?.routes?.[key] : l?.modules?.[key]) ?? null
}
function roleInherited(tier: string, m: string): string {
  const s = moduleSummary(props.overrides, props.code, 'role', tier, m, { layer: 'role', key: 'module' })
  return s.mixed ? 'mixed' : s.scope
}

function toggled(set: Set<string>, c: string): string[] {
  const next = new Set(set)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  return [...next]
}
/**
 * Put the checkbox back to its current state before emitting: if the page
 * rejects the edit (e.g. the self-lockout guard), the DOM would otherwise
 * show a change that never happened. An accepted edit re-renders `checked`.
 */
function onBox(ev: Event, wasChecked: boolean, apply: () => void) {
  (ev.target as HTMLInputElement).checked = wasChecked
  apply()
}
function toggleAgencyCap(layer: EditableLayer, c: string) {
  emit('edit', { kind: 'capabilities', layer, caps: toggled(layer === 'ceiling' ? ceilingCaps.value : enabledCaps.value, c) })
}
function toggleRoleCap(tier: string, c: string) {
  emit('edit', { kind: 'roleCapabilities', tier, caps: toggled(roleCaps(tier), c) })
}
</script>

<style scoped>
.roles-tab { display: flex; flex-direction: column; gap: 16px; }
.table-scroll { overflow-x: auto; }
.empty-row { padding: 28px 16px; text-align: center; font-size: 12.5px; color: var(--fg-3); }
.page-cell code { font-family: var(--font-mono); font-size: 11px; color: var(--fg-2); }
.page-row td { background: var(--surface-1); }
/* Desktop only: at <=768px the shared .stack-table rules turn each role-grid row into a labelled record. */
@media (min-width: 769px) {
  .table-scroll.card-body { padding: 0; }
  .role-grid { min-width: 640px; }
  .role-grid td { vertical-align: middle; padding-top: 9px; padding-bottom: 9px; }
  .col-module { width: 30%; }
  .page-row td { padding-top: 6px; padding-bottom: 6px; }
  .page-cell { padding-left: 33px; }
}

/* The capability matrix stays a matrix (it reads by column) and scrolls inside its card on phones. */
.cap-table { min-width: 520px; }
.cap-table td { text-align: center; vertical-align: middle; padding-top: 9px; padding-bottom: 9px; }
.cap-table thead th:not(.col-cap) { text-align: center; }
.cap-table .group-row th { border-bottom-color: var(--border-subtle); }
.col-cap { width: 34%; vertical-align: bottom; }
.cap-name { font-size: 12.5px; font-weight: 500; color: var(--fg-1); text-transform: none; letter-spacing: 0; background: transparent; white-space: normal; }
.group-start { border-left: 1px solid var(--border-subtle); }
input[type="checkbox"] { accent-color: var(--primary-fill); width: 15px; height: 15px; cursor: pointer; }
input[type="checkbox"]:disabled { cursor: not-allowed; opacity: .45; }
@media (max-width: 900px) { input[type="checkbox"] { width: 20px; height: 20px; } }
</style>
