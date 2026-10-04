<template>
  <!--
    One metric as a <KpiCard>. The metric, drill-down and prominence come
    from the instance config; the numbers come from the shared domain cache,
    already narrowed by whatever dashboard filters/actions target this widget.
  -->
  <KpiCard
    v-if="metric"
    :label="config.label as string || metric.label"
    v-bind="view"
    :loading="loading && !data"
    :prominent="!!config.prominent"
    :to="(config.to as string) ?? metric.to ?? ''"
  />
  <KpiCard v-else label="Unknown metric" value="-" unavailable :unavailable-reason="`'${config.metricKey}' is not in the metric registry`" />
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { METRICS_BY_KEY, type KpiView } from '~/utils/metricRegistry'
import { useDomainData } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()

const metric = computed(() => METRICS_BY_KEY[String(props.config.metricKey)] ?? null)
const { context } = useWidgetFilters(() => props.instance.id)
const { data, failure, loading } = useDomainData(() => metric.value?.domain ?? null, () => context.value)

const FAILURE_REASON = {
  'not-integrated': (src: string) => `Not yet integrated - appears once the ${src} feed is onboarded`,
  'forbidden': (src: string) => `Your role doesn't have access to ${src} data`,
  'error': (src: string) => `${src} feed unavailable - retry to refresh`,
} as const

const view = computed<KpiView>(() => {
  const m = metric.value!
  if (failure.value) {
    return { value: '-', period: m.period, description: m.description, unavailable: true, unavailableReason: FAILURE_REASON[failure.value.kind](m.source) }
  }
  if (!data.value) {
    return { value: '-', period: m.period, description: m.description, unavailable: !loading.value, unavailableReason: 'Awaiting first sync…' }
  }
  try {
    return m.resolve(data.value)
  } catch {
    // A payload missing a field the resolver expects is "no data", not a crash.
    return { value: '-', period: m.period, description: m.description, unavailable: true, unavailableReason: 'Unexpected response shape' }
  }
})
</script>
