<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Registration"
    subtitle="NTSA - National vehicle registration statistics, registrations by type and fuel category, daily and weekly trends"
  />

  <!-- KPI cards (placeholder - NTSA registration API integration in progress) -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Registered Vehicles"
      value="-"
      sub="Cumulative to date"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registered Today"
      value="-"
      sub="New registrations (today)"
      source="live" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registered (Last 7 Days)"
      value="-"
      sub="7-day rolling total"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registrations This Month"
      value="-"
      sub="Current month"
      trend-direction="up"
      source="batch" source-title="NTSA VREG"
    />
  </div>

  <div class="two-col">
    <!-- By vehicle type -->
    <div class="card">
      <div class="card-header">Registrations by Vehicle Type</div>
      <div class="card-body placeholder-section">
        <div class="placeholder-row">
          <span class="ph-label">Private Cars</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:72%" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Motorcycles</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:55%" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">PSV Matatu</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:28%" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Commercial Trucks</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:20%" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Trailers</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:12%" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="ph-note">NTSA VREG API integration in progress</div>
      </div>
    </div>

    <!-- By fuel type -->
    <div class="card">
      <div class="card-header">Registrations by Fuel Type</div>
      <div class="card-body placeholder-section">
        <div class="placeholder-row">
          <span class="ph-label">Petrol</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:65%;background:#3b82f6" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Diesel</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:48%;background:#3b82f6" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Electric (EV)</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:8%;background:#22c55e" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Hybrid</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:14%;background:#10b981" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="placeholder-row">
          <span class="ph-label">Other / LPG</span>
          <div class="ph-bar-wrap"><div class="ph-bar" style="width:5%;background:#94a3b8" /></div>
          <span class="ph-val">-</span>
        </div>
        <div class="ph-note">NTSA VREG API integration in progress</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Vehicle Registration')
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.placeholder-section { display:flex; flex-direction:column; gap:10px; }
.placeholder-row { display:grid; grid-template-columns:130px 1fr 40px; align-items:center; gap:8px; }
.ph-label { font-size:12px; color:#475569; }
.ph-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.ph-bar { height:100%; background:#cbd5e1; border-radius:4px; }
.ph-val { font-size:12px; color:#94a3b8; text-align:right; }
.ph-note { margin-top:8px; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px; }
</style>
