<template>
  <!--
    VizShell - what every chart primitive sits in:
      - a legend row (slot) and a Chart / Table toggle, so every value is
        reachable without hovering and low-contrast series have their
        relief (dataviz: a contrast WARN obligates a table view);
      - the chart itself (the primitive labels it and announces readouts);
      - the same Frame as a visually hidden table for screen readers.
    The toggle is a plain state swap - no animation; it's a view switch.
  -->
  <div class="vs" :class="`vs--${size}`">
    <div v-if="showBar" class="vs-bar">
      <div class="vs-legend"><slot name="legend" /></div>
      <button
        type="button" class="vs-toggle" :aria-pressed="asTable"
        :aria-label="asTable ? 'Show as chart' : 'Show as table'" :title="asTable ? 'Show as chart' : 'Show as table'"
        @click="asTable = !asTable"
      >
        <component :is="asTable ? ChartNoAxesColumn : Table2" :size="13" aria-hidden="true" />
      </button>
    </div>

    <VizTable
      v-if="asTable" class="vs-body" :frame="frame" :size="size === 'xs' ? 's' : size"
      :key-field="keyField" :selectable="selectable" :is-picked="isPicked" :is-dimmed="isDimmed"
      @pick="k => emit('pick', k)"
    />
    <template v-else>
      <div class="vs-body">
        <slot />
      </div>
      <div class="vs-sr">
        <VizTable :frame="frame" size="m" :caption="summary" :max-rows="1000" :interactive="false" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChartNoAxesColumn, Table2 } from 'lucide-vue-next'
import type { Frame } from '~/types/frame'
import type { SizeClass } from '~/utils/viz'
import VizTable from './VizTable.vue'

withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  /** One sentence describing the chart for assistive tech. */
  summary: string
  /** Hide the legend/toggle row (xs headline forms). */
  showBar?: boolean
  keyField?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
}>(), { showBar: true, keyField: undefined, selectable: false, isPicked: () => false, isDimmed: () => false })

const emit = defineEmits<{ pick: [key: string] }>()
const asTable = ref(false)
</script>

<style scoped>
.vs { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 6px; }
.vs-bar { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.vs-legend { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10.5px; color: var(--fg-2); }
.vs-toggle {
  display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 22px; flex-shrink: 0;
  border: 1px solid var(--border-subtle); border-radius: var(--r-xs); background: var(--surface-2); color: var(--fg-3); cursor: pointer;
  transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.vs-toggle[aria-pressed="true"] { color: var(--primary); border-color: var(--primary); background: var(--primary-wash); }
.vs-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .vs-toggle:hover { color: var(--fg-1); border-color: var(--border-interactive); }
}
.vs-body { flex: 1; min-height: 0; position: relative; }
.vs-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
</style>
