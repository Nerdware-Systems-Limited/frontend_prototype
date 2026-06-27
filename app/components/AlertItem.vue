<template>
  <!--
    AlertItem - wireframe's .alert-item pattern.
    A row inside .alert-section, with severity badge + title + meta + ack button.
  -->
  <div class="alert-item">
    <div class="alert-main">
      <span :class="['alert-badge', severity]">{{ severityLabel }}</span>
      <div>
        <div class="alert-title"><slot name="title">{{ title }}</slot></div>
        <div class="alert-meta"><slot name="meta">{{ meta }}</slot></div>
      </div>
    </div>
    <button
      v-if="ackable"
      :class="['ack-btn', { acked }]"
      :disabled="acked"
      @click="$emit('ack')"
    >
      {{ acked ? 'Acked' : 'ACK' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  severity?: 'critical' | 'warning' | 'info'
  title?: string
  meta?: string
  ackable?: boolean
  acked?: boolean
}>(), {
  severity: 'warning',
  title: '',
  meta: '',
  ackable: false,
  acked: false,
})

defineEmits<{ (e: 'ack'): void }>()

const severityLabel = computed(() => {
  const s = props.severity
  return s.charAt(0).toUpperCase() + s.slice(1)
})
</script>
