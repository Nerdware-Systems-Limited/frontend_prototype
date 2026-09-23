<template>
  <!-- Thin wrapper around BadgePill driven by app/utils/ingestStatus.ts —
       the single source of truth for a DataUpload status's label/variant,
       so every pill across the Integration Hub agrees with every filter
       chip and KPI. -->
  <BadgePill :variant="meta.variant">{{ meta.label }}</BadgePill>
</template>

<script setup lang="ts">
import type { DataUploadStatus } from '~/composables/api'

const props = defineProps<{ status: DataUploadStatus }>()
const meta = computed(() => statusMeta(props.status))
</script>
