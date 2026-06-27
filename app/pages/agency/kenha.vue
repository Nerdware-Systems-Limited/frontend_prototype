<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/kenha.html
    h1: KeNHA - Road Asset Manager
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="page-tag">Agency Drill-Down · KeNHA</div>
<div class="page-header">
 <h1>KeNHA - Road Asset Manager</h1>
 <div class="header-btns"><button>Export RAMS</button><button class="btn-primary">New Maintenance Order</button></div>
</div>
<div class="persona-ribbon"><strong>RBAC:</strong> Asset Operator · interactive maintenance & weighbridge controls<span class="pr-chip">Tenant: KeNHA</span></div>

<div class="filter-bar">
 <div class="filter-group"><span class="filter-label">Corridor</span><select class="select"><option>All National (A/B/C)</option><option>A104</option><option>A109</option><option>B8</option></select></div>
 <div class="filter-group"><span class="filter-label">Region</span><select class="select"><option>All</option><option>Coast</option><option>Rift Valley</option><option>North Eastern</option></select></div>
 <div class="filter-group"><span class="filter-label">Source</span><span class="src-chip batch" title="KeNHA RAMS Excel · uploaded 2 days ago">Manual/Batch</span></div>
</div>

<div class="kpi-grid">
 <div class="kpi-card"><span class="src-chip batch kpi-source">RAMS Batch</span><div class="kpi-label">Network Length Monitored</div><div class="kpi-value">22,140<small> km</small></div><div class="kpi-sub">National classified roads</div></div>
 <div class="kpi-card"><span class="src-chip batch kpi-source">RAMS Batch</span><div class="kpi-label">Avg IRI</div><div class="kpi-value">3.8</div><div class="kpi-trend up"> 0.2 vs Q3</div></div>
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">Active Weighbridge Spikes</div><div class="kpi-value">4</div><div class="kpi-sub">Mariakani · Gilgil · Athi River · Webuye</div></div>
 <div class="kpi-card"><span class="src-chip live kpi-source">Live API</span><div class="kpi-label">Axle Violations (24h)</div><div class="kpi-value">87</div><div class="kpi-trend down"> 21% vs yesterday</div></div>
</div>

<div class="charts-row">
 <div class="chart-card">
  <h3>Network Condition Map <span>Color = IRI score</span></h3>
  <div class="map-wrap"><div class="map-canvas" style="height:340px">
   <div class="map-road" style="width:78%;height:5px;top:30%;left:8%;background:linear-gradient(90deg,#15803d,#22c55e,#f59e0b,#ef4444);opacity:.85"></div>
   <div class="map-road" style="width:55%;height:4px;top:48%;left:18%;background:linear-gradient(90deg,#22c55e,#f59e0b);opacity:.8"></div>
   <div class="map-road" style="width:60%;height:4px;top:66%;left:22%;background:linear-gradient(90deg,#ef4444,#991b1b);opacity:.85"></div>
   <div class="map-incident" style="top:30%;left:62%"></div>
   <div class="map-incident" style="top:66%;left:48%"></div>
   <div class="map-legend">
    <div class="legend-item"><div class="legend-swatch" style="background:#15803d"></div>Very Good &lt;2</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#22c55e"></div>Good 2–4</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#f59e0b"></div>Fair 4–6</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#ef4444"></div>Poor 6–8</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#991b1b"></div>Very Poor >8</div>
   </div>
  </div></div>
 </div>
 <div class="chart-card">
  <h3>Axle Load Violations - Live <span>Top weighbridges</span></h3>
  <div class="viol-row"><span><strong>Mariakani</strong> · A109</span><span class="vr-val">34 violations · peak 62t</span></div>
  <div class="viol-row"><span><strong>Gilgil</strong> · A104</span><span class="vr-val">22 violations · peak 58t</span></div>
  <div class="viol-row"><span><strong>Athi River</strong> · A104</span><span class="vr-val">19 violations · peak 56t</span></div>
  <div class="viol-row"><span><strong>Webuye</strong> · A1</span><span class="vr-val">12 violations · peak 55t</span></div>
  <div class="viol-row"><span><strong>Busia</strong> · A104</span><span class="vr-val">0 violations</span></div>
 </div>
</div>

<div class="alert-section">
 <h3>Maintenance Prioritization List <span>Ranked by economic importance × deterioration probability</span></h3>
 <div class="maint-row"><span><span class="rank">1</span><strong>A104 km 42–58</strong> - surface failure · 89% deterioration in 6mo</span><span class="iri-pill iri-vpoor">KES 480M</span></div>
 <div class="maint-row"><span><span class="rank">2</span><strong>B8 Garissa–Liboi</strong> - bridge scour risk</span><span class="iri-pill iri-poor">KES 310M</span></div>
 <div class="maint-row"><span><span class="rank">3</span><strong>A109 Mariakani bypass</strong> - heavy axle load fatigue</span><span class="iri-pill iri-poor">KES 220M</span></div>
 <div class="maint-row"><span><span class="rank">4</span><strong>C61 Maralal–Baragoi</strong> - gravel resealing</span><span class="iri-pill iri-fair">KES 95M</span></div>
 <div class="maint-row"><span><span class="rank">5</span><strong>A1 Webuye–Malaba</strong> - drainage rehab</span><span class="iri-pill iri-fair">KES 78M</span></div>
</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Road Assets · KeNHA')
</script>
