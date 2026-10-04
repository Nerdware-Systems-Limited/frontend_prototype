<template>
  <!--
    WidgetState - the honest placeholder every widget shows when it has no
    data to draw. One wording per state, in the product's voice (plain,
    non-alarmist, "Centre" en-KE). Renders nothing for 'ready'/'partial'/
    'refreshing', which draw their data.
  -->
  <EmptyState
    v-if="show" compact :loading="state === 'loading'"
    :icon="state === 'empty' ? 'inbox' : 'dataset'"
    :class="['ws', `ws--${state}`]" :role="state === 'error' ? 'alert' : 'status'"
  >
    {{ message }}
    <template v-if="state === 'error'" #action>
      <button type="button" class="error-retry-btn" @click="emit('retry')">Retry</button>
    </template>
  </EmptyState>
</template>

<script setup lang="ts">
import type { WidgetDataState } from '~/composables/useWidgetData'

const props = withDefaults(defineProps<{
  state: WidgetDataState
  /** Who the data comes from, e.g. "NTSA IRSMS". */
  source?: string
  /** Message for 'empty' - say what is missing, e.g. "No fatality trend data for this period." */
  emptyText?: string
  /** Technical detail for 'error', appended after the plain sentence. */
  detail?: string | null
}>(), { source: 'This', emptyText: 'No data for this period.', detail: null })

const emit = defineEmits<{ retry: [] }>()

const SHOWN = new Set<WidgetDataState>(['idle', 'loading', 'empty', 'not-integrated', 'forbidden', 'error'])
const show = computed(() => SHOWN.has(props.state))

const message = computed(() => {
  switch (props.state) {
    case 'loading': return `Loading ${props.source} data…`
    case 'idle': return 'Nothing selected to show.'
    case 'empty': return props.emptyText
    case 'not-integrated': return `Not yet integrated - figures appear here once the ${props.source} feed is onboarded.`
    case 'forbidden': return `Your role doesn't have access to ${props.source} data.`
    case 'error': return `${props.source} feed unavailable - retry to refresh.${props.detail ? ` (${props.detail})` : ''}`
    default: return ''
  }
})
</script>

<style scoped>
.ws { height: 100%; }
</style>
