<template>
  <!--
    Restricted data categories (RBAC spec section 6). Unchecked = the
    category's fields are masked on every page for this agency. Platform
    blocks are enforced at ingestion / by feature flag and can't be changed.
  -->
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">Data categories</div>
        <div class="card-subtitle">Unticked categories are masked on every page for this agency. Admin-only categories stay masked for analysts and operators regardless.</div>
      </div>
    </div>
    <div class="card-body table-scroll">
      <table class="access-table cat-table stack-table">
        <thead>
          <tr>
            <th scope="col" class="col-cat">Category</th>
            <th scope="col">Owner</th>
            <th scope="col">Protection</th>
            <th scope="col" class="col-check">Allowed</th>
            <th scope="col" class="col-check">Enabled</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[key, def] in categories" :key="key" :class="{ 'is-locked': isCategoryLocked(key) }">
            <td class="cat-cell stack-title">
              <span class="cat-label">{{ def.label }}</span>
              <code class="cat-key">{{ key }}</code>
            </td>
            <td data-label="Owner">
              <span class="owners">
                <span v-for="o in owners(def.owningAgency)" :key="o" class="badge badge-sm">{{ o }}</span>
              </span>
            </td>
            <td data-label="Protection">
              <span v-if="isCategoryLocked(key)" class="badge warning lock-badge" :title="`${enforcementLabel(def.enforcement)}. This can't be changed here.`">
                <Lock :size="11" aria-hidden="true" />{{ enforcementLabel(def.enforcement) }}
              </span>
              <span v-else class="protection">{{ enforcementLabel(def.enforcement) }}</span>
            </td>
            <td class="col-check" data-label="Allowed">
              <input
                type="checkbox" :checked="state('ceiling', key) === 'allow'"
                :disabled="!canEditCeiling || isCategoryLocked(key)"
                :aria-label="`${def.label}, allowed`" :data-testid="`cat-ceiling-${key}`"
                @change="ev => onBox(ev, 'ceiling', key)"
              />
            </td>
            <td class="col-check" data-label="Enabled">
              <input
                type="checkbox" :checked="state('enabled', key) === 'allow'"
                :disabled="!canEditEnabled || isCategoryLocked(key) || state('ceiling', key) === 'deny'"
                :aria-label="`${def.label}, enabled`" :data-testid="`cat-enabled-${key}`"
                @change="ev => onBox(ev, 'enabled', key)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import { BASE_SETTINGS, categoryState, isCategoryLocked, type PolicyOverrides } from '~/utils/resolveAccess'
import { enforcementLabel } from '~/utils/accessLabels'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const categories = Object.entries(BASE_SETTINGS.restrictedCategories)

function owners(owningAgency: string): string[] {
  if (owningAgency === 'all') return ['All agencies']
  return owningAgency.split(',').map(o => o.trim()).filter(Boolean)
}

function state(layer: EditableLayer, category: string) {
  return categoryState(props.overrides, props.code, layer, category)
}

/** Reset the box to the current state first; an accepted edit re-renders it (see AccessRolesTab). */
function onBox(ev: Event, layer: EditableLayer, category: string) {
  const wasAllowed = state(layer, category) === 'allow'
  ;(ev.target as HTMLInputElement).checked = wasAllowed
  emit('edit', { kind: 'category', layer, category, value: wasAllowed ? 'deny' : 'allow' })
}
</script>

<style scoped>
.table-scroll { overflow-x: auto; }
.cat-label { display: block; font-size: 12.5px; font-weight: 500; color: var(--fg-1); line-height: 1.4; }
.cat-key { font-family: var(--font-mono); font-size: 10.5px; font-weight: 400; color: var(--fg-3); }
.owners { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.protection { font-size: 12px; color: var(--fg-2); }
.lock-badge { gap: 4px; white-space: nowrap; }
.is-locked .cat-label { color: var(--fg-2); }
input[type="checkbox"] { accent-color: var(--primary-fill); width: 15px; height: 15px; cursor: pointer; }
input[type="checkbox"]:disabled { cursor: not-allowed; opacity: .45; }
/* Desktop only: at <=768px the shared .stack-table rules turn each row into a labelled record. */
@media (min-width: 769px) {
  .table-scroll.card-body { padding: 0; }
  .cat-table { min-width: 720px; }
  .cat-table td { vertical-align: middle; padding-top: 10px; padding-bottom: 10px; }
  .col-cat { width: 38%; }
  .col-check { width: 90px; text-align: center; }
  .cat-cell { white-space: normal; }
}
@media (max-width: 900px) { input[type="checkbox"] { width: 20px; height: 20px; } }
</style>
