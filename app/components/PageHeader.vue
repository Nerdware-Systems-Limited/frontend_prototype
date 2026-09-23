<template>
  <!--
    PageHeader - wireframe's .page-header. The eyebrow no longer renders
    its own pill here - it duplicated the top-nav's persistent subtitle
    immediately above it. Its module context now lives there instead (see
    useNavSubtitle call below), so this is just h1 + optional subtitle.
  -->
  <div>
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
const props = withDefaults(defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
}>(), {
  eyebrow: '',
  subtitle: '',
})

// Single source of truth for the top-nav subtitle: every page already
// passes eyebrow ("Module - Page") and title here, so this is the one
// place that needs to set it - pages no longer call useNavSubtitle
// themselves.
useNavSubtitle(props.eyebrow || props.title)
</script>
