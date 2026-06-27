<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/ntsa.html
    h1: NTSA - Safety & Enforcement
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="page-tag">Agency Drill-Down · NTSA</div>
<div class="page-header">
 <h1>NTSA - Safety & Enforcement</h1>
 <div class="header-btns"><button>Dispatch Field Unit</button><button class="btn-primary">Issue Enforcement Order</button></div>
</div>
<div class="persona-ribbon"><strong>RBAC:</strong> Operator persona · live fleet command & enforcement tools<span class="pr-chip">Tenant: NTSA</span></div>

<div class="kpi-grid">
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">Tracked Fleet (IVMS)</div><div class="kpi-value">45,210</div><div class="kpi-sub">PSV + freight reporting GPS</div></div>
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">Vehicles with Expired Reg</div><div class="kpi-value">214</div><div class="kpi-trend down"> Action required</div></div>
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">Active Black Spots</div><div class="kpi-value">37</div><div class="kpi-sub">≥3 fatalities last 12mo</div></div>
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">7-day Fatalities</div><div class="kpi-value">112</div><div class="kpi-trend down"> 9 vs prior week</div></div>
</div>

<div class="charts-row">
 <div class="chart-card">
  <h3>Live Fleet Tracking <span>IVMS × Registry cross-reference</span></h3>
  <div class="map-wrap"><div class="map-canvas" style="height:340px">
     <div id="map"></div>
   <div class="map-legend">
    <div class="legend-item"><div style="width:6px;height:6px;border-radius:50%;background:var(--primary)"></div>Compliant</div>
    <div class="legend-item"><div style="width:6px;height:6px;border-radius:50%;background:var(--destructive)"></div>Expired reg / flagged</div>
   </div>
  </div></div>
 </div>
 <div class="chart-card">
  <h3>Black Spot Heatmap <span>By fatality category</span></h3>
  <div style="display:flex;gap:8px;margin-bottom:10px;font-size:11px;color:var(--fg2)"><span>Pedestrian</span><span>·</span><span>Motorcyclist</span><span>·</span><span>Vehicle</span></div>
  <div class="blackspot">
   <div></div><div class="h1"></div><div class="h2"></div><div class="h3"></div><div class="h4"></div><div class="h2"></div><div class="h1"></div><div></div>
   <div class="h1"></div><div class="h3"></div><div class="h4"></div><div class="h4"></div><div class="h3"></div><div class="h2"></div><div></div><div class="h1"></div>
   <div></div><div class="h2"></div><div class="h3"></div><div class="h2"></div><div class="h1"></div><div></div><div class="h1"></div><div></div>
   <div class="h1"></div><div></div><div class="h2"></div><div class="h4"></div><div class="h3"></div><div class="h1"></div><div></div><div></div>
   <div></div><div class="h1"></div><div></div><div class="h2"></div><div class="h1"></div><div></div><div></div><div></div>
  </div>
  <div style="margin-top:10px;font-size:11px;color:var(--fg2)">Hot cells: Ngara (pedestrian), Thika Rd–Roysambu (motorcyclist), Salgaa (vehicle)</div>
 </div>
</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Safety · NTSA')
</script>
