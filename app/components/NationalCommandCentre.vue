<template>
  <!--
    Executive Dashboard - real-API edition.
    Fetches all six domain summaries in parallel:
      safety, fleet, railway, aviation, maritime, infrastructure,
      public-transport, integrations.
    Any single failure degrades that section gracefully; the rest keep rendering.
  -->
  <header class="cmd-header">
    <div class="cmd-header-main">
      <h1>Command Centre</h1>
      <p class="cmd-dek">Unified oversight across Kenya's transport agencies and modes</p>
    </div>
  </header>

  <!-- Global error banner - shown on partial or total fetch failure -->
  <div v-if="error" class="error-banner">
    <span>⚠ {{ error }}</span>
    <button type="button" class="error-retry-btn" :disabled="loading" @click="load">
      {{ loading ? 'Retrying…' : 'Retry' }}
    </button>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       1. NATIONAL TRANSPORT HEALTH - top-level KPI ribbon
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    National transport health
    <span class="section-pill">6 domains</span>
  </div>

  <div class="kpi-grid kpi-grid-primary">
    <KpiCard
      to="/safety"
      prominent
      label="Road Safety"
      v-bind="safetyView"
      :loading="!safety && loading"
      source="live"
      source-label="NTSA IRSMS"
    />
    <KpiCard
      to="/fleet"
      prominent
      label="Active Fleet"
      v-bind="fleetView"
      :loading="!fleet && loading"
      source="live"
      source-label="NTSA iTIMS"
    />
    <KpiCard
      to="/railway"
      prominent
      label="Rail Network"
      v-bind="railView"
      :loading="!rail && loading"
      source="live"
      source-label="KRC Operations"
    />
    <KpiCard
      to="/aviation?window=7"
      prominent
      label="Aviation"
      v-bind="aviationView"
      :loading="!aviation && loading"
      source="live"
      source-label="KAA / KCAA"
    />
    <KpiCard
      to="/maritime?window=30"
      prominent
      label="Ports & Logistics"
      v-bind="portView"
      :loading="!maritime && loading"
      source="batch"
      source-label="KPA Mombasa"
    />
    <KpiCard
      to="/infrastructure"
      prominent
      label="Road Infrastructure"
      v-bind="infraView"
      :loading="!infra && loading"
      source="batch"
      source-label="KeNHA / KURA / KeRRA"
    />
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       2. ROAD SAFETY & INCIDENT MANAGEMENT
       (Kept by request - the other four detail sections that used to sit
       here - Fleet detail, Passenger Counts, Infrastructure detail, Port
       detail - were removed as unlinked restatements of domains the ribbon
       above already summarizes and links out to; this one stays.)
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Road Safety &amp; Incident Management
    <span class="section-pill" v-if="safety">NTSA IRSMS · {{ freshnessLabel(safety.generated_at) }}</span>
  </div>

  <div class="kpi-subgroup-label">Incident load</div>
  <div class="kpi-grid">
    <KpiCard
      to="/safety/incidents"
      label="Incidents today"
      v-bind="incidents24hView"
      :loading="!safety && loading"
      source="live"
      source-label="NTSA IRSMS"
    />
    <KpiCard
      to="/safety/incidents"
      label="Incidents"
      v-bind="incidents7dView"
      :loading="!safety && loading"
      source="live"
      source-label="NTSA IRSMS"
    />
    <KpiCard
      to="/safety/kpis"
      label="Fatalities"
      v-bind="fatalities30dView"
      :loading="!safety && loading"
      source="live"
      source-label="NTSA IRSMS + NPS"
    />
  </div>

  <div class="kpi-subgroup-label">Risk &amp; response</div>
  <div class="kpi-grid">
    <KpiCard
      to="/safety/blackspots"
      label="Critical black spots"
      v-bind="blackspotsView"
      :loading="!safety && loading"
      source="batch"
      source-label="NTSA KDE analysis"
    />
    <KpiCard
      to="/safety/incidents"
      label="Emergency dispatches"
      v-bind="dispatchesView"
      :loading="!safety && loading"
      source="live"
      source-label="NPS / NTSA"
    />
    <KpiCard
      to="/safety/kpis"
      label="Intervention effectiveness"
      v-bind="interventionView"
      :loading="!safety && loading"
      source="batch"
      source-label="KeNHA / NTSA"
    />
  </div>

  <!-- 30-day fatality trend - same component as Safety Overview's (/safety)
       card of the same name, so the two don't drift into two different
       chart styles for the same underlying metric. -->
  <div v-if="hasFatalityTrend" class="card">
    <div class="card-header">
      30-Day Fatality Trend
      <NuxtLink to="/safety/kpis" class="section-link">Full trend &amp; county breakdown →</NuxtLink>
    </div>
    <div class="card-body sparkline-wrap">
      <div class="sparkline-bars">
        <div
          v-for="d in safety!.fatality_trend_30d.slice(-30)"
          :key="d.day"
          class="spark-bar"
          :class="d.fatalities > 5 ? 'spark-red' : d.fatalities > 2 ? 'spark-amber' : 'spark-green'"
          :style="{ height: `${Math.max(6, (d.fatalities / maxFatalities) * 100)}%` }"
          :title="`${d.day}: ${d.fatalities} fatalities`"
        />
      </div>
    </div>
    <div class="card-footer-hint">
      <span class="hint-dot" style="background:var(--destructive)" /> &gt;5 fatal
      <span class="hint-dot" style="background:var(--warning);margin-left:8px" /> 3–5
      <span class="hint-dot" style="background:var(--success);margin-left:8px" /> 0–2
    </div>
  </div>
  <div v-else class="card">
    <div class="card-header">
      30-Day Fatality Trend
      <NuxtLink to="/safety/kpis" class="section-link">Full trend &amp; county breakdown →</NuxtLink>
    </div>
    <EmptyState
      :loading="loading"
      :message="safety?.fatality_trend_30d?.length
        ? `Only ${safety.fatality_trend_30d.length} day-bucket(s) of trend data available - too sparse for a daily chart.`
        : 'No fatality trend data for this period.'"
      compact
    />
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       3. GIS MAP + ACTIVE ALERTS WIDGET
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">National Incident Heatmap</div>

  <div class="map-alerts-row">
    <div class="map-wrap">
      <div class="map-wrap-head">
        Predictive risk hotspots &amp; black spot clusters
        <span class="map-head-meta">
          {{ hotspots.length }} hotspots · {{ blackspots.filter(b => b.centroid_latitude != null).length }} black spots
          <template v-if="roads"> · road network</template>
        </span>
        <NuxtLink to="/safety/blackspots" class="section-link">Full blackspot analysis &amp; map →</NuxtLink>
      </div>
      <ClientOnly>
        <UaptsMap
          :markers="mapMarkers"
          :roads="roads ?? undefined"
          :center="[-0.5, 37.5]"
          :zoom="6"
          height="300px"
        />
        <template #fallback>
          <div style="height:300px;background:var(--surface-sunken);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:11px;color:var(--fg-3)">Loading map…</span>
          </div>
        </template>
      </ClientOnly>
      <!-- Risk tier legend -->
      <div class="map-legend-strip">
        <span class="map-legend-title">Risk tier</span>
        <span class="map-legend-item"><span class="map-dot" style="background:var(--destructive)"></span>Critical</span>
        <span class="map-legend-item"><span class="map-dot" style="background:#f97316"></span>High</span>
        <span class="map-legend-item"><span class="map-dot" style="background:var(--warning)"></span>Medium</span>
        <span class="map-legend-item"><span class="map-dot" style="background:var(--border-strong)"></span>Low</span>
        <span class="map-legend-sep"></span>
        <span class="map-legend-item map-legend-dim"><span class="map-dot map-dot-sm" style="background:#f97316"></span>Black spot</span>
        <template v-if="roads">
          <span class="map-legend-sep"></span>
          <span class="map-legend-item map-legend-dim"><span class="map-dash" style="background:var(--fg-2)"></span>Roads</span>
        </template>
      </div>
    </div>

    <div class="alerts-section">
      <div class="alerts-head">
        Active alerts
        <span class="alerts-count">{{ activeAlerts.length }}</span>
      </div>

      <div class="alerts-body">
        <NuxtLink
          v-for="alert in activeAlerts"
          :key="alert.to + alert.title"
          :to="alert.to"
          class="alert-item alert-item-link"
          :class="alert.severity"
        >
          <div class="alert-main">
            <div class="alert-title">{{ alert.title }}</div>
            <div class="alert-meta">{{ alert.meta }}</div>
          </div>
          <span class="alert-chevron" aria-hidden="true">→</span>
        </NuxtLink>

        <div
          v-if="!loading && activeAlerts.length === 0"
          class="alert-item success"
        >
          <div class="alert-main">
            <div class="alert-title">All systems nominal - no active escalations</div>
            <div class="alert-meta">UAPTS Platform · Live</div>
          </div>
        </div>

        <div v-if="loading && activeAlerts.length === 0" class="alerts-loading">
          Loading alerts…
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       5. AGENCY DRILL-DOWN PREVIEWS (real data)
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Agency Drill-Downs
    <span class="section-pill">11 agencies · RBAC scoped</span>
  </div>

  <!-- Row 1: Road infrastructure agencies -->
  <div class="agency-grid">
    <!-- KeNHA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KeNHA - Road asset manager</div>
        <span class="agency-tag">REST API · ArcGIS · Hybrid</span>
      </div>
      <template v-if="infra">
        <div class="agency-row">
          <span class="agency-row-label">Network in good condition</span>
          <span class="badge" :class="infraGoodPct >= 60 ? 'good' : 'warn'">{{ fmtPct(infraGoodPct) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Avg IRI score</span>
          <span class="badge info">{{ infra.network.iri_average?.toFixed(2) ?? '-' }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Bridges critical</span>
          <span class="badge" :class="infra.bridges.critical_count > 0 ? 'warn' : 'good'">
            {{ fmtNum(infra.bridges.critical_count) }} / {{ fmtNum(infra.bridges.total) }}
          </span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Maintenance backlog</span>
          <span class="badge crit">KES {{ fmtKsh(infra.maintenance.open_value_kes) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">At-risk segments (12mo)</span>
          <span class="badge warn">{{ fmtNum(infra.predictive.at_risk_segments_12mo) }}</span>
        </div>
      </template>
      <div v-else class="agency-loading">Loading road data…</div>
      <NuxtLink to="/traffic" class="agency-link">Open KeNHA workspace →</NuxtLink>
    </div>

    <!-- NTSA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">NTSA - Safety &amp; enforcement</div>
        <span class="agency-tag">Live · iTIMS · IRSMS</span>
      </div>
      <template v-if="safety && fleet">
        <div class="agency-row">
          <span class="agency-row-label">Vehicle registry (iTIMS)</span>
          <span class="badge info">{{ fmtNum(fleet.kpis.total_vehicles) }} records</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Active road incidents</span>
          <span class="badge" :class="safetyBadge">{{ fmtNum(safety.kpis.active) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Fatalities (30d)</span>
          <span class="badge crit">{{ fmtNum(safety.kpis.fatal_30d) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Critical black spots</span>
          <span class="badge warn">{{ fmtNum(safety.black_spots_by_tier['critical'] ?? 0) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Governor tamper rate</span>
          <span class="badge" :class="fleet.governor_compliance.tamper_rate_pct < 5 ? 'good' : 'warn'">
            {{ fmtPct(fleet.governor_compliance.tamper_rate_pct) }}
          </span>
        </div>
      </template>
      <div v-else class="agency-loading">Loading NTSA data…</div>
      <NuxtLink to="/fleet" class="agency-link">Open NTSA workspace →</NuxtLink>
    </div>

    <!-- KeRRA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KeRRA - Rural roads authority</div>
        <span class="agency-tag">Batch · ERP upgrading</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Rural network managed</span>
        <span class="badge info">28,150 km</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Paved / Gravel / Earth</span>
        <span class="badge info">5,163 / 15,440 / 7,546 km</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Regional offices</span>
        <span class="badge info">47 WAN-connected</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">ERP status</span>
        <span class="badge warn">Business Central V14 · EOL</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Safety · GIS · Predictive</span>
      </div>
      <NuxtLink to="/infrastructure" class="agency-link">Open infrastructure workspace →</NuxtLink>
    </div>
  </div>

  <!-- Row 2: Ports, maritime and aviation -->
  <div class="agency-grid" style="margin-top:8px">
    <!-- KPA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KPA - Port of Mombasa</div>
        <span class="agency-tag">PMIS · VTMIS · REST API</span>
      </div>
      <template v-if="portList.length">
        <div class="agency-row" v-for="port in portList.slice(0, 2)" :key="port.port_unlocode">
          <span class="agency-row-label">{{ port.port_name }} TEUs (30d)</span>
          <span class="badge good">{{ fmtNum(port.teu_throughput_30d) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Live vessels in port</span>
          <span class="badge good">{{ fmtNum(maritime?.kpis.live_vessels ?? 0) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Avg yard dwell time</span>
          <span class="badge" :class="portDwellOk ? 'good' : 'warn'">{{ portAvgDwellLabel }}</span>
        </div>
      </template>
      <div class="agency-row">
        <span class="agency-row-label">SAP + KWATOS status</span>
        <span class="badge warn">End-of-life · active replacement</span>
      </div>
      <div v-if="!portList.length" class="agency-loading">Loading KPA data…</div>
      <NuxtLink to="/maritime" class="agency-link">Open maritime workspace →</NuxtLink>
    </div>

    <!-- KMA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KMA - Kenya Maritime Authority</div>
        <span class="agency-tag">NAV 2018 · Hybrid</span>
      </div>
      <template v-if="maritime">
        <div class="agency-row">
          <span class="agency-row-label">Maritime incidents (30d)</span>
          <span class="badge" :class="maritime.kpis.incidents_30d > 5 ? 'warn' : 'good'">
            {{ fmtNum(maritime.kpis.incidents_30d) }}
          </span>
        </div>
      </template>
      <div class="agency-row">
        <span class="agency-row-label">Casualties on record (2025)</span>
        <span class="badge warn">127</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">PSC inspection records</span>
        <span class="badge info">Active · vessel compliance</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">ERP status</span>
        <span class="badge warn">Dynamics NAV 2018 · obsolescence</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Maritime · GIS · Access Control</span>
      </div>
      <NuxtLink to="/maritime" class="agency-link">Open maritime workspace →</NuxtLink>
    </div>

    <!-- KAA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KAA - Airports authority</div>
        <span class="agency-tag">Live · KAA / KCAA</span>
      </div>
      <template v-if="aviation">
        <div class="agency-row">
          <span class="agency-row-label">Flight movements (7d)</span>
          <span class="badge good">{{ fmtNum(aviation.kpis.flights_total) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Passenger throughput (7d)</span>
          <span class="badge good">{{ fmtNum(aviation.kpis.pax_total) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">On-time performance</span>
          <span class="badge" :class="aviation.kpis.otp_pct >= 85 ? 'good' : 'warn'">
            {{ fmtPct(aviation.kpis.otp_pct) }}
          </span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Air cargo (7d)</span>
          <span class="badge info">{{ fmtKsh(aviation.kpis.cargo_kg_total / 1000) }} t</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Avg delay</span>
          <span class="badge" :class="(aviation.kpis.avg_delay_min ?? 0) < 15 ? 'good' : 'warn'">
            {{ aviation.kpis.avg_delay_min?.toFixed(0) ?? '-' }} min
          </span>
        </div>
      </template>
      <div v-else class="agency-loading">Loading KAA data…</div>
      <NuxtLink to="/aviation" class="agency-link">Open aviation workspace →</NuxtLink>
    </div>
  </div>

  <!-- Row 3: Rail, metro transport, northern corridor -->
  <div class="agency-grid" style="margin-top:8px">
    <!-- KRC -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">KRC - Railways corporation</div>
        <span class="agency-tag">SAP S4/HANA · CTC · CSV</span>
      </div>
      <template v-if="rail">
        <div class="agency-row">
          <span class="agency-row-label">SGR on-time performance (30d)</span>
          <span class="badge" :class="rail.on_time_30d.on_time_pct >= 80 ? 'good' : 'warn'">
            {{ fmtPct(rail.on_time_30d.on_time_pct) }}
          </span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Ridership (30d)</span>
          <span class="badge good">{{ fmtNum(rail.ridership_30d.passengers) }}</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Freight tonnage (30d)</span>
          <span class="badge good">{{ fmtNum(rail.freight_30d.total_tons) }} t</span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Avg delay</span>
          <span class="badge" :class="rail.on_time_30d.avg_delay_min < 10 ? 'good' : 'warn'">
            {{ rail.on_time_30d.avg_delay_min?.toFixed(1) }} min
          </span>
        </div>
      </template>
      <div class="agency-row">
        <span class="agency-row-label">MGR legacy systems (Translogic/ATW)</span>
        <span class="badge crit">End-of-life · failure risk</span>
      </div>
      <div v-if="!rail" class="agency-loading">Loading KRC data…</div>
      <NuxtLink to="/railway" class="agency-link">Open rail workspace →</NuxtLink>
    </div>

    <!-- NaMATA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">NaMATA - Metro transport authority</div>
        <span class="agency-tag">CSV · No AVL deployed</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">BRT corridors active</span>
        <span class="badge warn">Partial · Route 111 pilot</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Digital matatu routes</span>
        <span class="badge info">GTFS-compatible (GIS)</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Real-time AVL tracking</span>
        <span class="badge warn">Not yet deployed</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">AFC / unified ticketing</span>
        <span class="badge warn">Cash-based · no integration</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Public Transport · Fleet · GIS</span>
      </div>
      <NuxtLink to="/public-transport" class="agency-link">Open public transport workspace →</NuxtLink>
    </div>

    <!-- NCTTCA -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">NCTTCA - Northern Corridor authority</div>
        <span class="agency-tag">REST API · 6 member states</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Corridor KPIs tracked</span>
        <span class="badge info">35+ · published monthly</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Border posts monitored</span>
        <span class="badge info">11 OSBPs</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">RECTS cargo tracking</span>
        <span class="badge good">Active · GPS + seal tamper</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Reporting lag (current)</span>
        <span class="badge warn">Monthly · seeking near-RT</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Freight · Data Hub · Dashboard</span>
      </div>
      <NuxtLink to="/maritime" class="agency-link">Open corridor workspace →</NuxtLink>
    </div>
  </div>

  <!-- Row 4: Oversight, corridor development, mechanical directorate -->
  <div class="agency-grid" style="margin-top:8px">
    <!-- SDR – Roads Directorate -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">SDR - National roads oversight</div>
        <span class="agency-tag">IFMIS · e-ProMIS · Manual</span>
      </div>
      <template v-if="infra">
        <div class="agency-row">
          <span class="agency-row-label">Budget absorption (FY)</span>
          <span class="badge" :class="infra.budget.utilization_pct >= 60 ? 'good' : 'warn'">
            {{ fmtPct(infra.budget.utilization_pct) }}
          </span>
        </div>
        <div class="agency-row">
          <span class="agency-row-label">Maintenance backlog (all agencies)</span>
          <span class="badge crit">KES {{ fmtKsh(infra.maintenance.open_value_kes) }}</span>
        </div>
      </template>
      <div class="agency-row">
        <span class="agency-row-label">National roads register</span>
        <span class="badge info">165,000 km</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Data integration mode</span>
        <span class="badge warn">Manual · email / Excel / PDF</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Infrastructure · GIS · Predictive</span>
      </div>
      <div v-if="!infra" class="agency-loading">Loading SDR data…</div>
      <NuxtLink to="/infrastructure" class="agency-link">Open SDR workspace →</NuxtLink>
    </div>

    <!-- LAPSSET -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">LAPSSET - Corridor Dev. Authority</div>
        <span class="agency-tag">Manual · Periodic reporting</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Corridor components</span>
        <span class="badge info">Road · Rail · Pipeline · Port</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Port of Lamu</span>
        <span class="badge warn">Partial operations</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Enterprise systems</span>
        <span class="badge warn">None · Excel / Word / PDF</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Integration mode</span>
        <span class="badge info">Periodic · no real-time feeds</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Revenue · GIS · Predictive · C&amp;C</span>
      </div>
      <NuxtLink to="/infrastructure" class="agency-link">Open infrastructure workspace →</NuxtLink>
    </div>

    <!-- SDR-MTD -->
    <div class="agency-card">
      <div class="agency-card-head">
        <div class="agency-card-title">SDR-MTD - Mechanical &amp; Transport</div>
        <span class="agency-tag">MECH System · CSV / Manual</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Govt fleet serviceability</span>
        <span class="badge info">Tracked via MECH system</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Inspection reports (quarterly)</span>
        <span class="badge info">~10,000 reports</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">Real-time equipment location</span>
        <span class="badge warn">Not deployed</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">MECH → fleet integration</span>
        <span class="badge warn">Manual · not linked</span>
      </div>
      <div class="agency-row">
        <span class="agency-row-label">UAPTS modules</span>
        <span class="badge info">Infrastructure · Fleet · GIS</span>
      </div>
      <NuxtLink to="/infrastructure" class="agency-link">Open SDR workspace →</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useSafety, useFleet, useRailway, useAviationMaritime,
  useInfrastructure, useIntegrations, useGis,
} from '~/composables/api'
import type {
  SafetySummary, FleetSummary, RailwaySummary,
  AviationSummary, MaritimeOps, InfrastructureSummary,
  Integration, PredictiveHotspot, BlackSpot, GeoJSONFeatureCollection,
  AgencyContribution,
} from '~/composables/api'

type MarkerSpec = import('~/components/UaptsMap.vue').MarkerSpec

// ── Domain data refs ───────────────────────────────────────────────────
const safety       = ref<SafetySummary | null>(null)
const fleet        = ref<FleetSummary | null>(null)
const rail         = ref<RailwaySummary | null>(null)
const aviation     = ref<AviationSummary | null>(null)
const maritime     = ref<MaritimeOps | null>(null)
const infra        = ref<InfrastructureSummary | null>(null)
const integrations = ref<Integration[]>([])
const agencyContributions = ref<AgencyContribution[]>([])
const hotspots     = ref<PredictiveHotspot[]>([])
const blackspots   = ref<BlackSpot[]>([])
const roads        = ref<GeoJSONFeatureCollection | null>(null)

const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')

// ── Per-domain failure flags - drive the "data unavailable" KPI caption ──
const safetyFailed    = ref(false)
const fleetFailed     = ref(false)
const railFailed      = ref(false)
const aviationFailed  = ref(false)
const maritimeFailed  = ref(false)
const infraFailed     = ref(false)

// ── Integration Hub summary counts - full feed table/filtering now
// lives on /integrations/analytics; this stays a 3-number pointer. ──────
const integrationCounts = computed(() => {
  const counts: Record<string, number> = { connected: 0, degraded: 0, pending: 0, disconnected: 0 }
  for (const f of integrations.value) counts[f.status] = (counts[f.status] ?? 0) + 1
  return counts
})

// ── Fetch all summaries in parallel ───────────────────────────────────
async function load() {
  loading.value = true
  error.value = null

  const safetyApi = useSafety()
  const fleetApi  = useFleet()
  const railApi   = useRailway()
  const avApi     = useAviationMaritime()
  const infraApi  = useInfrastructure()
  const intsApi   = useIntegrations()

  const [
    safetyRes, fleetRes, railRes, aviationRes,
    maritimeRes, infraRes, intsRes, agencyContribRes, hotspotsRes, blackspotsRes, roadsRes,
  ] = await Promise.allSettled([
    safetyApi.summary(),
    fleetApi.summary(),
    railApi.summary(),
    avApi.aviationSummary(7),
    avApi.maritimeOperations(30),
    infraApi.summary(),
    intsApi.list({ page_size: 50 }),
    intsApi.agencyContributions('30d'),
    safetyApi.hotspots({ page_size: 30 }),
    safetyApi.topBlackspots(),
    useGis().roads({ limit: 300, simplify: 0.02 }),
  ])

  if (safetyRes.status     === 'fulfilled') safety.value       = safetyRes.value
  if (fleetRes.status      === 'fulfilled') fleet.value        = fleetRes.value
  if (railRes.status       === 'fulfilled') rail.value         = railRes.value
  if (aviationRes.status   === 'fulfilled') aviation.value     = aviationRes.value
  if (maritimeRes.status   === 'fulfilled') maritime.value     = maritimeRes.value
  if (infraRes.status      === 'fulfilled') infra.value        = infraRes.value
  if (intsRes.status       === 'fulfilled') integrations.value = (intsRes.value as any).results ?? []
  if (agencyContribRes.status === 'fulfilled') agencyContributions.value = agencyContribRes.value
  if (hotspotsRes.status   === 'fulfilled') hotspots.value     = (hotspotsRes.value as any).results ?? []
  if (blackspotsRes.status === 'fulfilled') blackspots.value   = (blackspotsRes.value as any).results ?? []
  if (roadsRes.status      === 'fulfilled') roads.value        = roadsRes.value

  safetyFailed.value   = safetyRes.status   === 'rejected'
  fleetFailed.value    = fleetRes.status    === 'rejected'
  railFailed.value     = railRes.status     === 'rejected'
  aviationFailed.value = aviationRes.status === 'rejected'
  maritimeFailed.value = maritimeRes.status === 'rejected'
  infraFailed.value    = infraRes.status    === 'rejected'

  const failedDomains = [
    safetyFailed.value   && 'Road Safety',
    fleetFailed.value    && 'Fleet',
    railFailed.value     && 'Rail',
    aviationFailed.value && 'Aviation',
    maritimeFailed.value && 'Maritime',
    infraFailed.value    && 'Infrastructure',
  ].filter(Boolean) as string[]

  error.value = failedDomains.length === 6
    ? 'Unable to reach the UAPTS API. Verify your connection and that the backend is running.'
    : failedDomains.length > 0
      ? `${failedDomains.join(', ')} ${failedDomains.length > 1 ? 'are' : 'is'} temporarily unavailable. Other sections show live data.`
      : null

  // UTC, to match the utcClock on the same line of the command header.
  lastRefreshed.value = new Date().toISOString().slice(11, 16)
  loading.value = false
}

onMounted(load)

useNavSubtitle('Command Centre')

// ── Command-header readout ─────────────────────────────────────────────
const systemStatus = computed((): { tone: 'good' | 'warn' | 'crit'; label: string } => {
  const hasCrit = activeAlerts.value.some(a => a.severity === 'critical')
  const hasWarn = activeAlerts.value.some(a => a.severity === 'warning')
  if (hasCrit) return { tone: 'crit', label: 'Attention required' }
  if (hasWarn) return { tone: 'warn', label: 'Elevated' }
  return { tone: 'good', label: 'System nominal' }
})

const utcClock = ref('--:--:-- UTC')

// Auto-refresh every 2 minutes + live UTC clock
let refreshTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshTimer = setInterval(load, 120_000)
  const tick = () => { utcClock.value = `${new Date().toISOString().slice(11, 19)} UTC` }
  tick()
  clockTimer = setInterval(tick, 1000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (clockTimer) clearInterval(clockTimer)
})

// ── Formatters ─────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return `${v.toFixed(1)}%`
}
function fmtKsh(v: string | number | null | undefined): string {
  if (v == null) return '-'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return '-'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
function freshnessLabel(iso: string | undefined): string {
  if (!iso) return 'unknown'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 2) return 'Live'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ago`
  } catch { return 'unknown' }
}

// ── Derived: Safety badge ──────────────────────────────────────────────
const safetyBadge = computed((): 'crit' | 'warn' | 'good' | 'loading' => {
  if (!safety.value) return safetyFailed.value ? 'warn' : 'loading'
  if (safety.value.kpis.active > 10 || safety.value.kpis.fatal_30d > 20) return 'crit'
  if (safety.value.kpis.active > 5  || safety.value.kpis.fatal_30d > 10) return 'warn'
  return 'good'
})

// ── Derived: Fleet badge ───────────────────────────────────────────────
const fleetBadge = computed((): 'crit' | 'warn' | 'good' | 'loading' => {
  if (!fleet.value) return fleetFailed.value ? 'warn' : 'loading'
  const tamperRate = fleet.value.governor_compliance.tamper_rate_pct
  const trackedPct = fleet.value.kpis.total_vehicles > 0
    ? (fleet.value.kpis.live_vehicles / fleet.value.kpis.total_vehicles) * 100
    : 0
  if (tamperRate > 10 || trackedPct < 20) return 'crit'
  if (tamperRate > 5  || trackedPct < 40) return 'warn'
  return 'good'
})

// ── Derived: Infrastructure good % ────────────────────────────────────
const infraGoodPct = computed((): number => {
  if (!infra.value?.network?.condition_distribution) return 0
  const total = infra.value.network.condition_distribution.reduce((s, c) => s + (c.length || 0), 0)
  const good  = infra.value.network.condition_distribution
    .filter(c => c.condition_class === 'good')
    .reduce((s, c) => s + (c.length || 0), 0)
  return total > 0 ? (good / total) * 100 : 0
})

// ── Derived: Port KPIs ─────────────────────────────────────────────────
const portList = computed(() => maritime.value?.ports ?? [])
const portAvgDwell = computed(() => {
  if (!portList.value.length) return null
  const avg = portList.value.reduce((s, p) => s + (p.avg_yard_dwell_days || 0), 0) / portList.value.length
  return avg
})
const portAvgDwellLabel = computed(() =>
  portAvgDwell.value != null ? `Avg dwell: ${portAvgDwell.value.toFixed(1)} days` : '-',
)
const portDwellOk = computed(() => portAvgDwell.value != null && portAvgDwell.value < 5)

/* ── KPI card view-models ─────────────────────────────────────────────
   One resolver per dashboard KPI. Each returns props for <KpiCard>.

   Honest-data rules baked in here:
   - A failed fetch or a null field renders `-` + a plain note, never `0`.
   - A real `0` that means "nothing ran / nothing recorded" is labelled as
     such and is NOT scored green.
   - `delta` is only ever set from arithmetic on values the API actually
     returned (7d-vs-30d pace, first-half-vs-second-half of the real
     fatality series). No target lines and no invented prior-period
     numbers - those slots stay dormant until the backend ships them.

   Status thresholds are operational heuristics (the same ones the badge
   logic already used), pending agency-published targets. When those
   arrive, pass `:target` and swap these for the real comparison. */
type KpiStatus = 'healthy' | 'warning' | 'critical' | 'neutral'
interface KpiView {
  value: string
  unit?: string
  unitTitle?: string
  abbr?: string
  abbrTitle?: string
  description?: string
  status?: KpiStatus
  statusLabel?: string
  period?: string
  unavailable?: boolean
  unavailableReason?: string
  /** Bottom comparison line - only ever from a real period-over-period figure. */
  comparisonValue?: string
  comparisonPeriod?: string
  trendDirection?: 'up' | 'down' | 'flat'
  /** Is that direction good news for THIS metric? */
  trendFavorable?: boolean
  series?: number[]
}

const feedDownReason = (feed: string) => `${feed} feed unavailable - retry to refresh`
const awaitingReason = 'Awaiting first sync…'

/** "N above/below <window> pace" from real counts vs a run-rate. */
function paceComparison(actual: number, expected: number, window: string) {
  if (!Number.isFinite(expected) || expected <= 0) return {}
  const diff = actual - expected
  if (Math.abs(diff) < 0.5) {
    return { comparisonValue: `On ${window} pace`, comparisonPeriod: '', trendDirection: 'flat' as const, trendFavorable: undefined }
  }
  return {
    comparisonValue: `${Math.abs(diff).toFixed(0)} ${diff > 0 ? 'above' : 'below'} ${window} pace`,
    comparisonPeriod: '',
    trendDirection: (diff > 0 ? 'up' : 'down') as 'up' | 'down',
    // fewer incidents is the good direction
    trendFavorable: diff < 0,
  }
}

// ── Road Safety - active serious incidents (live count) ──────────────
const safetyView = computed((): KpiView => {
  if (!safety.value) {
    return {
      value: '-', period: 'LIVE', description: 'Active serious incidents',
      unavailable: true,
      unavailableReason: safetyFailed.value ? feedDownReason('NTSA IRSMS') : awaitingReason,
    }
  }
  const active = safety.value.kpis.active
  const fatal = safety.value.kpis.fatal_30d
  return {
    value: fmtNum(active),
    description: 'Active serious incidents',
    period: 'LIVE',
    status: (active > 10 || fatal > 20) ? 'critical' : (active > 5 || fatal > 10) ? 'warning' : 'neutral',
  }
})

// ── Active Fleet - live GPS-tracked vehicles. 0 live against a non-zero
//    registry means telemetry isn't reporting, not "zero vehicles". ─────
const fleetView = computed((): KpiView => {
  if (!fleet.value) {
    return {
      value: '-', period: 'LIVE', description: 'Live GPS-tracked PSV & govt fleet',
      unavailable: true,
      unavailableReason: fleetFailed.value ? feedDownReason('NTSA iTIMS') : awaitingReason,
    }
  }
  const live = fleet.value.kpis.live_vehicles
  const total = fleet.value.kpis.total_vehicles
  if (live === 0 && total > 0) {
    return {
      value: '-', period: 'LIVE', description: 'Live GPS-tracked PSV & govt fleet',
      unavailable: true, unavailableReason: 'No live telemetry received',
    }
  }
  return {
    value: fmtNum(live),
    description: `Live now · ${fmtNum(total)} registered`,
    period: 'LIVE',
    status: fleetBadge.value === 'crit' ? 'critical' : fleetBadge.value === 'warn' ? 'warning' : 'healthy',
  }
})

// ── Rail Network - on-time arrivals (30d) ────────────────────────────
const railView = computed((): KpiView => {
  if (!rail.value) {
    return {
      value: '-', period: '30D', description: 'On-time arrivals',
      unavailable: true,
      unavailableReason: railFailed.value ? feedDownReason('KRC Operations') : awaitingReason,
    }
  }
  const ot = rail.value.on_time_30d
  if (!ot || ot.total_operations === 0) {
    return {
      value: '-', period: '30D', description: 'On-time arrivals',
      unavailable: true, unavailableReason: 'No operations recorded (30d)',
    }
  }
  return {
    value: ot.on_time_pct.toFixed(1),
    unit: '%',
    description: `On-time arrivals · ${ot.avg_delay_min?.toFixed(0) ?? '-'} min avg delay`,
    period: '30D',
    status: ot.on_time_pct >= 80 ? 'healthy' : 'warning',
  }
})

// ── Aviation - national OTP (7d) ────────────────────────────────────
const aviationView = computed((): KpiView => {
  if (!aviation.value) {
    return {
      value: '-', period: '7D', description: 'On-time arrivals',
      unavailable: true,
      unavailableReason: aviationFailed.value ? feedDownReason('KAA / KCAA') : awaitingReason,
    }
  }
  const k = aviation.value.kpis
  if (k.flights_total === 0) {
    return {
      value: '-', period: '7D', description: 'On-time arrivals',
      unavailable: true, unavailableReason: 'No flights recorded (7d)',
    }
  }
  return {
    value: k.otp_pct.toFixed(1),
    unit: '%',
    description: `On-time arrivals · ${fmtNum(k.flights_total)} flights`,
    period: '7D',
    status: k.otp_pct >= 85 ? 'healthy' : 'warning',
  }
})

// ── Ports & Logistics - container throughput (30d) ──────────────────
const portView = computed((): KpiView => {
  if (!maritime.value) {
    return {
      value: '-', period: '30D', description: 'Containers processed',
      unavailable: true,
      unavailableReason: maritimeFailed.value ? feedDownReason('KPA Mombasa') : awaitingReason,
    }
  }
  if (!portList.value.length) {
    return {
      value: '-', period: '30D', description: 'Containers processed',
      unavailable: true, unavailableReason: 'No port feed connected',
    }
  }
  const teus = portList.value.reduce((s, p) => s + (p.teu_throughput_30d || 0), 0)
  if (teus === 0 && (portAvgDwell.value ?? 0) === 0) {
    return {
      value: '-', period: '30D', description: 'Containers processed',
      unavailable: true, unavailableReason: 'No port throughput reported (30d)',
    }
  }
  const dwell = portAvgDwell.value
  return {
    value: fmtNum(teus),
    unit: 'TEU',
    unitTitle: 'TEU - twenty-foot equivalent container units',
    description: dwell != null ? `Processed · ${dwell.toFixed(1)} d avg yard dwell` : 'Containers processed',
    period: '30D',
    status: portDwellOk.value ? 'healthy' : 'warning',
    statusLabel: portDwellOk.value ? 'On target' : 'Dwell elevated',
  }
})

// ── Road Infrastructure - share of network rated good condition ─────
const infraView = computed((): KpiView => {
  if (!infra.value) {
    return {
      value: '-', period: 'LATEST', description: 'Network rated good condition',
      unavailable: true,
      unavailableReason: infraFailed.value ? feedDownReason('BMS / RAMS survey') : awaitingReason,
    }
  }
  const dist = infra.value.network?.condition_distribution
  const total = (dist ?? []).reduce((s, c) => s + (c.length || 0), 0)
  if (!total) {
    return {
      value: '-', period: 'LATEST', description: 'Network rated good condition',
      unavailable: true, unavailableReason: 'No condition survey data',
    }
  }
  const iri = infra.value.network.iri_average
  return {
    value: infraGoodPct.value.toFixed(1),
    unit: '%',
    abbr: 'IRI',
    abbrTitle: 'International Roughness Index - lower means a smoother road',
    description: `Rated good · IRI avg ${iri?.toFixed(2) ?? '-'}`,
    period: 'LATEST',
    status: infraGoodPct.value >= 60 ? 'healthy' : 'warning',
  }
})

// ── Row 2 · Incident load ───────────────────────────────────────────
const incidents24hView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: '24H', description: 'All severities', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('NTSA IRSMS') : awaitingReason }
  }
  return {
    value: fmtNum(safety.value.kpis.total_24h),
    description: 'All severities',
    period: '24H',
    status: 'neutral',
    ...paceComparison(safety.value.kpis.total_24h, safety.value.kpis.total_7d / 7, '7-day'),
  }
})

const incidents7dView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: '7D', description: 'Rolling 7-day total', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('NTSA IRSMS') : awaitingReason }
  }
  return {
    value: fmtNum(safety.value.kpis.total_7d),
    description: 'Rolling 7-day total',
    period: '7D',
    status: 'neutral',
    ...paceComparison(safety.value.kpis.total_7d, (safety.value.kpis.total_30d / 30) * 7, '30-day'),
  }
})

const fatalities30dView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: '30D', description: 'Fatal incidents', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('NTSA IRSMS + NPS') : awaitingReason }
  }
  const fatal = safety.value.kpis.fatal_30d
  const trend = safety.value.fatality_trend_30d ?? []
  const series = trend.length > 1 ? trend.map(d => d.fatalities) : undefined
  // Real half-over-half comparison on the actual series - not a synthesised prior period.
  let cmp: Partial<KpiView> = {}
  if (trend.length >= 8) {
    const mid = Math.floor(trend.length / 2)
    const firstHalf = trend.slice(0, mid).reduce((s, d) => s + d.fatalities, 0)
    const secondHalf = trend.slice(mid).reduce((s, d) => s + d.fatalities, 0)
    const diff = secondHalf - firstHalf
    cmp = {
      comparisonValue: diff === 0 ? 'Level' : `${fmtNum(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'}`,
      comparisonPeriod: 'vs prior 15 days',
      trendDirection: diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down',
      trendFavorable: diff < 0,
    }
  }
  return {
    value: fmtNum(fatal),
    description: 'Fatal incidents',
    period: '30D',
    status: fatal > 20 ? 'critical' : fatal > 10 ? 'warning' : 'neutral',
    series,
    ...cmp,
  }
})

// ── Row 2 · Risk & response ────────────────────────────────────────
const blackspotsView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: 'CURRENT', description: 'Active accident clusters', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('NTSA') : awaitingReason }
  }
  const t = safety.value.black_spots_by_tier
  const critical = t['critical'] ?? 0
  return {
    value: fmtNum(critical),
    description: critical === 0 ? 'No critical clusters active' : `High ${fmtNum(t['high'] ?? 0)} · Med ${fmtNum(t['medium'] ?? 0)}`,
    period: 'CURRENT',
    // 0 critical black spots IS the defined-good state here.
    status: critical === 0 ? 'healthy' : critical > 5 ? 'critical' : 'warning',
  }
})

const dispatchesView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: 'LIVE', description: 'Units currently deployed', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('NPS / NTSA') : awaitingReason }
  }
  return {
    value: fmtNum(safety.value.active_dispatches),
    description: 'Units currently deployed',
    period: 'LIVE',
    status: 'neutral',
  }
})

const interventionView = computed((): KpiView => {
  if (!safety.value) {
    return { value: '-', period: 'TO DATE', description: 'Interventions evaluated', unavailable: true, unavailableReason: safetyFailed.value ? feedDownReason('KeNHA / NTSA') : awaitingReason }
  }
  const ie = safety.value.intervention_effectiveness
  const evaluated = ie.total_evaluated
  if (evaluated === 0) {
    return { value: '-', period: 'TO DATE', description: 'Interventions evaluated', unavailable: true, unavailableReason: 'No interventions evaluated yet' }
  }
  return {
    value: ie.average_pct.toFixed(1),
    unit: '%',
    description: `${fmtNum(evaluated)} interventions evaluated`,
    period: 'TO DATE',
    status: ie.average_pct >= 60 ? 'healthy' : ie.average_pct >= 45 ? 'warning' : 'critical',
  }
})

// ── Derived: Road fatalities trend (30d) - same logic as Safety Overview's
// (/safety) "30-Day Fatality Trend" card, so the two stay one component
// instead of drifting into two different chart implementations.
// Scale against the same last-30 slice the bars render, not the full
// fetched history - an older, off-screen day would otherwise silently
// compress every bar actually on screen.
const maxFatalities = computed(() =>
  Math.max(1, ...(safety.value?.fatality_trend_30d ?? []).slice(-30).map(d => d.fatalities)),
)
// A single day-bucket (or very few) renders as one misleading full-width bar
// under the flex layout below - require a minimum spread before charting it.
const hasFatalityTrend = computed(() => (safety.value?.fatality_trend_30d?.length ?? 0) >= 5)

// ── Derived: Active alerts list ────────────────────────────────────────
type AlertSeverity = 'critical' | 'warning' | 'info'
interface AlertEntry { severity: AlertSeverity; title: string; meta: string; to: string }

const activeAlerts = computed((): AlertEntry[] => {
  const list: AlertEntry[] = []

  if (safety.value) {
    if (safety.value.kpis.active > 10)
      list.push({ severity: 'critical', title: `${fmtNum(safety.value.kpis.active)} active incidents - above threshold`, meta: 'NTSA IRSMS · Live', to: '/safety/incidents' })
    else if (safety.value.kpis.active > 5)
      list.push({ severity: 'warning', title: `${fmtNum(safety.value.kpis.active)} active road incidents`, meta: 'NTSA IRSMS · Live', to: '/safety/incidents' })

    if (safety.value.kpis.fatal_30d > 20)
      list.push({ severity: 'critical', title: `${fmtNum(safety.value.kpis.fatal_30d)} road fatalities in 30 days - exceeds threshold`, meta: 'NTSA IRSMS · 30d rolling', to: '/safety/kpis' })
    else if (safety.value.kpis.fatal_30d > 10)
      list.push({ severity: 'warning', title: `${fmtNum(safety.value.kpis.fatal_30d)} road fatalities (30d) above normal`, meta: 'NTSA IRSMS · 30d rolling', to: '/safety/kpis' })

    const criticalBlackSpots = safety.value.black_spots_by_tier['critical'] ?? 0
    if (criticalBlackSpots > 0)
      list.push({ severity: 'warning', title: `${fmtNum(criticalBlackSpots)} critical black spots active`, meta: 'NTSA KDE Analysis · Batch', to: '/safety/blackspots' })
  }

  if (fleet.value && fleet.value.governor_compliance.tamper_rate_pct > 5)
    list.push({ severity: 'warning', title: `Speed governor tamper rate: ${fmtPct(fleet.value.governor_compliance.tamper_rate_pct)}`, meta: 'NTSA iTIMS · Live', to: '/fleet/behaviour' })

  if (infra.value && infra.value.bridges.critical_count > 0)
    list.push({ severity: 'warning', title: `${fmtNum(infra.value.bridges.critical_count)} bridges at critical condition`, meta: 'BMS · Batch survey', to: '/infrastructure/bridges' })

  if (rail.value && rail.value.incidents_90d.fatal > 0)
    list.push({ severity: 'critical', title: `${fmtNum(rail.value.incidents_90d.fatal)} fatal rail incidents (90d)`, meta: 'KRC Safety · Batch', to: '/railway/safety' })

  if (rail.value && rail.value.on_time_30d.on_time_pct < 70)
    list.push({ severity: 'warning', title: `Rail OTP below benchmark: ${fmtPct(rail.value.on_time_30d.on_time_pct)}`, meta: 'KRC Ops · Live', to: '/railway/schedules' })

  if (aviation.value && aviation.value.kpis.otp_pct < 80)
    list.push({ severity: 'warning', title: `Aviation OTP below benchmark: ${fmtPct(aviation.value.kpis.otp_pct)}`, meta: 'KAA · Live', to: '/aviation/flights' })

  const offlineFeeds = integrations.value.filter(f => f.status === 'disconnected' || f.status === 'degraded')
  if (offlineFeeds.length > 0)
    list.push({
      severity: offlineFeeds.some(f => f.status === 'disconnected') ? 'critical' : 'warning',
      title: `${offlineFeeds.length} agency feed(s) offline / degraded`,
      meta: offlineFeeds.map(f => f.agency_code).join(', '),
      to: '/integrations/analytics',
    })

  // Each `if` above just runs in a fixed module order (safety, fleet,
  // infra, rail, aviation, integrations) - without this, a critical rail
  // alert pushed near the end would render below an earlier module's
  // merely-warning one. Stable sort (native since ES2019) keeps each
  // severity band in its original module order, only reordering the bands
  // themselves so critical always leads.
  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return list.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
})

// ── Map markers ────────────────────────────────────────────────────────
const mapMarkers = computed((): MarkerSpec[] => {
  const markers: MarkerSpec[] = []

  const cap = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  for (const h of hotspots.value) {
    const color: MarkerSpec['color'] =
      h.risk_tier === 'very_high' ? 'red'
      : h.risk_tier === 'high'   ? 'orange'
      : h.risk_tier === 'medium' ? 'yellow'
      : 'gray'
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Risk tier',   value: cap(h.risk_tier) },
      { label: 'Risk score',  value: `${h.predicted_risk_score.toFixed(0)}%` },
      { label: 'Horizon',     value: `${h.horizon_days} day${h.horizon_days !== 1 ? 's' : ''}` },
      { label: 'Model',       value: h.model_name },
    ]
    if (h.confidence_pct != null) rows.push({ label: 'Confidence', value: `${h.confidence_pct.toFixed(0)}%` })
    if (h.segment_road_code)      rows.push({ label: 'Road code',  value: h.segment_road_code })
    markers.push({
      id:    `hs-${h.id}`,
      lat:   h.latitude,
      lon:   h.longitude,
      badge: 'Predictive Hotspot',
      title: h.segment_road_code ?? `Grid ${h.grid_cell_id?.slice(0, 8) ?? h.id.slice(0, 8)}`,
      rows,
      color,
      size:  h.risk_tier === 'very_high' ? 'lg' : 'md',
    })
  }

  for (const b of blackspots.value) {
    if (b.centroid_latitude == null || b.centroid_longitude == null) continue
    const color: MarkerSpec['color'] =
      b.ranking_tier === 'critical' ? 'red'
      : b.ranking_tier === 'high'   ? 'orange'
      : 'yellow'
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Tier',               value: cap(b.ranking_tier ?? 'unranked') },
      { label: 'Accidents (rolling)', value: String(b.accident_count_rolling) },
      { label: 'Fatalities',         value: String(b.fatality_count_rolling) },
    ]
    if (b.kde_intensity != null) rows.push({ label: 'KDE intensity', value: b.kde_intensity.toFixed(3) })
    if (b.radius_m != null)      rows.push({ label: 'Radius',        value: `${b.radius_m} m` })
    if (b.window_days)           rows.push({ label: 'Window',        value: `${b.window_days} days` })
    markers.push({
      id:    `bs-${b.id}`,
      lat:   b.centroid_latitude,
      lon:   b.centroid_longitude,
      badge: 'Accident Black Spot',
      title: b.segment_road_name ?? b.segment_road_code ?? 'Black Spot Cluster',
      rows,
      color,
      size:  'sm',
    })
  }

  return markers
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════
   COMMAND CENTRE - instrument-panel layout.
   Flat panels, 1px hairlines, mono figures, status as a 1px signal.
   Consumes theme.css tokens; no hardcoded palette.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Command header ─────────────────────────────────────────────────── */
.cmd-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}
/* Deliberate wide-tracked uppercase masthead - a mission-control section
   label, not a headline. Recorded in the surface brief's FIRST VIEWPORT. */
.cmd-header-main h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  color: var(--fg-1);
}
.cmd-dek {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--fg-2);
}
.cmd-readout {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}
.cmd-status-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cmd-status-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--r-pill);
  flex-shrink: 0;
}
.cmd-readout.good .cmd-status-word { color: var(--success-fg); }
.cmd-readout.good .cmd-status-dot  { background: var(--success); animation: pulse 2.4s infinite; }
.cmd-readout.warn .cmd-status-word { color: var(--warning-fg); }
.cmd-readout.warn .cmd-status-dot  { background: var(--warning); }
.cmd-readout.crit .cmd-status-word { color: var(--danger-fg); }
.cmd-readout.crit .cmd-status-dot  { background: var(--destructive); animation: pulse 1.4s infinite; }
.cmd-status-alerts {
  color: var(--fg-3);
  padding-left: 8px;
  border-left: 1px solid var(--border-subtle);
  font-weight: 600;
}
.cmd-clock {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-3);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

/* ── Live pulse ────────────────────────────────────────────────────── */
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ── Error banner (base in theme.css; page adds retry row) ──────────── */
.error-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}

/* ── Section labels ─────────────────────────────────────────────────── */
.section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin: 18px 0 8px;
}
.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}
.section-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--r-xs);
  background: var(--surface-sunken);
  color: var(--fg-3);
  border: 1px solid var(--border-subtle);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ── KPI grid layouts ──────────────────────────────────────────────── */
/* Card visuals now live in the shared <KpiCard> component; the page only
   owns grid track sizing and the ribbon's staggered mount. */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  container-type: inline-size;
}
/* Stable six-column desktop ribbon -> two columns on tablet -> one on
   mobile (per the KPI redesign spec). minmax(0,1fr) lets cards shrink
   without overflowing at 1440px. */
.kpi-grid-primary {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
@media (max-width: 1024px) {
  .kpi-grid-primary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .kpi-grid-primary { grid-template-columns: 1fr; }
}
.kpi-grid-primary > .kpi-card {
  animation: kpiEnter var(--dur-slow) var(--ease-out) both;
}
.kpi-grid-primary > .kpi-card:nth-child(1) { animation-delay: 0ms; }
.kpi-grid-primary > .kpi-card:nth-child(2) { animation-delay: 36ms; }
.kpi-grid-primary > .kpi-card:nth-child(3) { animation-delay: 72ms; }
.kpi-grid-primary > .kpi-card:nth-child(4) { animation-delay: 108ms; }
.kpi-grid-primary > .kpi-card:nth-child(5) { animation-delay: 144ms; }
.kpi-grid-primary > .kpi-card:nth-child(6) { animation-delay: 180ms; }
@keyframes kpiEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .kpi-grid-primary > .kpi-card { animation: none; }
}

/* ── Badges ─────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.badge.good    { background: var(--success-bg); color: var(--success-fg); border-color: color-mix(in srgb, var(--success-fg) 28%, transparent); }
.badge.warn    { background: var(--warning-bg); color: var(--warning-fg); border-color: color-mix(in srgb, var(--warning-fg) 28%, transparent); }
.badge.crit    { background: var(--danger-bg);  color: var(--danger-fg);  border-color: color-mix(in srgb, var(--danger-fg) 28%, transparent); }
.badge.info    { background: var(--info-bg);    color: var(--info-fg);    border-color: color-mix(in srgb, var(--info-fg) 28%, transparent); }
.badge.loading { background: var(--surface-sunken); color: var(--fg-3); }

/* ── Sparkline / mini card ─────────────────────────────────────────── */
.spark-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
  margin-top: 8px;
}
.spark-card-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-3);
}
.spark-card-body { padding: 10px 12px; }

.sparkline-wrap { padding-bottom: 0; }
.sparkline-bars { display: flex; align-items: flex-end; gap: 2px; height: 72px; }
.spark-bar { flex: 1; border-radius: 1px 1px 0 0; cursor: default; transition: opacity .1s; }
.spark-bar:hover { opacity: .7; }
.spark-red   { background: var(--destructive); }
.spark-amber { background: var(--warning); }
.spark-green { background: var(--success); }
.card-footer-hint {
  font-size: 10px;
  color: var(--fg-3);
  padding: 6px 16px 10px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}
.hint-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }

/* ── Fleet composition tags ────────────────────────────────────────── */
.fleet-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.fleet-tag {
  padding: 3px 9px;
  border-radius: var(--r-xs);
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  font-size: 10.5px;
  color: var(--fg-2);
  font-family: var(--font-mono);
}

/* ── Condition distribution bar ────────────────────────────────────── */
.condition-bar { display: flex; height: 14px; border-radius: var(--r-xs); overflow: hidden; gap: 1px; }
.condition-seg { min-width: 3px; }
.condition-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.condition-legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--fg-2); }
.condition-swatch { width: 9px; height: 9px; border-radius: var(--r-xs); display: inline-block; flex-shrink: 0; }

/* ── Map + alerts row ──────────────────────────────────────────────── */
.map-alerts-row { display: grid; grid-template-columns: 1.7fr 1fr; gap: 12px; }
.map-wrap {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
}
.map-wrap-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-3);
  display: flex;
  align-items: center;
  gap: 8px;
}
.map-head-meta {
  margin-left: auto;
  font-size: 10px;
  font-weight: 500;
  color: var(--fg-3);
  white-space: nowrap;
  font-family: var(--font-mono);
  text-transform: none;
  letter-spacing: 0;
}
.map-legend-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-1);
  flex-wrap: wrap;
}
.map-legend-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-3);
  margin-right: 2px;
}
.map-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--fg-2);
  white-space: nowrap;
}
.map-legend-dim { opacity: 0.8; }
.map-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: var(--r-pill);
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--surface-2) 60%, transparent);
}
.map-dot-sm { width: 6px; height: 6px; }
.map-dash { display: inline-block; width: 14px; height: 2px; border-radius: var(--r-xs); flex-shrink: 0; opacity: 0.8; }
.map-legend-sep { display: inline-block; width: 1px; height: 12px; background: var(--border-subtle); flex-shrink: 0; }
.map-canvas {
  height: 200px;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 12px;
}
.gis-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--fg-3);
  letter-spacing: 0.02em;
}
.gis-legend {
  background: color-mix(in srgb, var(--surface-2) 92%, transparent);
  border-radius: var(--r-sm);
  padding: 7px 10px;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  z-index: 1;
  border: 1px solid var(--border-subtle);
}
.gis-legend-title {
  font-size: 9px;
  font-weight: 700;
  color: var(--fg-3);
  margin-bottom: 2px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.gis-legend-item { display: flex; align-items: center; gap: 5px; color: var(--fg-2); }
.gis-dot { width: 7px; height: 7px; border-radius: var(--r-pill); display: inline-block; flex-shrink: 0; }

/* ── Alerts panel ──────────────────────────────────────────────────── */
/* Same card shell as .map-wrap (its row-mate in .map-alerts-row) - this used
   to be a bare stack of coloured rows floating next to a bordered map card,
   which read as two mismatched panels rather than a pair. */
.alerts-section {
  display: flex;
  flex-direction: column;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
}
.alerts-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.alerts-count {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--surface-sunken);
  color: var(--fg-3);
  border: 1px solid var(--border-subtle);
}
.alerts-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  flex: 1;
}
.alerts-loading { font-size: 11.5px; color: var(--fg-3); padding: 8px 0; }
.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  transition: border-color var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out);
}
/* Status carried by a tinted ground + a leading dot, not a slab border. */
.alert-item::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: var(--r-pill);
  flex-shrink: 0;
  background: var(--fg-3);
}
.alert-item.critical { background: var(--danger-bg); border-color: color-mix(in srgb, var(--danger-fg) 26%, transparent); }
.alert-item.critical::before { background: var(--destructive); }
.alert-item.warning  { background: var(--warning-bg); border-color: color-mix(in srgb, var(--warning-fg) 26%, transparent); }
.alert-item.warning::before { background: var(--warning); }
.alert-item.info     { background: var(--info-bg); border-color: color-mix(in srgb, var(--info-fg) 26%, transparent); }
.alert-item.info::before { background: var(--info); }
/* "All systems nominal" is reassuring news, not a fourth alert colour - it
   gets the system's own healthy/green treatment, same as every other
   all-clear signal (freshness badge, live source chip), not the blue used
   for a genuine informational-severity alert. */
.alert-item.success  { background: var(--success-bg); border-color: color-mix(in srgb, var(--success-fg) 26%, transparent); }
.alert-item.success::before { background: var(--success); }
.alert-item-link { color: inherit; text-decoration: none; cursor: pointer; }
.alert-item-link:hover { border-color: var(--border-interactive); }
.alert-item-link:hover .alert-chevron { color: var(--primary); transform: translateX(3px); }
.alert-main { flex: 1; min-width: 0; }
.alert-title { font-size: 11.5px; font-weight: 600; color: var(--fg-1); line-height: 1.4; }
.alert-meta { font-size: 10px; color: var(--fg-3); margin-top: 2px; font-family: var(--font-mono); }
.alert-chevron {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--fg-3);
  transition: transform var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out);
}

/* ── Integration feed strip ────────────────────────────────────────── */
.table-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
}
.integration-summary-row { display: flex; gap: 28px; padding: 14px 16px; flex-wrap: wrap; }
.integration-summary-stat { display: flex; flex-direction: column; }
.integration-summary-value {
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 600;
  color: var(--fg-1);
  font-variant-numeric: tabular-nums;
}
.integration-summary-value.warn { color: var(--warning-fg); }
.integration-summary-label {
  font-size: 10px;
  color: var(--fg-3);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.feed-filter-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); }
.feed-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-subtle);
  background: var(--surface-1);
  color: var(--fg-2);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.feed-filter-chip:hover { background: var(--surface-quiet); }
.feed-filter-chip.active { background: var(--primary-fill); border-color: var(--primary-fill); color: #fff; }
.feed-filter-chip.active .feed-filter-count { background: rgba(255, 255, 255, .22); color: inherit; }
.feed-filter-count {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-family: var(--font-mono);
  background: var(--surface-sunken);
  color: var(--fg-2);
  border-radius: var(--r-xs);
  padding: 0 5px;
  font-size: 9px;
}
.feed-filter-chip--good.active { background: var(--success-fg); border-color: var(--success-fg); }
.feed-filter-chip--warn.active { background: var(--warning-fg); border-color: var(--warning-fg); }
.feed-filter-chip--crit.active { background: var(--danger-fg); border-color: var(--danger-fg); }
.feed-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.feed-table th {
  text-align: left;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--fg-3);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-strong);
  background: var(--surface-1);
}
.feed-table td { padding: 7px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--fg-1); vertical-align: middle; }
.feed-table tr:last-child td { border-bottom: none; }
.feed-table tbody tr { transition: background-color var(--dur-fast) var(--ease-standard); }
.feed-table tbody tr:hover td { background: var(--primary-wash); }
.feed-mode { color: var(--fg-3); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.feed-num  { font-variant-numeric: tabular-nums; font-family: var(--font-mono); }
.feed-time { white-space: nowrap; color: var(--fg-3); font-size: 10px; font-family: var(--font-mono); }
.feed-empty { text-align: center; color: var(--fg-3); padding: 20px; font-size: 12px; }

/* ── Agency drill-down grid ────────────────────────────────────────── */
.agency-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.agency-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  transition: border-color var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out);
}
.agency-card:hover { background: var(--surface-1); border-color: var(--border-interactive); }
.agency-card:hover .agency-link { color: var(--brand-dark); transform: translateX(3px); }
.agency-card:focus-within { border-color: var(--border-interactive); }
.agency-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; margin-bottom: 6px; }
.agency-card-title { font-size: 12px; font-weight: 700; color: var(--fg-1); }
.agency-tag {
  font-family: var(--font-mono);
  font-size: 8.5px;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--surface-1);
  color: var(--fg-3);
  border: 1px solid var(--border-subtle);
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
  text-transform: uppercase;
}
.agency-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.agency-row:last-of-type { border-bottom: none; }
.agency-row-label { font-size: 10.5px; color: var(--fg-2); }
.agency-loading { font-size: 11px; color: var(--fg-3); padding: 4px 0; }
.agency-link {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--primary);
  text-decoration: none;
  margin-top: 8px;
  display: inline-block;
  transition: color var(--dur-fast) var(--ease-standard), transform var(--dur-base) var(--ease-out);
}
.agency-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.section-link {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--primary);
  text-decoration: none;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: color var(--dur-fast) var(--ease-standard);
}
.section-link:hover { text-decoration: underline; text-underline-offset: 3px; color: var(--brand-dark); }

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .map-alerts-row { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .cmd-header { align-items: flex-start; }
  .cmd-header-main { flex: 1 1 100%; min-width: 0; }
  .cmd-readout { align-items: flex-start; text-align: left; }
  .cmd-dek { overflow-wrap: anywhere; max-width: 100%; }
  .map-alerts-row { grid-template-columns: 1fr; }
  .agency-link, .section-link { min-height: 44px; padding: 10px 0; align-items: center; }
  /* Long "→" links wrap instead of being clipped by the card's overflow. */
  .section-link { white-space: normal; flex-shrink: 1; min-width: 0; }
  .section-label { flex-wrap: wrap; }
  .map-wrap-head { flex-wrap: wrap; }
  .map-head-meta { margin-left: 0; }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .cmd-header-main h1 { font-size: 16px; }
  .kpi-grid .kpi-card { min-height: 0; }
}
@media (min-width: 1600px) {
  .agency-card, .spark-card-body { padding: 14px 16px; }
}
</style>
