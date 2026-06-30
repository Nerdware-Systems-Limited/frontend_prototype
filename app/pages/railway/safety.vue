<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Safety"
    subtitle="KRC · RSSB · NTSA - Railway incident reporting, level crossing safety, derailment risk, and regulatory compliance tracking"
  />

  <div class="coming-soon-card">
    <div class="cs-title">Rail Safety Module</div>
    <div class="cs-body">
      This module will consolidate railway safety data and incident management for Kenya's rail network, covering:
    </div>
    <ul class="cs-list">
      <li>Railway incident and accident reporting (KRC Safety Dept)</li>
      <li>Level crossing incident tracking and near-miss reporting</li>
      <li>Derailment risk assessment and predictive analytics</li>
      <li>Signal passed at danger (SPAD) events</li>
      <li>Safety KPIs - fatality rate per billion passenger-km, LTIFR</li>
      <li>Regulatory compliance with Railway Safety Board (RSSB) standards</li>
    </ul>
    <div class="cs-note">Integration with KRC Safety Management System and RSSB is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Safety')
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
