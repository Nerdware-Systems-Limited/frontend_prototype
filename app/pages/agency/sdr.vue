<template>
  <div>
    <div class="page-tag">Agency Drill-Down · SDR</div>
    <div class="page-header">
      <h1>SDR - National Infrastructure Oversight</h1>
      <div class="header-btns">
        <button>Export FY Report</button>
        <button class="btn-primary">Reconcile Road Register</button>
      </div>
    </div>
    <div class="persona-ribbon">
      <strong>RBAC:</strong> Executive / Policy persona · cross-agency oversight · no operational dispatch
      <span class="pr-chip">Tenant: SDR</span>
      <span class="pr-chip">Systems: IFMIS · e-ProMIS · GHRIS · eGP · STEP</span>
      <span class="pr-chip batch">Manual / Batch · email / Excel / PDF</span>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="src-chip batch kpi-source" title="KRB/RMLF · Quarterly">RMLF · Quarterly</span>
        <div class="kpi-label">FY Budget Absorption (all agencies)</div>
        <div class="kpi-value">68%</div>
        <div class="kpi-sub">KES allocated vs disbursed across KeNHA, KURA, KeRRA, KRB</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source" title="Agency submissions · Manual">Agency submissions</span>
        <div class="kpi-label">Maintenance Backlog (national)</div>
        <div class="kpi-value">KES 142B</div>
        <div class="kpi-trend down">▲ 6.8% vs FY24</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">National Roads Register</span>
        <div class="kpi-label">National Network Length</div>
        <div class="kpi-value">165,182 <small>km</small></div>
        <div class="kpi-sub">Classified roads · all road classes</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">e-ProMIS · Monthly</span>
        <div class="kpi-label">Active Capital Projects</div>
        <div class="kpi-value">214</div>
        <div class="kpi-sub">Roads · bridges · LAPSSET corridor</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">Register · 30d</span>
        <div class="kpi-label">Register Changes (30d)</div>
        <div class="kpi-value">+318 <small>km</small></div>
        <div class="kpi-sub">12 reclassifications · 3 new additions</div>
      </div>
      <div class="kpi-card">
        <span class="src-chip batch kpi-source">Agency reports · Annual</span>
        <div class="kpi-label">Network in Good Condition</div>
        <div class="kpi-value">54%</div>
        <div class="kpi-sub">National average across all classes</div>
      </div>
    </div>

    <!-- Budget absorption table -->
    <div class="chart-card">
      <h3>Budget Absorption by Agency (FY25) <span>Source: IFMIS · Treasury batch upload · Quarterly</span></h3>
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th>UAPTS Integration</th>
            <th>Allocation (KES B)</th>
            <th>Spent (KES B)</th>
            <th>Absorption</th>
            <th>Maintenance Backlog</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>KeNHA</strong></td>
            <td><span class="int-chip api">REST API · ArcGIS</span></td>
            <td>92.4</td><td>71.0</td>
            <td><span class="iri-pill iri-good">77%</span></td>
            <td>KES 58B</td>
          </tr>
          <tr>
            <td><strong>KURA</strong></td>
            <td><span class="int-chip batch">Batch · PDF upload</span></td>
            <td>34.1</td><td>22.8</td>
            <td><span class="iri-pill iri-fair">67%</span></td>
            <td>KES 31B</td>
          </tr>
          <tr>
            <td><strong>KeRRA</strong></td>
            <td><span class="int-chip warn">ERP EOL · upgrading</span></td>
            <td>28.6</td><td>15.2</td>
            <td><span class="iri-pill iri-poor">53%</span></td>
            <td>KES 41B</td>
          </tr>
          <tr>
            <td><strong>KRB</strong></td>
            <td><span class="int-chip batch">Batch · RMLF reports</span></td>
            <td>11.2</td><td>9.4</td>
            <td><span class="iri-pill iri-good">84%</span></td>
            <td>-</td>
          </tr>
          <tr>
            <td><strong>NTSA</strong></td>
            <td><span class="int-chip api">REST API · iTIMS</span></td>
            <td>8.8</td><td>6.7</td>
            <td><span class="iri-pill iri-good">76%</span></td>
            <td>-</td>
          </tr>
          <tr>
            <td><strong>KMA</strong></td>
            <td><span class="int-chip warn">NAV 2018 · obsolescence</span></td>
            <td>4.2</td><td>2.1</td>
            <td><span class="iri-pill iri-poor">50%</span></td>
            <td>KES 12B</td>
          </tr>
        </tbody>
      </table>
      <div class="chart-meta">SDR receives data via manual submissions (email · Excel · PDF) - no direct system-to-system integration in place. UAPTS will be first centralised platform.</div>
    </div>

    <!-- e-ProMIS capital project portfolio -->
    <div class="chart-card" style="margin-top:14px">
      <h3>Capital Projects Portfolio <span>e-ProMIS · World Bank STEP · Monthly / Quarterly updates</span></h3>
      <table>
        <thead>
          <tr><th>Project</th><th>Agency</th><th>Value (KES B)</th><th>Progress</th><th>Status</th><th>Risk</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>A104 Nairobi–Nakuru Expressway</strong></td>
            <td>KeNHA</td><td>148.0</td><td>62%</td>
            <td><span class="iri-pill iri-fair">In progress</span></td>
            <td><span class="iri-pill iri-fair">Cost variance</span></td>
          </tr>
          <tr>
            <td><strong>A109 Mombasa–Nairobi Road Rehab</strong></td>
            <td>KeNHA</td><td>44.2</td><td>81%</td>
            <td><span class="iri-pill iri-good">On track</span></td>
            <td><span class="iri-pill iri-good">Low</span></td>
          </tr>
          <tr>
            <td><strong>LAPSSET Lamu Port Phase 2</strong></td>
            <td>LAPSSET</td><td>62.5</td><td>28%</td>
            <td><span class="iri-pill iri-poor">Delayed</span></td>
            <td><span class="iri-pill iri-poor">Funding gap</span></td>
          </tr>
          <tr>
            <td><strong>Rural Roads Rehabilitation (KeRRA)</strong></td>
            <td>KeRRA</td><td>18.4</td><td>45%</td>
            <td><span class="iri-pill iri-fair">In progress</span></td>
            <td><span class="iri-pill iri-fair">Weather risk</span></td>
          </tr>
          <tr>
            <td><strong>Nairobi Urban Roads (KURA)</strong></td>
            <td>KURA</td><td>22.8</td><td>54%</td>
            <td><span class="iri-pill iri-good">On track</span></td>
            <td><span class="iri-pill iri-good">Low</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- National roads register change log -->
    <div class="alert-section" style="margin-top:14px">
      <h3>National Roads Register - Change Log <span>165,000 km · SDR as custodian · UAPTS enforces common classification standards</span></h3>
      <div class="alert-item">
        <div class="alert-main">
          <span class="alert-badge info">ADD</span>
          <div>
            <div class="alert-title">+ 142 km · C-class roads (Turkana County)</div>
            <div class="alert-meta">KeRRA upload · 2 days ago · Verified by SDR Roads Directorate</div>
          </div>
        </div>
        <button class="ack-btn acked">Reviewed</button>
      </div>
      <div class="alert-item">
        <div class="alert-main">
          <span class="alert-badge warning">RECLASSIFY</span>
          <div>
            <div class="alert-title">D407 → B (upgrade) · Nakuru–Bahati corridor</div>
            <div class="alert-meta">KeNHA submission · 5 days ago · Pending finance impact review</div>
          </div>
        </div>
        <button class="ack-btn">Review</button>
      </div>
      <div class="alert-item">
        <div class="alert-main">
          <span class="alert-badge info">TRANSFER</span>
          <div>
            <div class="alert-title">+ 176 km · Estate roads transferred to KURA</div>
            <div class="alert-meta">Nairobi County → KURA · 1 week ago · Verified</div>
          </div>
        </div>
        <button class="ack-btn acked">Reviewed</button>
      </div>
      <div class="alert-item">
        <div class="alert-main">
          <span class="alert-badge warning">INCOMPLETE</span>
          <div>
            <div class="alert-title">14 KeRRA segments missing GIS attributes</div>
            <div class="alert-meta">Auto-detected by UAPTS register validation · 3 days ago</div>
          </div>
        </div>
        <button class="ack-btn">Resolve</button>
      </div>
    </div>

    <!-- SDR-MTD subsection -->
    <div class="chart-card" style="margin-top:14px">
      <h3>
        SDR-MTD - Mechanical &amp; Transport Directorate
        <span>Government fleet serviceability · MECH system (Python · on-premise · 2023)</span>
      </h3>
      <div class="mtd-grid">
        <div class="mtd-item">
          <div class="mtd-label">Govt fleet / equipment tracked</div>
          <div class="mtd-value">4,312 units</div>
          <div class="mtd-sub">MECH system · manual updates</div>
        </div>
        <div class="mtd-item">
          <div class="mtd-label">Serviceability rate</div>
          <div class="mtd-value">73%</div>
          <div class="mtd-sub">On-road vs total registered</div>
        </div>
        <div class="mtd-item">
          <div class="mtd-label">Inspection reports (quarterly)</div>
          <div class="mtd-value">~10,000</div>
          <div class="mtd-sub">Word / Excel · field officers</div>
        </div>
        <div class="mtd-item">
          <div class="mtd-label">Real-time location</div>
          <div class="mtd-value warn">Not deployed</div>
          <div class="mtd-sub">Priority: digitised inspection + GPS</div>
        </div>
      </div>
      <div class="chart-meta" style="margin-top:10px">
        Critical gap: MECH system not integrated with fleet system - manual updates required. SDR-MTD identified digitised real-time inspection recording as highest UAPTS priority.
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Oversight · SDR')
</script>

<style scoped>
.page-tag { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
.page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:12px; }
.page-header h1 { font-size:20px; font-weight:600; color:#0f172a; margin:0; }
.header-btns { display:flex; gap:8px; }
.persona-ribbon { background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:6px; padding:8px 12px; font-size:11px; color:#475569; margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pr-chip { background:#e8f0f9; color:#1d5ca6; border-radius:3px; padding:2px 7px; font-size:10px; font-weight:500; }
.pr-chip.batch { background:#f8fafc; color:#64748b; }
.kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px; }
.kpi-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:10px 12px; position:relative; }
.kpi-source { position:absolute; top:8px; right:8px; }
.kpi-label { font-size:10px; color:#94a3b8; font-weight:500; margin-bottom:2px; }
.kpi-value { font-size:22px; font-weight:600; color:#0f172a; line-height:1.1; }
.kpi-value small { font-size:13px; font-weight:400; color:#64748b; }
.kpi-sub { font-size:10px; color:#64748b; margin-top:2px; }
.kpi-trend.down { font-size:11px; color:#991b1b; margin-top:3px; }
.src-chip { font-size:10px; font-weight:600; border-radius:3px; padding:2px 7px; letter-spacing:.04em; }
.src-chip.batch { background:#e8f0f9; color:#1d5ca6; }
.chart-card { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.chart-card h3 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.chart-card h3 span { font-size:10px; font-weight:400; color:#94a3b8; }
.chart-meta { font-size:10px; color:#94a3b8; line-height:1.5; }
.int-chip { font-size:10px; font-weight:500; border-radius:3px; padding:2px 7px; }
.int-chip.api { background:#dcfce7; color:#166534; }
.int-chip.batch { background:#e8f0f9; color:#1d5ca6; }
.int-chip.warn { background:#fef9c3; color:#854d0e; }
.alert-section { background:#fff; border:0.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.alert-section h3 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.alert-section h3 span { font-size:10px; font-weight:400; color:#94a3b8; }
.alert-item { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:0.5px solid #f1f5f9; gap:12px; }
.alert-item:last-child { border-bottom:none; }
.alert-main { display:flex; align-items:flex-start; gap:10px; }
.alert-badge { font-size:9px; font-weight:700; padding:2px 7px; border-radius:3px; letter-spacing:.06em; text-transform:uppercase; flex-shrink:0; }
.alert-badge.info { background:#e8f0f9; color:#1d5ca6; }
.alert-badge.warning { background:#fef9c3; color:#854d0e; }
.alert-title { font-size:12px; font-weight:500; color:#0f172a; }
.alert-meta { font-size:10px; color:#94a3b8; margin-top:2px; }
.ack-btn { font-size:11px; padding:4px 12px; border-radius:4px; border:0.5px solid #e2e8f0; background:#fff; cursor:pointer; color:#334155; white-space:nowrap; }
.ack-btn.acked { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th { text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; padding:6px 10px; border-bottom:0.5px solid #e2e8f0; }
td { padding:8px 10px; border-bottom:0.5px solid #f1f5f9; color:#334155; }
tr:last-child td { border-bottom:none; }
.iri-pill { font-size:11px; font-weight:600; padding:3px 10px; border-radius:3px; white-space:nowrap; }
.iri-pill.iri-good { background:#dcfce7; color:#166534; }
.iri-pill.iri-fair { background:#fef9c3; color:#854d0e; }
.iri-pill.iri-poor { background:#ffedd5; color:#9a3412; }
.iri-pill.iri-vpoor { background:#fee2e2; color:#991b1b; }
.mtd-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.mtd-item { background:#f8fafc; border-radius:6px; padding:10px 12px; }
.mtd-label { font-size:10px; color:#94a3b8; font-weight:500; margin-bottom:4px; }
.mtd-value { font-size:18px; font-weight:600; color:#0f172a; line-height:1.1; }
.mtd-value.warn { font-size:14px; color:#854d0e; }
.mtd-sub { font-size:10px; color:#64748b; margin-top:2px; }
button { padding:7px 14px; border-radius:6px; font-size:12px; font-weight:500; border:0.5px solid #e2e8f0; background:#fff; cursor:pointer; color:#334155; }
.btn-primary { background:#006838; color:#fff; border-color:#006838; }
</style>
