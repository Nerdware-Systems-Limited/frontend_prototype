<template>
  <div>
    <div class="page-tag">Agency Drill-Down · KeNHA</div>
    <div class="page-header">
      <h1>KeNHA - Road Asset Manager</h1>
      <div class="header-btns">
        <button>Export RAMS</button>
        <button class="btn-primary">New Maintenance Order</button>
      </div>
    </div>
    <div class="persona-ribbon">
      <strong>RBAC:</strong> Asset Operator · interactive maintenance &amp; weighbridge controls
      <span class="pr-chip">Tenant: KeNHA</span>
      <span class="pr-chip">Systems: MS Dynamics ERP · ArcGIS · BMS · Kenload · EDMS</span>
      <span class="pr-chip batch">Batch · ArcGIS API</span>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">Corridor</span>
        <select class="select">
          <option>All National (A/B/C)</option>
          <option>A104 - Nairobi–Malaba</option>
          <option>A109 - Mombasa–Nairobi</option>
          <option>A1 - Webuye–Malaba</option>
          <option>B8 - Garissa–Liboi</option>
          <option>C61 - Maralal–Baragoi</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Region</span>
        <select class="select">
          <option>All (10 regional + 3 corridor offices)</option>
          <option>Coast</option>
          <option>Rift Valley</option>
          <option>North Eastern</option>
          <option>Central</option>
          <option>Western</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Condition class</span>
        <select class="select">
          <option>All classes</option>
          <option>Good (IRI &lt; 4)</option>
          <option>Fair (IRI 4–6)</option>
          <option>Poor (IRI 6–8)</option>
          <option>Very Poor (IRI &gt; 8)</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Source</span>
        <span class="src-chip batch" title="KeNHA ARICS Survey · IRI via i-DRIMS · Annual">ARICS · Batch</span>
      </div>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">ARICS Survey · Annual</span>
        <div class="kpi-label">National Highway Network</div>
        <div class="kpi-value">22,140 <small>km</small></div>
        <div class="kpi-sub">A/B/C class national trunk roads</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">i-DRIMS · ARICS</span>
        <div class="kpi-label">Avg IRI Score</div>
        <div class="kpi-value">3.8</div>
        <div class="kpi-trend up">▲ 0.2 vs previous ARICS</div>
        <div class="kpi-sub">Lower = smoother surface</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">BMS · Quarterly</span>
        <div class="kpi-label">Bridges - Critical</div>
        <div class="kpi-value">14 <small>/ 632</small></div>
        <div class="kpi-sub">Structural intervention required</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip live kpi-source">Kenload · Live API</span>
        <div class="kpi-label">Weighbridge Stations Active</div>
        <div class="kpi-value">13 <small>permanent</small></div>
        <div class="kpi-sub">+ mobile units · national coverage</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip live kpi-source">Kenload Weighbridge · Live</span>
        <div class="kpi-label">Axle Violations (24h)</div>
        <div class="kpi-value">87</div>
        <div class="kpi-trend down">▼ 21% vs yesterday</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">RMLF / KRB · Quarterly</span>
        <div class="kpi-label">Budget Sufficiency Index</div>
        <div class="kpi-value">0.61</div>
        <div class="kpi-sub">Maintenance funding vs actual need</div>
      </div>
    </div>

    <!-- Network condition map + weighbridge violations -->
    <div class="charts-row">
      <div class="chart-card">
        <h3>
          Network Condition Map
          <span>IRI score per segment · ArcGIS / i-DRIMS</span>
        </h3>
        <div class="map-wrap">
          <div class="map-canvas" style="height:340px">
            <div class="map-road" style="width:78%;height:5px;top:30%;left:8%;background:linear-gradient(90deg,#15803d,#22c55e,#f59e0b,#ef4444);opacity:.85"></div>
            <div class="map-road" style="width:55%;height:4px;top:48%;left:18%;background:linear-gradient(90deg,#22c55e,#f59e0b);opacity:.8"></div>
            <div class="map-road" style="width:60%;height:4px;top:66%;left:22%;background:linear-gradient(90deg,#ef4444,#991b1b);opacity:.85"></div>
            <div class="map-incident" style="top:30%;left:62%"></div>
            <div class="map-incident" style="top:66%;left:48%"></div>
            <div class="map-legend">
              <div class="legend-item"><div class="legend-swatch" style="background:#15803d"></div>Very Good &lt; 2</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#22c55e"></div>Good 2–4</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#f59e0b"></div>Fair 4–6</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#ef4444"></div>Poor 6–8</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#991b1b"></div>Very Poor &gt; 8</div>
            </div>
          </div>
        </div>
        <div class="chart-meta">Source: KeNHA i-DRIMS Annual ARICS Survey · KeNHA designated GIS custodian for national highway network</div>
      </div>

      <div class="chart-card">
        <h3>Axle Load Violations - Live <span>13 permanent weighbridge stations</span></h3>
        <div class="viol-row"><span><strong>Mariakani</strong> · A109</span><span class="vr-val">34 violations · peak 62 t</span></div>
        <div class="viol-row"><span><strong>Gilgil</strong> · A104</span><span class="vr-val">22 violations · peak 58 t</span></div>
        <div class="viol-row"><span><strong>Athi River</strong> · A104</span><span class="vr-val">19 violations · peak 56 t</span></div>
        <div class="viol-row"><span><strong>Webuye</strong> · A1</span><span class="vr-val">12 violations · peak 55 t</span></div>
        <div class="viol-row"><span><strong>Busia</strong> · A104</span><span class="vr-val">0 violations</span></div>
        <div class="viol-row"><span><strong>Mtwapa</strong> · A109</span><span class="vr-val">8 violations · peak 54 t</span></div>
        <div class="viol-row"><span><strong>Mlolongo</strong> · A104</span><span class="vr-val">5 violations · peak 53 t</span></div>
        <div class="chart-meta" style="margin-top:10px">Source: Kenload Weighbridge Management System + Discoverer Virtual Weighbridge · Live API / CSV</div>
      </div>
    </div>

    <!-- Predictive scenario simulator -->
    <div class="chart-card" style="margin-top:16px">
      <h3>HDM-4 Predictive Scenario Simulator <span>12-month pavement deterioration outlook · Model transparency enabled</span></h3>
      <div class="scenario-grid">
        <div class="scenario-item">
          <div class="scenario-label">Do-Minimum</div>
          <div class="scenario-val warn">IRI → 5.2</div>
          <div class="scenario-sub">38% of network Poor/Very Poor by Dec</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">Optimal Maintenance</div>
          <div class="scenario-val good">IRI → 3.4</div>
          <div class="scenario-sub">Requires KES 18.4B RMLF supplementary</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">Overloading Continues</div>
          <div class="scenario-val crit">IRI → 6.1</div>
          <div class="scenario-sub">Accelerated fatigue on A109, A104</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">Climate Stress</div>
          <div class="scenario-val warn">IRI → 4.8</div>
          <div class="scenario-sub">Flood-prone segments: B8, C61 at high risk</div>
        </div>
        <div class="scenario-item">
          <div class="scenario-label">PPP Corridor</div>
          <div class="scenario-val good">IRI → 3.1</div>
          <div class="scenario-sub">A104 Nairobi–Malaba · PPP revenue projection</div>
        </div>
      </div>
    </div>

    <!-- Maintenance prioritisation list -->
    <div class="alert-section" style="margin-top:16px">
      <h3>
        Maintenance Prioritisation List
        <span>Ranked: economic importance × deterioration probability · HDM-4 compatible</span>
      </h3>
      <div class="maint-row">
        <span><span class="rank">1</span><strong>A104 km 42–58</strong> - surface failure · 89% deterioration probability in 6mo</span>
        <span class="iri-pill iri-vpoor">KES 480M</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">2</span><strong>B8 Garissa–Liboi</strong> - bridge scour risk · climate-vulnerable</span>
        <span class="iri-pill iri-poor">KES 310M</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">3</span><strong>A109 Mariakani bypass</strong> - heavy axle load fatigue · 34 daily violations</span>
        <span class="iri-pill iri-poor">KES 220M</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">4</span><strong>C61 Maralal–Baragoi</strong> - gravel resealing · landslide-adjacent section</span>
        <span class="iri-pill iri-fair">KES 95M</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">5</span><strong>A1 Webuye–Malaba</strong> - drainage rehabilitation · northern corridor freight impact</span>
        <span class="iri-pill iri-fair">KES 78M</span>
      </div>
    </div>

    <!-- Bridge condition summary -->
    <div class="chart-card" style="margin-top:16px">
      <h3>Bridge Condition Register <span>BMS · Quarterly survey · 632 structures</span></h3>
      <table>
        <thead>
          <tr><th>Condition</th><th>Count</th><th>% of Network</th><th>Action</th></tr>
        </thead>
        <tbody>
          <tr><td>Good</td><td>341</td><td>54%</td><td><span class="iri-pill iri-good">Routine inspection</span></td></tr>
          <tr><td>Fair</td><td>168</td><td>27%</td><td><span class="iri-pill iri-fair">Monitoring required</span></td></tr>
          <tr><td>Poor</td><td>109</td><td>17%</td><td><span class="iri-pill iri-poor">Planned intervention</span></td></tr>
          <tr><td>Critical</td><td>14</td><td>2%</td><td><span class="iri-pill iri-vpoor">Immediate action</span></td></tr>
        </tbody>
      </table>
      <div class="chart-meta">Source: KeNHA Bridge Management System (Java/PostgreSQL · on-premise) · shared with KRB</div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Road Assets · KeNHA')
</script>

<style scoped>
.page-tag { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
.page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:12px; }
.page-header h1 { font-size:20px; font-weight:600; color:#0f172a; margin:0; }
.header-btns { display:flex; gap:8px; }
.persona-ribbon { background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:6px; padding:8px 12px; font-size:11px; color:#475569; margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pr-chip { background:#e8f0f9; color:#1d5ca6; border-radius:3px; padding:2px 7px; font-size:10px; font-weight:500; }
.filter-bar { display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap; background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:6px; padding:8px 12px; }
.filter-group { display:flex; align-items:center; gap:6px; }
.filter-label { font-size:11px; color:#64748b; font-weight:500; white-space:nowrap; }
.select { font-size:12px; border:0.5px solid #e2e8f0; border-radius:4px; padding:4px 8px; background:#fff; color:#0f172a; }
.src-chip { font-size:10px; font-weight:600; border-radius:3px; padding:2px 7px; letter-spacing:.04em; }
.src-chip.live { background:#dcfce7; color:#166534; }
.src-chip.batch { background:#e8f0f9; color:#1d5ca6; }
.kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px; }
.kpi-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:10px 12px; position:relative; }
.kpi-source { position:absolute; top:8px; right:8px; }
.kpi-label { font-size:10px; color:#94a3b8; font-weight:500; margin-bottom:2px; }
.kpi-value { font-size:22px; font-weight:600; color:#0f172a; line-height:1.1; }
.kpi-value small { font-size:13px; font-weight:400; color:#64748b; }
.kpi-sub { font-size:10px; color:#64748b; margin-top:2px; }
.kpi-trend { font-size:11px; margin-top:3px; }
.kpi-trend.up { color:#166534; }
.kpi-trend.down { color:#991b1b; }
.charts-row { display:grid; grid-template-columns:1.4fr 1fr; gap:14px; }
.chart-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.chart-card h3 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
.chart-card h3 span { font-size:10px; font-weight:400; color:#94a3b8; }
.chart-meta { font-size:10px; color:#94a3b8; margin-top:8px; }
.map-wrap { border-radius:6px; overflow:hidden; border:0.5px solid #e2e8f0; }
.map-canvas { background:linear-gradient(135deg,#e8ecee,#dde2e5,#cfd5d9); position:relative; overflow:hidden; }
.map-road { position:absolute; border-radius:3px; }
.map-incident { position:absolute; width:10px; height:10px; border-radius:50%; background:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,.2); }
.map-legend { position:absolute; bottom:10px; right:10px; background:rgba(255,255,255,.92); border-radius:5px; padding:7px 10px; font-size:10px; display:flex; flex-direction:column; gap:4px; border:0.5px solid rgba(11,11,11,.08); }
.legend-item { display:flex; align-items:center; gap:5px; color:#374151; }
.legend-swatch { width:24px; height:7px; border-radius:2px; flex-shrink:0; }
.viol-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:0.5px solid #f1f5f9; font-size:12px; color:#334155; }
.viol-row:last-of-type { border-bottom:none; }
.vr-val { font-size:11px; color:#64748b; }
.scenario-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:4px; }
.scenario-item { background:#f8fafc; border-radius:6px; padding:10px; }
.scenario-label { font-size:10px; font-weight:600; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
.scenario-val { font-size:16px; font-weight:600; margin-bottom:3px; }
.scenario-val.good { color:#166534; }
.scenario-val.warn { color:#854d0e; }
.scenario-val.crit { color:#991b1b; }
.scenario-sub { font-size:10px; color:#94a3b8; line-height:1.4; }
.alert-section { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.alert-section h3 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
.alert-section h3 span { font-size:10px; font-weight:400; color:#94a3b8; }
.maint-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:0.5px solid #f1f5f9; font-size:12px; color:#334155; gap:12px; }
.maint-row:last-child { border-bottom:none; }
.rank { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#f1f5f9; font-size:10px; font-weight:700; color:#64748b; margin-right:8px; flex-shrink:0; }
.iri-pill { font-size:11px; font-weight:600; padding:3px 10px; border-radius:3px; white-space:nowrap; }
.iri-pill.iri-good { background:#dcfce7; color:#166534; }
.iri-pill.iri-fair { background:#fef9c3; color:#854d0e; }
.iri-pill.iri-poor { background:#ffedd5; color:#9a3412; }
.iri-pill.iri-vpoor { background:#fee2e2; color:#991b1b; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th { text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; padding:6px 10px; border-bottom:0.5px solid #e2e8f0; }
td { padding:8px 10px; border-bottom:0.5px solid #f1f5f9; color:#334155; }
tr:last-child td { border-bottom:none; }
button { padding:7px 14px; border-radius:6px; font-size:12px; font-weight:500; border:0.5px solid #e2e8f0; background:#fff; cursor:pointer; color:#334155; }
.btn-primary { background:#006838; color:#fff; border-color:#006838; }
</style>
