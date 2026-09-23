<template>
  <div v-if="totalPages > 1" class="table-pagination">
    <button class="btn" :disabled="page <= 1" @click="$emit('prev')">← Prev</button>
    <span class="tp-info">Page {{ page }} of {{ totalPages }} · {{ total }} row{{ total === 1 ? '' : 's' }}</span>
    <button class="btn" :disabled="page >= totalPages" @click="$emit('next')">Next →</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ page: number; totalPages: number; total: number }>()
defineEmits<{ prev: []; next: [] }>()
</script>

<style scoped>
.table-pagination { display:flex; align-items:center; justify-content:center; gap:14px; padding:10px 0 2px; }
.tp-info { font-size:12px; color:#64748b; }
</style>
