<template>
  <div>
    <div class="page-tag">Agency Drill-Down · NTSA</div>
    <div class="page-header">
      <h1>NTSA - Safety &amp; Enforcement</h1>
      <div class="header-btns">
        <button>Dispatch Field Unit</button>
        <button class="btn-primary">Issue Enforcement Order</button>
      </div>
    </div>
    <div class="persona-ribbon">
      <strong>RBAC:</strong> Operator persona · live fleet command &amp; enforcement tools
      <span class="pr-chip">Tenant: NTSA</span>
      <span class="pr-chip">Systems: iTIMS · IRSMS · Multiperso · MS Dynamics AX</span>
      <span class="pr-chip live">Live API · IBM Power9 · SDWAN</span>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="src-chip live kpi-source">iTIMS · Live API</span>
        <div class="kpi-label">National Vehicle Registry</div>
        <div class="kpi-value">~5M <small>records</small></div>
        <div class="kpi-sub">Chassis · reg. no. · make · type · axles · weight class</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip live kpi-source">IVMS · Live cross-ref</span>
        <div class="kpi-label">PSVs &amp; Fleet Live-Tracked</div>
        <div class="kpi-value">45,210</div>
        <div class="kpi-sub">IVMS × registry cross-reference · operational</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip live kpi-source">Multiperso · Live</span>
        <div class="kpi-label">Smart Driving Licences</div>
        <div class="kpi-value">3.2M</div>
        <div class="kpi-sub">PIN-managed chip-encoded licences · Multiperso system</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip live kpi-source">IRSMS · Live</span>
        <div class="kpi-label">Active Road Incidents</div>
        <div class="kpi-value">37</div>
        <div class="kpi-sub">Open investigations (all severities)</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">IRSMS · Rolling 30d</span>
        <div class="kpi-label">Road Fatalities (30d)</div>
        <div class="kpi-value">112</div>
        <div class="kpi-trend down">▼ 9 vs prior 30-day period</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">KDE Analysis · Batch</span>
        <div class="kpi-label">Critical Black Spots</div>
        <div class="kpi-value">37</div>
        <div class="kpi-sub">≥ 3 fatalities in rolling 12 months</div>
      </div>
    </div>

    <!-- Fleet tracking + black spot heatmap -->
    <div class="charts-row">
      <div class="chart-card">
        <h3>
          Live Fleet Tracking - IVMS
          <span>iTIMS vehicle registry cross-reference · operational</span>
        </h3>
        <div class="map-wrap">
          <div class="map-canvas" style="height:320px">
            <div class="map-legend">
              <div class="legend-item"><div style="width:7px;height:7px;border-radius:50%;background:#166534;flex-shrink:0"></div>Compliant PSV</div>
              <div class="legend-item"><div style="width:7px;height:7px;border-radius:50%;background:#991b1b;flex-shrink:0"></div>Expired reg / flagged</div>
              <div class="legend-item"><div style="width:7px;height:7px;border-radius:50%;background:#854d0e;flex-shrink:0"></div>Speed governor tamper</div>
              <div class="legend-item"><div style="width:7px;height:7px;border-radius:50%;background:#1d5ca6;flex-shrink:0"></div>Govt fleet</div>
            </div>
          </div>
        </div>
        <div class="chart-meta">
          Source: NTSA iTIMS (IBM Power9 · on-premise · active-passive DCs Nairobi + Mombasa) · SDWAN to all branches
          <br>Note: ANPR / fixed traffic sensors under development - roadside monitoring not yet deployed
        </div>
      </div>

      <div class="chart-card">
        <h3>Black Spot Heatmap <span>KDE analysis by fatality category · IRSMS</span></h3>
        <div style="display:flex;gap:8px;margin-bottom:10px;font-size:11px;color:#64748b">
          <span>Pedestrian</span><span>·</span><span>Motorcyclist</span><span>·</span><span>Vehicle occupant</span>
        </div>
        <div class="blackspot">
          <div></div><div class="h1"></div><div class="h2"></div><div class="h3"></div><div class="h4"></div><div class="h2"></div><div class="h1"></div><div></div>
          <div class="h1"></div><div class="h3"></div><div class="h4"></div><div class="h4"></div><div class="h3"></div><div class="h2"></div><div></div><div class="h1"></div>
          <div></div><div class="h2"></div><div class="h3"></div><div class="h2"></div><div class="h1"></div><div></div><div class="h1"></div><div></div>
          <div class="h1"></div><div></div><div class="h2"></div><div class="h4"></div><div class="h3"></div><div class="h1"></div><div></div><div></div>
          <div></div><div class="h1"></div><div></div><div class="h2"></div><div class="h1"></div><div></div><div></div><div></div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:#64748b">
          Top hotspots: Ngara (pedestrian) · Thika Rd–Roysambu (motorcyclist) · Salgaa (vehicle)
        </div>
        <div class="chart-meta" style="margin-top:6px">
          Crash records sourced from NPS police reports · cleaned and validated at NTSA before entry into IRSMS
        </div>
      </div>
    </div>

    <!-- Licensing data breakdown -->
    <div class="chart-card" style="margin-top:16px">
      <h3>Licensing Register <span>iTIMS · all NTSA services</span></h3>
      <div class="lic-grid">
        <div class="lic-item">
          <div class="lic-label">PSV licences (active)</div>
          <div class="lic-value">184,220</div>
          <div class="lic-sub">Buses · matatus · taxis</div>
        </div>
        <div class="lic-item">
          <div class="lic-label">Driving licences (valid)</div>
          <div class="lic-value">3.2M</div>
          <div class="lic-sub">Smart chip-encoded · Multiperso</div>
        </div>
        <div class="lic-item">
          <div class="lic-label">Motor vehicle licences</div>
          <div class="lic-value">4.8M</div>
          <div class="lic-sub">Annual renewal · iTIMS</div>
        </div>
        <div class="lic-item">
          <div class="lic-label">Expired registrations</div>
          <div class="lic-value">214</div>
          <div class="lic-sub badge-crit">Action required</div>
        </div>
      </div>
    </div>

    <!-- Enforcement summary -->
    <div class="alert-section" style="margin-top:16px">
      <h3>
        Black Spot Prioritisation &amp; Enforcement Actions
        <span>Ranked by fatality density · IRSMS · KDE</span>
      </h3>
      <div class="maint-row">
        <span><span class="rank">1</span><strong>Salgaa - A104 km 189</strong> · vehicle occupant fatalities · 14 in 12mo</span>
        <span class="iri-pill iri-vpoor">Critical</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">2</span><strong>Ngara Roundabout - A8 Nairobi</strong> · pedestrian fatalities</span>
        <span class="iri-pill iri-poor">High</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">3</span><strong>Thika Rd–Roysambu - A2</strong> · motorcyclist fatalities · 9 in 12mo</span>
        <span class="iri-pill iri-poor">High</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">4</span><strong>Kenol–Sagana - A2</strong> · mixed fatality category</span>
        <span class="iri-pill iri-fair">Medium</span>
      </div>
      <div class="maint-row">
        <span><span class="rank">5</span><strong>Mwingi Town - B7</strong> · pedestrian &amp; motorcyclist</span>
        <span class="iri-pill iri-fair">Medium</span>
      </div>
    </div>

    <!-- System status -->
    <div class="chart-card" style="margin-top:16px">
      <h3>NTSA System Integration Status <span>All systems exchange via REST API (JSON) · DPA 2019 compliance required</span></h3>
      <table>
        <thead>
          <tr><th>System</th><th>Technology</th><th>Status</th><th>Integration mode</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>iTIMS</strong></td>
            <td>IBM Power9 · on-premise</td>
            <td><span class="iri-pill iri-good">Phase 2 active</span></td>
            <td>REST API (JSON)</td>
            <td>Vehicle registry · licensing · all NTSA services</td>
          </tr>
          <tr>
            <td><strong>IRSMS</strong></td>
            <td>On-premise · API</td>
            <td><span class="iri-pill iri-good">Live</span></td>
            <td>REST API (JSON)</td>
            <td>Road safety data · crash aggregation · KDE</td>
          </tr>
          <tr>
            <td><strong>Multiperso</strong></td>
            <td>On-premise · API</td>
            <td><span class="iri-pill iri-good">Live</span></td>
            <td>REST API (JSON)</td>
            <td>Smart DL lifecycle · PIN management · chip encoding</td>
          </tr>
          <tr>
            <td><strong>MS Dynamics AX ERP</strong></td>
            <td>On-premise · API</td>
            <td><span class="iri-pill iri-fair">Upgrade planned</span></td>
            <td>REST API (JSON)</td>
            <td>Finance · HR · CRM upgrade scheduled</td>
          </tr>
          <tr>
            <td><strong>ANPR / Traffic Sensors</strong></td>
            <td>Not yet deployed</td>
            <td><span class="iri-pill iri-poor">Under development</span></td>
            <td>-</td>
            <td>Roadside monitoring infrastructure pending</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Safety · NTSA')
</script>

<style scoped>
.page-tag { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
.page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:12px; }
.page-header h1 { font-size:20px; font-weight:600; color:#0f172a; margin:0; }
.header-btns { display:flex; gap:8px; }
.persona-ribbon { background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:6px; padding:8px 12px; font-size:11px; color:#475569; margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pr-chip { background:#e8f0f9; color:#1d5ca6; border-radius:3px; padding:2px 7px; font-size:10px; font-weight:500; }
.pr-chip.live { background:#dcfce7; color:#166534; }
.kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px; }
.kpi-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:10px 12px; position:relative; }
.kpi-source { position:absolute; top:8px; right:8px; }
.kpi-label { font-size:10px; color:#94a3b8; font-weight:500; margin-bottom:2px; }
.kpi-value { font-size:22px; font-weight:600; color:#0f172a; line-height:1.1; }
.kpi-value small { font-size:13px; font-weight:400; color:#64748b; }
.kpi-sub { font-size:10px; color:#64748b; margin-top:2px; }
.kpi-trend { font-size:11px; margin-top:3px; }
.kpi-trend.down { color:#991b1b; }
.src-chip { font-size:10px; font-weight:600; border-radius:3px; padding:2px 7px; letter-spacing:.04em; }
.src-chip.live { background:#dcfce7; color:#166534; }
.src-chip.batch { background:#e8f0f9; color:#1d5ca6; }
.charts-row { display:grid; grid-template-columns:1.4fr 1fr; gap:14px; }
.chart-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.chart-card h3 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
.chart-card h3 span { font-size:10px; font-weight:400; color:#94a3b8; }
.chart-meta { font-size:10px; color:#94a3b8; margin-top:8px; line-height:1.5; }
.map-wrap { border-radius:6px; overflow:hidden; border:0.5px solid #e2e8f0; }
.map-canvas { background:linear-gradient(135deg,#e8ecee,#dde2e5,#cfd5d9); position:relative; overflow:hidden; }
.map-legend { position:absolute; bottom:10px; right:10px; background:rgba(255,255,255,.92); border-radius:5px; padding:7px 10px; font-size:10px; display:flex; flex-direction:column; gap:4px; border:0.5px solid rgba(11,11,11,.08); }
.legend-item { display:flex; align-items:center; gap:5px; color:#374151; }
.blackspot { display:grid; grid-template-columns:repeat(8,1fr); gap:2px; height:120px; }
.blackspot div { border-radius:2px; background:#f1f5f9; }
.blackspot .h1 { background:rgba(239,68,68,.2); }
.blackspot .h2 { background:rgba(239,68,68,.45); }
.blackspot .h3 { background:rgba(239,68,68,.7); }
.blackspot .h4 { background:#ef4444; }
.lic-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.lic-item { background:#f8fafc; border-radius:6px; padding:10px 12px; }
.lic-label { font-size:10px; color:#94a3b8; font-weight:500; margin-bottom:4px; }
.lic-value { font-size:20px; font-weight:600; color:#0f172a; line-height:1.1; }
.lic-sub { font-size:10px; color:#64748b; margin-top:2px; }
.lic-sub.badge-crit { color:#991b1b; font-weight:600; }
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
