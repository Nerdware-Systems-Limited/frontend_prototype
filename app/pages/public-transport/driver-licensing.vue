<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Driver Licensing"
    subtitle="NTSA - Driver licence issuance, renewals, suspensions, and compliance tracking across licence categories"
  />

  <div class="coming-soon-card">
    <div class="cs-icon">🪪</div>
    <div class="cs-title">Driver Licensing Module</div>
    <div class="cs-body">
      This module will provide full visibility into Kenya's driver licensing ecosystem, including:
    </div>
    <ul class="cs-list">
      <li>Licences issued today, this week, and this month</li>
      <li>Breakdown by licence class (A, B, C, D, E, F, G)</li>
      <li>Licence renewals vs. new issuances</li>
      <li>Expired licence holders and compliance rate</li>
      <li>Suspended and revoked licences</li>
      <li>PSV-specific endorsements (public service vehicle operators)</li>
      <li>Smart DL uptake and biometric verification statistics</li>
    </ul>
    <div class="cs-note">Integration with NTSA Driver Licensing System (DLS) is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Driver Licensing')
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
