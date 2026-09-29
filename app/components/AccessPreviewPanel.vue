<template>
  <!-- Drawer content: what one role at this agency would reach with the current (unsaved) draft, via the real resolver. -->
  <div class="preview-panel">
    <label class="preview-role">
      <span class="filter-label">Role</span>
      <select v-model="chosenTier" class="select-sm preview-select">
        <option v-for="t in tiers" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <p class="preview-count"><span class="num">{{ pageCount }}</span> {{ pageCount === 1 ? 'page' : 'pages' }} reachable</p>
    <p v-if="!groups.length" class="preview-empty">This role can't open any module pages. It still sees the restricted dashboard.</p>
    <section v-for="g in groups" :key="g.moduleId" class="preview-group">
      <h3 class="preview-module">{{ g.label }}</h3>
      <ul class="preview-list">
        <li v-for="p in g.pages" :key="p.route" class="preview-item">
          <code>{{ p.route }}</code>
          <span class="badge badge-sm" :class="{ info: p.scope === 'full' }">{{ p.scope === 'full' ? 'Full' : 'Read' }}</span>
        </li>
      </ul>
    </section>
    <section class="preview-caps">
      <h3 class="preview-module">Capabilities</h3>
      <p class="preview-caps-list">{{ caps.length ? caps.join(', ') : 'None' }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BASE_SETTINGS, agencyRoleTiers, capabilitiesFor, editableModules, editableRoutes, resolveFor, type PolicyOverrides,
} from '~/utils/resolveAccess'
import { capabilityLabel } from '~/utils/accessLabels'

const props = defineProps<{ code: string; overrides: PolicyOverrides }>()

const tiers = computed(() => agencyRoleTiers(props.code))
const pickedTier = ref<string | null>(null)
// Falls back to the most-privileged tier when the pick doesn't exist at a newly selected agency.
const chosenTier = computed({
  get: () => (pickedTier.value && tiers.value.includes(pickedTier.value as any) ? pickedTier.value : tiers.value[0] ?? 'admin'),
  set: (t: string) => { pickedTier.value = t },
})

const subject = computed(() => ({ agency_code: props.code, role_type: chosenTier.value }))
const groups = computed(() =>
  editableModules()
    .map(moduleId => ({
      moduleId,
      label: BASE_SETTINGS.modules[moduleId]?.label ?? moduleId,
      pages: editableRoutes(moduleId)
        .map(route => ({ route, res: resolveFor(props.overrides, subject.value, route) }))
        .filter(p => p.res.allowed)
        .map(p => ({ route: p.route, scope: p.res.scopeLevel })),
    }))
    .filter(g => g.pages.length),
)
const pageCount = computed(() => groups.value.reduce((n, g) => n + g.pages.length, 0))
const caps = computed(() => [...capabilitiesFor(props.overrides, subject.value)].map(capabilityLabel).sort())
</script>

<style scoped>
.preview-role { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.preview-select { flex: 0 1 200px; }
.preview-count { font-size: 12px; color: var(--fg-2); margin: 0 0 12px; }
.preview-count .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 600; color: var(--fg-1); }
.preview-empty { font-size: 12px; color: var(--fg-3); margin: 0; }
.preview-group + .preview-group, .preview-caps { margin-top: 14px; }
.preview-module {
  margin: 0 0 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--fg-3);
}
.preview-list { list-style: none; margin: 0; padding: 0; }
.preview-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 5px 0; border-top: 1px solid var(--border-subtle);
}
.preview-item code { font-family: var(--font-mono); font-size: 11px; color: var(--fg-2); overflow-wrap: anywhere; }
.preview-caps-list { margin: 0; font-size: 12.5px; color: var(--fg-2); line-height: 1.5; }
</style>
