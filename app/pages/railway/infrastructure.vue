<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Infrastructure"
    subtitle="KRC · KeRRA · LAPSSET - SGR and MGR track condition, station facilities, level crossings, signalling systems, and infrastructure health"
  />

  <div class="coming-soon-card">
    <div class="cs-title">Rail Infrastructure Module</div>
    <div class="cs-body">
      This module will provide comprehensive monitoring of Kenya's rail infrastructure assets, including:
    </div>
    <ul class="cs-list">
      <li>SGR &amp; MGR track condition assessments</li>
      <li>Station facilities status and maintenance schedules</li>
      <li>Level crossing safety compliance</li>
      <li>Signalling and telecommunications systems health</li>
      <li>Bridge and culvert condition ratings</li>
      <li>Infrastructure investment pipeline and KRC capital works</li>
    </ul>
    <div class="cs-note">Data integration with KRC asset management systems is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Infrastructure')
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
