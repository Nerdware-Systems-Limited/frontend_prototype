<template>
  <!--
    None / Read / Full selector for one module or page on one layer.
    The effective level is always the checked option, but how it is drawn says
    where it came from: an inherited level is a quiet blue wash, a level set on
    this layer is solid primary, so a table only lights up where someone made
    a change. A set value gets a reset control back to the inherited level
    (modelValue null). `max` disables options above what the layer above
    allows; a stored value already above `max` stays saved but is flagged
    "Capped" (spec: lowering a ceiling never rewrites lower layers).
  -->
  <div class="scope-toggle" :class="{ compact, 'is-readonly': disabled }">
    <div class="scope-seg" role="radiogroup" :aria-label="label">
      <button
        v-for="(opt, idx) in OPTIONS" :key="opt"
        :ref="(el: Element | ComponentPublicInstance | null) => { buttonRefs[idx] = el as HTMLButtonElement | null }"
        type="button" role="radio" class="scope-opt"
        :class="{ 'is-set': modelValue === opt, 'is-inherited': modelValue === null && inheritedScope === opt }"
        :aria-checked="effective === opt" :aria-label="optionAriaLabel(opt)"
        :tabindex="tabIndexFor(opt)" :disabled="isDisabled(opt)" :title="titleFor(opt)" :data-scope="opt"
        @click="choose(opt)" @keydown="onKeydown($event, idx)"
      >{{ LABELS[opt] }}</button>
    </div>
    <button
      v-if="allowInherit && modelValue !== null && !disabled"
      type="button" class="scope-reset" data-scope="inherit"
      :aria-label="`Use inherited level${inheritedLabel ? ` (${inheritedLabel})` : ''}`"
      :title="`Use inherited level${inheritedLabel ? ` (${inheritedLabel})` : ''}`"
      @click="emit('update:modelValue', null)"
    ><RotateCcw :size="13" aria-hidden="true" /></button>
    <span v-if="capped" class="badge warning badge-sm" :title="`Saved as ${modelValue}, limited to ${max} by the level above`">Capped</span>
    <span v-else-if="modelValue === null && inheritedLabel === 'mixed'" class="badge badge-sm" title="Pages in this module are set differently - expand to see them">Mixed</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { scopeRank, type ScopeLevel } from '~/utils/resolveAccess'

const OPTIONS: ScopeLevel[] = ['none', 'read', 'full']
const LABELS: Record<ScopeLevel, string> = { none: 'None', read: 'Read', full: 'Full' }

const props = withDefaults(defineProps<{
  modelValue: ScopeLevel | null
  label: string
  max?: ScopeLevel
  allowInherit?: boolean
  /** The inherited level ('none' | 'read' | 'full'), or 'mixed' when a module's pages differ. */
  inheritedLabel?: string
  disabled?: boolean
  compact?: boolean
}>(), { max: 'full', allowInherit: false, inheritedLabel: '', disabled: false, compact: false })

const emit = defineEmits<{ 'update:modelValue': [ScopeLevel | null] }>()

const buttonRefs = ref<(HTMLButtonElement | null)[]>([])

const inheritedScope = computed<ScopeLevel | null>(() =>
  OPTIONS.includes(props.inheritedLabel as ScopeLevel) ? (props.inheritedLabel as ScopeLevel) : null,
)
/** What this layer resolves to: its own value, else the inherited one (none when mixed / unknown). */
const effective = computed<ScopeLevel | null>(() => props.modelValue ?? inheritedScope.value)
const capped = computed(() => !!props.modelValue && scopeRank(props.modelValue) > scopeRank(props.max))

function aboveMax(opt: ScopeLevel) {
  return scopeRank(opt) > scopeRank(props.max)
}
function isDisabled(opt: ScopeLevel) {
  return props.disabled || aboveMax(opt)
}
function titleFor(opt: ScopeLevel) {
  if (props.disabled) return 'Read-only for your role'
  if (aboveMax(opt)) return `Not available - the level above allows at most ${LABELS[props.max]}`
  return undefined
}
function optionAriaLabel(opt: ScopeLevel) {
  if (props.modelValue === null && inheritedScope.value === opt) return `${LABELS[opt]} (inherited)`
  return LABELS[opt]
}
function choose(opt: ScopeLevel) {
  if (isDisabled(opt)) return
  emit('update:modelValue', opt)
}

/** Roving tab stop: the checked option, or the first enabled one when that isn't reachable. */
function tabIndexFor(opt: ScopeLevel): number {
  if (isDisabled(opt)) return -1
  const current = effective.value
  if (current && !isDisabled(current)) return current === opt ? 0 : -1
  return OPTIONS.find(o => !isDisabled(o)) === opt ? 0 : -1
}

function onKeydown(event: KeyboardEvent, idx: number) {
  if (props.disabled) return
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  let next = idx
  do {
    next = (next + step + OPTIONS.length) % OPTIONS.length
  } while (isDisabled(OPTIONS[next]!) && next !== idx)
  choose(OPTIONS[next]!)
  buttonRefs.value[next]?.focus()
}
</script>

<style scoped>
.scope-toggle { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.scope-seg {
  display: inline-flex;
  border: 1px solid var(--border-interactive); border-radius: var(--r-sm); overflow: hidden;
  background: var(--surface-2);
}
.scope-opt {
  min-width: 46px; padding: 4px 10px;
  background: transparent; border: 0; border-right: 1px solid var(--border-subtle);
  font-family: inherit; font-size: 11.5px; font-weight: 500; line-height: 1.3; color: var(--fg-2); cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.scope-opt:last-child { border-right: 0; }
.compact .scope-opt { min-width: 40px; padding: 3px 8px; font-size: 11px; }
.scope-opt:hover:not(:disabled):not(.is-set) { background: var(--surface-quiet); color: var(--fg-1); }
.scope-opt:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.scope-opt.is-inherited { background: var(--primary-wash); color: var(--primary); font-weight: 600; }
.scope-opt.is-set { background: var(--primary-fill); color: #fff; font-weight: 600; }
.scope-opt:disabled { cursor: not-allowed; color: var(--fg-3); opacity: .45; }
/* Read-only: keep the current level legible, quieten the rest. */
.is-readonly .scope-seg { border-color: var(--border-subtle); }
.is-readonly .scope-opt:disabled { cursor: default; }
.is-readonly .scope-opt.is-set:disabled,
.is-readonly .scope-opt.is-inherited:disabled { opacity: 1; }
.is-readonly .scope-opt.is-set:disabled { background: var(--primary-wash-strong); color: var(--primary); }

.scope-reset {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  background: transparent; border: 1px solid transparent; border-radius: var(--r-sm);
  color: var(--fg-3); cursor: pointer;
  transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.scope-reset:hover { color: var(--primary); border-color: var(--border-interactive); }
.scope-reset:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }

@media (max-width: 900px) {
  .scope-opt { min-height: 34px; }
  .scope-reset { width: 34px; height: 34px; }
}
</style>
