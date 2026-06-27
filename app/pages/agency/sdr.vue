<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/sdr.html
    h1: SDR - National Infrastructure Oversight
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="page-tag">Agency Drill-Down · SDR</div>
<div class="page-header">
 <h1>SDR - National Infrastructure Oversight</h1>
 <div class="header-btns"><button>Export FY Report</button><button class="btn-primary">Reconcile Road Register</button></div>
</div>
<div class="persona-ribbon"><strong>RBAC:</strong> Executive / Finance persona · cross-agency oversight, no operational dispatch<span class="pr-chip">Tenant: SDR</span></div>

<div class="kpi-grid">
 <div class="kpi-card"><span class="src-chip batch kpi-source" title="Quarterly Treasury upload (Excel) · 14d ago">Manual/Batch</span><div class="kpi-label">FY25 Budget Absorption</div><div class="kpi-value">68%</div><div class="kpi-sub">All road agencies combined</div></div>
 <div class="kpi-card"><span class="src-chip batch kpi-source" title="MTD PDF · monthly">Manual/Batch</span><div class="kpi-label">Maintenance Backlog</div><div class="kpi-value">KES 142B</div><div class="kpi-trend down"> 6.8% vs FY24</div></div>
 <div class="kpi-card"><span class="src-chip batch kpi-source">Manual/Batch</span><div class="kpi-label">National Network Length</div><div class="kpi-value">165,182<small> km</small></div></div>
 <div class="kpi-card"><span class="src-chip batch kpi-source">Manual/Batch</span><div class="kpi-label">Register Δ (30d)</div><div class="kpi-value">+318<small> km</small></div><div class="kpi-sub">12 reclassifications</div></div>
</div>

<div class="chart-card">
 <h3>Budget Absorption by Agency (FY25) <span>Source: Treasury batch upload</span></h3>
 <table>
  <thead><tr><th>Agency</th><th>Allocation (KES B)</th><th>Spent</th><th>Absorption</th><th>Maintenance Backlog</th></tr></thead>
  <tbody>
   <tr><td>KeNHA</td><td>92.4</td><td>71.0</td><td><span class="iri-pill iri-good">77%</span></td><td>KES 58B</td></tr>
   <tr><td>KURA</td><td>34.1</td><td>22.8</td><td><span class="iri-pill iri-fair">67%</span></td><td>KES 31B</td></tr>
   <tr><td>KeRRA</td><td>28.6</td><td>15.2</td><td><span class="iri-pill iri-poor">53%</span></td><td>KES 41B</td></tr>
   <tr><td>KRB</td><td>11.2</td><td>9.4</td><td><span class="iri-pill iri-very-good">84%</span></td><td>-</td></tr>
   <tr><td>NTSA</td><td>8.8</td><td>6.7</td><td><span class="iri-pill iri-good">76%</span></td><td>-</td></tr>
   <tr><td>KMA</td><td>4.2</td><td>2.1</td><td><span class="iri-pill iri-poor">50%</span></td><td>KES 12B</td></tr>
  </tbody>
 </table>
</div>

<div class="alert-section">
 <h3>Road Register Change Log <span>165,000 km national network</span></h3>
 <div class="alert-item"><div class="alert-main"><span class="alert-badge info">ADD</span><div><div class="alert-title">+ 142 km · C-class roads (Turkana)</div><div class="alert-meta">KeRRA upload · 2 days ago · Verified by SDR</div></div></div><button class="ack-btn acked">Reviewed</button></div>
 <div class="alert-item"><div class="alert-main"><span class="alert-badge warning">RECLASSIFY</span><div><div class="alert-title">D407 → B (upgrade) · Nakuru–Bahati</div><div class="alert-meta">KeNHA submission · 5 days ago · Pending finance impact review</div></div></div><button class="ack-btn">Review</button></div>
 <div class="alert-item"><div class="alert-main"><span class="alert-badge info">ADD</span><div><div class="alert-title">+ 176 km · Estate roads transferred to KURA</div><div class="alert-meta">Nairobi County → KURA · 1 wk ago</div></div></div><button class="ack-btn acked">Reviewed</button></div>
</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Oversight · SDT')
</script>
