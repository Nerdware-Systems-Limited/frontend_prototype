<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Network Inventory"
    subtitle="KRC · NCTTCA - Complete inventory of SGR and MGR lines, stations, rolling stock, and corridor assets"
  />

  <div class="coming-soon-card">
    <div class="cs-title">Rail Network Inventory</div>
    <div class="cs-body">
      This module will provide a comprehensive inventory of Kenya's rail network assets, including:
    </div>
    <ul class="cs-list">
      <li>SGR corridor inventory (Mombasa–Nairobi–Naivasha)</li>
      <li>MGR network assets and condition ratings</li>
      <li>Station inventory - facilities, capacity, and accessibility</li>
      <li>Rolling stock registry - locomotives, wagons, and passenger coaches</li>
      <li>Track kilometres by condition class and maintenance status</li>
      <li>NCTTCA corridor comparative data</li>
    </ul>
    <div class="cs-note">Integration with KRC asset management and NCTTCA corridor data is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Network Inventory')
</script>

<style scoped>
.coming-soon-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 40px 36px;
  max-width: 680px;
  margin: 24px 0;
}
.cs-icon { font-size: 36px; margin-bottom: 12px; }
.cs-title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.cs-body { font-size: 14px; color: #475569; margin-bottom: 14px; }
.cs-list { padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.9; margin-bottom: 20px; }
.cs-note { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 14px; }
</style>
