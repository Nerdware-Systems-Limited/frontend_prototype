<template>
  <PageHeader
    eyebrow="Aviation"
    title="Aviation Infrastructure"
    subtitle="KCAA · KAA - Airport facilities, runway condition, navigational aids, terminal capacity, and airspace infrastructure health"
  />

  <div class="coming-soon-card">
    <div class="cs-title">Aviation Infrastructure Module</div>
    <div class="cs-body">
      This module will provide monitoring of Kenya's aviation infrastructure assets across all aerodromes, including:
    </div>
    <ul class="cs-list">
      <li>Runway and taxiway condition assessments (PCN ratings)</li>
      <li>Terminal capacity and utilisation - JKIA, MOIA, KIA, and regional aerodromes</li>
      <li>Navigational aids (VOR, ILS, NDB) operational status</li>
      <li>Air traffic control infrastructure health</li>
      <li>Fuel farm and ground handling facility status</li>
      <li>KAA capital works programme and infrastructure investment pipeline</li>
      <li>Safety-critical infrastructure compliance with ICAO Annex 14</li>
    </ul>
    <div class="cs-note">Integration with KCAA and KAA asset management systems is in progress.</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Aviation Infrastructure')
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
