<template>
  <!--
    CollapsibleSection - one header you click to show or hide a block of the page.

    Used for maps (collapsed by default, so a landing page opens on its numbers
    and a map costs nothing until someone asks for it) and for incident lists
    (open by default, so the count and severity stay visible while the detail
    can be folded away).

    - The body is mounted the first time the section opens and then only
      hidden (`v-show`), never destroyed. A map keeps its zoom, layers and
      selection, a list keeps its filter and scroll, across collapse and reopen.
    - `storageKey` keeps the open/closed choice for the rest of the session
      (navigating to another page and back), but a reload starts from
      `defaultOpen` again.
    - Everything the header needs to say while closed (a count, a status) goes
      in `count` / `tone` / the `meta` slot, so it stays visible when folded.
    - The toggle is a real button: keyboard operable, `aria-expanded`, and the
      chevron is the only motion (a transform, off under reduced motion).
  -->
  <section ref="rootEl" class="cs" :class="{ 'cs--open': isOpen, 'cs--plain': plain }">
    <div class="cs-head">
      <component :is="`h${headingLevel}`" class="cs-heading">
        <button
          type="button" class="cs-toggle"
          :aria-expanded="isOpen" :aria-controls="bodyId"
          @click="toggle"
        >
          <ChevronDown class="cs-chevron" :size="16" aria-hidden="true" />
          <span class="cs-title"><slot name="title">{{ title }}</slot></span>
          <span v-if="count != null && count !== ''" class="badge cs-count" :class="tone">{{ count }}</span>
          <span v-if="source" class="cs-source">{{ source }}</span>
          <slot name="meta" />
          <span class="cs-hint">{{ isOpen ? 'Hide' : 'Show' }}</span>
        </button>
      </component>
      <div v-if="$slots.actions" class="cs-actions"><slot name="actions" /></div>
    </div>

    <div v-if="mounted" v-show="isOpen" :id="bodyId" class="cs-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  title?: string
  /** A figure shown in the header while closed, e.g. the number of active incidents. */
  count?: number | string | null
  /** Colour of the count: the severity of what is inside. */
  tone?: '' | 'success' | 'warning' | 'danger' | 'info'
  defaultOpen?: boolean
  /** Remember the open state for this session under this key. */
  storageKey?: string
  /** Mount the body immediately even while closed (default: on first open). */
  eager?: boolean
  headingLevel?: 2 | 3 | 4
  /** Where the data comes from, shown beside the title, e.g. "KMA · Live". */
  source?: string
  /** Draw its own bordered header (for sections that are not already inside a `.card`). */
  plain?: boolean
}>(), { title: '', count: null, tone: '', defaultOpen: false, storageKey: '', eager: false, headingLevel: 3, plain: false, source: '' })

const emit = defineEmits<{ toggle: [open: boolean] }>()

const local = ref(props.defaultOpen)
// A keyed section shares its state with every other copy of that key for the session.
const shared = props.storageKey ? useState<boolean>(`collapse:${props.storageKey}`, () => props.defaultOpen) : null
const isOpen = computed(() => (shared ? shared.value : local.value))

const mounted = ref(props.eager || isOpen.value)
const bodyId = `cs-${Math.random().toString(36).slice(2, 9)}`

function set(next: boolean) {
  if (shared) shared.value = next
  else local.value = next
  if (next) {
    mounted.value = true
    // Anything that measures itself (maps, charts) has just gone from 0 to its real size.
    if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
  }
  emit('toggle', next)
}
function toggle() { set(!isOpen.value) }

watch(isOpen, (open) => { if (open) mounted.value = true })

// A KPI card that drills to something inside this section asks for it to be shown first.
const rootEl = ref<HTMLElement | null>(null)
function onReveal(e: Event) {
  const id = (e as CustomEvent<{ id?: string }>).detail?.id
  const target = id ? document.getElementById(id) : null
  if (target && rootEl.value?.contains(target) && !isOpen.value) set(true)
}
onMounted(() => window.addEventListener('uapts:reveal', onReveal))
onBeforeUnmount(() => window.removeEventListener('uapts:reveal', onReveal))

defineExpose({ open: () => set(true), close: () => set(false), toggle })
</script>

<style scoped>
.cs-head { display: flex; align-items: center; gap: 8px; }
.cs-heading { flex: 1 1 auto; min-width: 0; margin: 0; font-size: inherit; font-weight: inherit; }
.cs-toggle {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
  padding: 8px 16px; margin: 0; border: 0; border-radius: 0; background: var(--surface-1); color: var(--fg-2);
  font: 600 12px/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: .04em; text-align: left; cursor: pointer;
}
.cs-toggle:hover { background: var(--surface-quiet); color: var(--fg-1); }
.cs-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.cs-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-chevron { flex-shrink: 0; color: var(--fg-3); transform: rotate(-90deg); transition: transform var(--dur-fast, .12s) var(--ease-standard, ease); }
.cs--open > .cs-head .cs-chevron { transform: rotate(0deg); }
.cs-source { flex-shrink: 0; font-size: 10px; font-weight: 500; letter-spacing: .04em; text-transform: none; color: var(--fg-3); }
.cs-count { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.cs-hint { margin-left: auto; flex-shrink: 0; font-size: 10px; font-weight: 500; letter-spacing: .06em; color: var(--fg-3); }
.cs-actions { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding-right: 12px; }
.cs--open > .cs-head { border-bottom: 1px solid var(--border-subtle); }
.cs--plain > .cs-head { border: 1px solid var(--border-subtle); border-radius: var(--r-md, 8px); overflow: hidden; background: var(--surface-1); }
.cs--plain > .cs-head .cs-toggle { background: transparent; }
.cs--plain > .cs-body { margin-top: 12px; }
.cs-head .cs-actions { background: var(--surface-1); align-self: stretch; }
@media (max-width: 600px) { .cs-hint, .cs-source { display: none; } .cs-toggle { padding: 8px 12px; } }
@media (prefers-reduced-motion: reduce) { .cs-chevron { transition: none; } }
</style>
