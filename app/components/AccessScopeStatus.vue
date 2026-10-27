<template>
  <!-- Read-only permission status for a layer the viewer cannot change (replaces the disabled None / Read / Full selector). -->
  <span class="badge" :class="tone" :data-scope="scope">{{ TEXT[scope] }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ScopeLevel } from '~/utils/resolveAccess'

const props = defineProps<{ scope: ScopeLevel | 'mixed' }>()

const TEXT: Record<ScopeLevel | 'mixed', string> = {
  full: 'Full access', read: 'Read only', none: 'No access', mixed: 'Mixed',
}
const tone = computed(() => ({ full: 'success', read: 'info', none: 'danger', mixed: 'warning' })[props.scope])
</script>
