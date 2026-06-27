<template>
  <!--
    PageHeader - wireframe's .page-tag + .page-header combo.
    Page-tag (eyebrow) + h1 title + optional subtitle + actions slot.
  -->
  <div>
    <div v-if="eyebrow" class="page-tag">{{ eyebrow }}</div>
    <div class="page-header">
      <div>
        <h1>{{ title }}</h1>
        <div v-if="subtitle" class="page-subtitle">{{ subtitle }}</div>
        <slot name="breadcrumb" />
      </div>
      <div v-if="$slots.actions" class="header-btns">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
}>(), {
  eyebrow: '',
  subtitle: '',
})
</script>
