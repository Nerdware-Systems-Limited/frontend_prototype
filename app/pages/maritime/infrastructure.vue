<template>
  <PageHeader
    eyebrow="Maritime"
    title="Maritime Infrastructure"
    subtitle="KPA · KMFRI · Kenya Maritime Authority - Port infrastructure, berth condition, navigational aids, and coastal facility health"
  />

  <div class="coming-soon-card">
    <div class="cs-title">Maritime Infrastructure Module</div>
    <div class="cs-body">
      This module will provide comprehensive monitoring of Kenya's maritime infrastructure assets, including:
    </div>
    <ul class="cs-list">
      <li>Port of Mombasa berth condition and capacity utilisation</li>
      <li>Lamu Port (LAPSSET) infrastructure status and development progress</li>
      <li>Channel depth and dredging operations (Kenya Ports Authority)</li>
      <li>Navigational aids - buoys, lighthouses, and VTS radar systems</li>
      <li>Ship repair and dry-dock facility availability</li>
      <li>Inland container depots (ICDs) and logistics hub status</li>
      <li>Kenya Maritime Authority safety-critical compliance tracking</li>
    </ul>
    <div class="cs-note">Integration with KPA port management and Kenya Maritime Authority systems is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Maritime Infrastructure')
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
