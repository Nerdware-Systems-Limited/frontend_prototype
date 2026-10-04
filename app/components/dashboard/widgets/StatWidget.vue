<template>
  <!--
    Generic stat: any binding with shape 'scalar', drawn as the system's
    KpiCard. Status comes from the binding's shared threshold, if it has one.
  -->
  <KpiCard
    :label="label" :value="view.value" :unit="view.unit" :unit-title="view.unitTitle"
    :description="description" :period="period" :status="view.status"
    :unavailable="view.unavailable" :unavailable-reason="view.reason"
    :loading="state === 'loading'" :prominent="!!config.prominent" :to="(config.to as string) || ''"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { statusOf } from '~/utils/thresholds'
import { formatParts } from '~/utils/units'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { binding, frame, state, sourceLabel } = useBoundFrame(() => props.instance, () => props.config)

const label = computed(() => String(props.config.label || props.instance.title || binding.value?.measures[0]?.label || 'Metric'))
const description = computed(() => String(props.config.description ?? ''))
const period = computed(() => String(props.config.period ?? ''))

const REASON: Partial<Record<string, string>> = {
  'not-integrated': 'Not yet integrated - appears once the feed is onboarded',
  'forbidden': "Your role doesn't have access to this data",
  'empty': 'Not reported by the feed yet',
  'idle': 'No metric selected',
}

const view = computed(() => {
  const m = binding.value?.measures[0]
  const raw = m ? frame.value?.rows[0]?.[m.key] : undefined
  const v = typeof raw === 'number' ? raw : null
  const s = state.value
  if (s === 'error') return { value: '-', unavailable: true, reason: `${sourceLabel.value} feed unavailable - retry to refresh` }
  if (s !== 'ready' && s !== 'refreshing') return { value: '-', unavailable: s !== 'loading', reason: REASON[s] ?? '' }
  if (v == null) return { value: '-', unavailable: true, reason: REASON.empty! }
  const p = formatParts(v, m?.unit ?? 'count')
  const t = binding.value?.threshold
  return {
    value: p.prefix ? `${p.unit} ${p.value}` : p.value,
    unit: p.prefix ? undefined : p.unit || undefined,
    unitTitle: p.unitTitle,
    status: t ? statusOf(v, t) : 'neutral',
    unavailable: false,
    reason: '',
  }
})
</script>
