<template>
  <NationalCommandCentre v-if="showNational" />
  <AgencyCommandCentre v-else-if="agency" />
  <NationalCommandCentre v-else />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { isSuperAdmin, agencyCode, agency } = useAccessControl()
const showNational = computed(() => isSuperAdmin.value || agencyCode.value === 'SDT')
</script>
