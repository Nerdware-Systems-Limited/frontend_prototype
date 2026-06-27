<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/ai-workbench.html
    h1: AI / ML Predictive Workbench
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<!-- Module M14 boundary banner -->
<div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-left:4px solid var(--accent);border-radius:3px;padding:10px 16px;font-size:12.5px;color:var(--fg2);">
  <span class="page-tag" style="margin:0;background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.4);color:var(--accent-dark);">Predictive Workbench</span>
  <span><strong>Predictive &amp; Prescriptive Analytics</strong> - forecasts <em>what will happen</em> and suggests actions. For historical explanations and policy-target reporting, use the <a to="/analytics-workbench" style="color:var(--primary);font-weight:600;">Analytics Workbench (M09)</a>.</span>
</div>

<div class="page-tag">Predictive Workbench</div>
<div class="page-header">
 <h1>AI / ML Predictive Workbench</h1>
 <div class="header-btns"><button>Model Registry</button><button class="btn-primary">New Forecast Job</button></div>
</div>
<div class="persona-ribbon"><strong>RBAC:</strong> Analyst persona · NLQ + forecast tooling<span class="pr-chip">Tenant: KeNHA</span></div>

<div class="nlq-bar">
 <div class="nlq-head"><span class="nlq-tag">Ask UAPTS</span><h3>Natural-language analytics</h3></div>
 <div class="nlq-input"><input placeholder='e.g. "Show predicted congestion on A104 for tomorrow morning"' value='Show predicted congestion on A104 for tomorrow morning' /><button>Ask</button></div>
 <div class="nlq-suggestions">
  <span>Forecast Mombasa Rd queue length next 4h</span>
  <span>Compare PSV fatality rate Q3 vs Q4</span>
  <span>Which weighbridges hit &gt;40 violations this week?</span>
  <span>Predicted IRI deterioration on B8 next 90 days</span>
 </div>
</div>

<div class="charts-row">
 <div class="chart-card">
  <h3>Congestion Prediction - A104 <span>LSTM · 2–4h horizon</span></h3>
  <div class="map-wrap"><div class="map-canvas" style="height:280px">
   <div class="map-road" style="width:84%;height:6px;top:48%;left:8%;background:linear-gradient(90deg,#22c55e 0% 30%,#f59e0b 30% 65%,#ef4444 65% 100%);opacity:.9"></div>
   <div id="map" style="width: 100%; height: 100%;"></div>
   <div class="map-legend">
    <div class="legend-item"><div class="legend-swatch" style="background:#22c55e"></div>Free flow (now)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#f59e0b"></div>+2h predicted</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#ef4444"></div>+4h predicted</div>
   </div>
  </div></div>
 </div>
 <div class="chart-card">
  <h3>Accident Risk Heatmap <span>Next 24h · road segment</span></h3>
  <div class="blackspot">
   <div></div><div class="h1"></div><div class="h2"></div><div class="h4"></div><div class="h3"></div><div class="h2"></div><div></div><div class="h1"></div>
   <div class="h2"></div><div class="h3"></div><div class="h4"></div><div class="h4"></div><div class="h3"></div><div class="h2"></div><div class="h1"></div><div></div>
   <div></div><div class="h1"></div><div class="h2"></div><div class="h3"></div><div class="h2"></div><div class="h1"></div><div></div><div></div>
   <div class="h1"></div><div></div><div class="h2"></div><div class="h4"></div><div class="h3"></div><div class="h1"></div><div></div><div></div>
  </div>
 </div>
</div>

<div class="chart-card">
 <h3>Active Models <span>Registered in M14</span></h3>
 <table>
  <thead><tr><th>Model</th><th>Type</th><th>Last trained</th><th>RMSE / F1</th><th>Status</th></tr></thead>
  <tbody>
   <tr><td>traffic-lstm-v4</td><td>LSTM</td><td>2h ago</td><td>RMSE 0.08</td><td><span class="badge success">Healthy</span></td></tr>
   <tr><td>accident-risk-xgb</td><td>XGBoost</td><td>1d ago</td><td>F1 0.81</td><td><span class="badge success">Healthy</span></td></tr>
   <tr><td>iri-deterioration-gbm</td><td>GBM</td><td>3d ago</td><td>RMSE 0.31</td><td><span class="badge warning">Drift +0.04</span></td></tr>
   <tr><td>port-throughput-prophet</td><td>Prophet</td><td>6h ago</td><td>RMSE 142 TEU</td><td><span class="badge success">Healthy</span></td></tr>
  </tbody>
 </table>
</div>

<div class="chart-card">
 <h3>Security Context - Privileged Operation</h3>
 <div class="mfa-state"><strong>Re-auth required to retrain model</strong><span class="pill totp">TOTP</span><span class="pill bio">Biometric</span><span style="margin-left:auto;color:var(--fg2)">Context-aware MFA · M06 / M12 hub edits</span></div>
 <div class="lock-overlay">
  <div class="lo-ic">!</div>
  <div><h4>Account Locked - three-strike failure rule</h4><p>User <code>k.otieno@kenha.go.ke</code> · 3 failed MFA challenges · auto-unlock in 14:32 or admin override required.</p></div>
 </div>
</div>

<!-- M14 vs M09 boundary reference -->
<div class="chart-card" style="margin-top:8px;">
 <h3>Module Boundary<span style="font-size:11px;color:var(--fg2);">What lives where</span></h3>
 <table>
  <thead>
   <tr>
    <th style="width:18%;">Dimension</th>
    <th style="width:41%;">AI Predictive Workbench &nbsp;<span class="badge" style="background:rgba(245,158,11,.15);color:var(--accent-dark);border:1px solid rgba(245,158,11,.3);">M14 · This Page</span></th>
    <th style="width:41%;">Analytics Workbench &nbsp;<span class="badge" style="background:rgba(0,104,56,.12);color:var(--primary);border:1px solid rgba(0,104,56,.25);">M09</span></th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td><strong>Primary Goal</strong></td>
    <td>Forecasting <em>future</em> states and anomalies</td>
    <td>Explaining <em>past and current</em> performance</td>
   </tr>
   <tr>
    <td><strong>Interaction Style</strong></td>
    <td>Unstructured: natural-language "Ask" interface</td>
    <td>Structured: filters, query builder, saved templates</td>
   </tr>
   <tr>
    <td><strong>Logic Layer</strong></td>
    <td>Probabilistic - LSTM, XGBoost, Prophet inference</td>
    <td>Relational - SQL aggregation over the warehouse</td>
   </tr>
   <tr>
    <td><strong>Typical Output</strong></td>
    <td>Live inferences - heatmaps, risk scores, forecasts</td>
    <td>Formal reports (PDF / XLS / CSV), KPI snapshots</td>
   </tr>
   <tr>
    <td><strong>Time Orientation</strong></td>
    <td>Predictive (T+1 and beyond)</td>
    <td>Historical (T-0 and earlier)</td>
   </tr>
  </tbody>
 </table>
  <div style="padding:12px 18px;border-top:1px solid var(--border);font-size:12px;color:var(--fg2);display:flex;justify-content:space-between;align-items:center;">
   <span>When you need to ask "what will happen, and what should we do?" - stay in M14. When you need "what happened, and why?" - go to <a to="/analytics-workbench" style="color:var(--primary);font-weight:600;">Analytics Workbench (M09)</a>.</span>
   <a class="btn btn-secondary" to="/analytics-workbench" style="padding:5px 12px;font-size:11.5px;text-decoration:none;">Open M09 →</a>
  </div>
</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('AI Predictive Workbench')
</script>
