<template>
  <!--
    Executive Dashboard - real-API edition.
    Fetches all six domain summaries in parallel:
      safety, fleet, railway, aviation, maritime, infrastructure,
      public-transport, integrations.
    Any single failure degrades that section gracefully; the rest keep rendering.
  -->
  <PageHeader
    title="Executive Command Centre"
    subtitle="Unified oversight across all transport agencies and modes"
  >
    <template #actions>
      <button class="btn-primary">Schedule Cabinet Report</button>
    </template>
  </PageHeader>

  <!-- Global error banner (only shown when ALL calls fail) -->
  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       1. NATIONAL TRANSPORT HEALTH - top-level KPI ribbon
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    National transport health
    <span class="section-pill">6 domains</span>
  </div>

  <div class="kpi-grid">
    <!-- Road Safety -->
    <div class="kpi-card" :class="safetyBadge">
      <div class="kpi-label">
        <span class="badge" :class="safetyBadge">{{ safetyLabel }}</span>
        Road Safety
      </div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.kpis.active) : '-' }}</div>
      <div class="kpi-sub">Active serious incidents</div>
      <div class="kpi-trend" :class="safety && safety.kpis.fatal_30d > 10 ? 'down' : 'up'">
        {{ safety ? `${fmtNum(safety.kpis.fatal_30d)} fatalities in 30 days` : 'Loading…' }}
      </div>
      <div class="kpi-source">
        <span class="source-dot live" />NTSA IRSMS
      </div>
    </div>

    <!-- Live Fleet -->
    <div class="kpi-card good">
      <div class="kpi-label">
        <span class="badge good">GOOD</span>
        Active Fleet
      </div>
      <div class="kpi-val">{{ fleet ? fmtNum(fleet.kpis.live_vehicles) : '-' }}</div>
      <div class="kpi-sub">GPS-tracked PSVs &amp; govt fleet active</div>
      <div class="kpi-trend up">
        {{ fleet ? `${fmtNum(fleet.kpis.total_vehicles)} total registered` : 'Loading…' }}
      </div>
      <div class="kpi-source"><span class="source-dot live" />NTSA iTIMS</div>
    </div>

    <!-- Rail On-Time -->
    <div class="kpi-card" :class="rail && rail.on_time_30d.on_time_pct >= 80 ? 'good' : 'warn'">
      <div class="kpi-label">
        <span class="badge" :class="rail && rail.on_time_30d.on_time_pct >= 80 ? 'good' : 'warn'">
          {{ rail && rail.on_time_30d.on_time_pct >= 80 ? 'GOOD' : 'WATCH' }}
        </span>
        Rail Network
      </div>
      <div class="kpi-val">{{ rail ? fmtPct(rail.on_time_30d.on_time_pct) : '-' }}</div>
      <div class="kpi-sub">Rail on-time performance (30d)</div>
      <div class="kpi-trend" :class="rail && rail.on_time_30d.on_time_pct >= 80 ? 'up' : 'down'">
        {{ rail ? `Avg delay ${rail.on_time_30d.avg_delay_min?.toFixed(1)} min` : 'Loading…' }}
      </div>
      <div class="kpi-source"><span class="source-dot live" />KRC Operations</div>
    </div>

    <!-- Aviation OTP -->
    <div class="kpi-card" :class="aviation && aviation.kpis.otp_pct >= 85 ? 'good' : 'warn'">
      <div class="kpi-label">
        <span class="badge" :class="aviation && aviation.kpis.otp_pct >= 85 ? 'good' : 'warn'">
          {{ aviation && aviation.kpis.otp_pct >= 85 ? 'GOOD' : 'WATCH' }}
        </span>
        Aviation
      </div>
      <div class="kpi-val">{{ aviation ? fmtPct(aviation.kpis.otp_pct) : '-' }}</div>
      <div class="kpi-sub">National flight on-time performance</div>
      <div class="kpi-trend" :class="aviation && aviation.kpis.otp_pct >= 85 ? 'up' : 'down'">
        {{ aviation ? `${fmtNum(aviation.kpis.flights_total)} flights · ${fmtNum(aviation.kpis.pax_total)} pax` : 'Loading…' }}
      </div>
      <div class="kpi-source"><span class="source-dot live" />KAA / KCAA</div>
    </div>

    <!-- Port Throughput -->
    <div class="kpi-card" :class="portBadge">
      <div class="kpi-label">
        <span class="badge" :class="portBadge">{{ portBadge === 'good' ? 'GOOD' : 'WATCH' }}</span>
        Ports &amp; Logistics
      </div>
      <div class="kpi-val">{{ portSummaryLabel }}</div>
      <div class="kpi-sub">Container TEUs processed (30d)</div>
      <div class="kpi-trend" :class="portDwellOk ? 'up' : 'down'">{{ portAvgDwellLabel }}</div>
      <div class="kpi-source"><span class="source-dot batch" />KPA Mombasa</div>
    </div>

    <!-- Infrastructure Condition -->
    <div class="kpi-card" :class="infraGoodPct >= 60 ? 'good' : 'warn'">
      <div class="kpi-label">
        <span class="badge" :class="infraGoodPct >= 60 ? 'good' : 'warn'">
          {{ infraGoodPct >= 60 ? 'GOOD' : 'WATCH' }}
        </span>
        Road Infrastructure
      </div>
      <div class="kpi-val">{{ infra ? fmtPct(infraGoodPct) : '-' }}</div>
      <div class="kpi-sub">Road network in Good condition (IRI)</div>
      <div class="kpi-trend" :class="infraGoodPct >= 60 ? 'up' : 'down'">
        {{ infra ? `IRI avg ${infra.network.iri_average?.toFixed(2)} · ${fmtNum(infra.network.total_length_km)} km` : 'Loading…' }}
      </div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA / KURA / KeRRA</div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       2. ROAD SAFETY & INCIDENT MANAGEMENT
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Road Safety &amp; Incident Management
    <span class="section-pill" v-if="safety">NTSA IRSMS · {{ freshnessLabel(safety.generated_at) }}</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card info">
      <div class="kpi-label">Incidents today (24h)</div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.kpis.total_24h) : '-' }}</div>
      <div class="kpi-sub">All severity levels</div>
      <div class="kpi-source"><span class="source-dot live" />NTSA IRSMS</div>
    </div>
    <div class="kpi-card info">
      <div class="kpi-label">Incidents (7d)</div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.kpis.total_7d) : '-' }}</div>
      <div class="kpi-sub">Rolling 7-day total</div>
      <div class="kpi-source"><span class="source-dot live" />NTSA IRSMS</div>
    </div>
    <div class="kpi-card crit">
      <div class="kpi-label">Fatalities (30d)</div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.kpis.fatal_30d) : '-' }}</div>
      <div class="kpi-sub">Fatal incidents this month</div>
      <div class="kpi-source"><span class="source-dot live" />NTSA IRSMS + NPS</div>
    </div>
    <div class="kpi-card warn">
      <div class="kpi-label">Critical black spots</div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.black_spots_by_tier['critical'] ?? 0) : '-' }}</div>
      <div class="kpi-sub">
        High: {{ safety ? fmtNum(safety.black_spots_by_tier['high'] ?? 0) : '-' }} ·
        Med: {{ safety ? fmtNum(safety.black_spots_by_tier['medium'] ?? 0) : '-' }}
      </div>
      <div class="kpi-source"><span class="source-dot batch" />KDE / NTSA</div>
    </div>
    <div class="kpi-card info">
      <div class="kpi-label">Active emergency dispatches</div>
      <div class="kpi-val">{{ safety ? fmtNum(safety.active_dispatches) : '-' }}</div>
      <div class="kpi-sub">Emergency units currently deployed</div>
      <div class="kpi-source"><span class="source-dot live" />NPS / NTSA</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Intervention effectiveness</div>
      <div class="kpi-val">{{ safety ? fmtPct(safety.intervention_effectiveness.average_pct) : '-' }}</div>
      <div class="kpi-sub">
        {{ safety ? fmtNum(safety.intervention_effectiveness.total_evaluated) : '-' }} interventions evaluated
      </div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA / NTSA</div>
    </div>
  </div>

  <!-- Fatality trend sparkline -->
  <div v-if="safety?.fatality_trend_30d?.length" class="spark-card">
    <div class="spark-card-head">30-day fatality trend</div>
    <div class="spark-card-body">
      <div class="sparkbar">
        <div
          v-for="d in safety.fatality_trend_30d.slice(-30)"
          :key="d.day"
          class="sparkbar-bar"
          :style="{
            height: `${Math.max(4, (d.fatalities / maxFatalities) * 100)}%`,
            background: d.fatalities > 5 ? '#d03b3b' : d.fatalities > 2 ? '#fab219' : '#0ca30c',
          }"
          :title="`${d.day}: ${d.fatalities} fatalities`"
        />
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       3. VEHICLE REGISTRATION & FLEET TRACKING
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Vehicle Registration &amp; Fleet Tracking
    <span class="section-pill" v-if="fleet">NTSA iTIMS · {{ freshnessLabel(fleet.generated_at) }}</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card info">
      <div class="kpi-label">Total registered vehicles</div>
      <div class="kpi-val">{{ fleet ? fmtNum(fleet.kpis.total_vehicles) : '-' }}</div>
      <div class="kpi-sub">National NTSA iTIMS registry</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Live GPS-tracked</div>
      <div class="kpi-val">{{ fleet ? fmtNum(fleet.kpis.live_vehicles) : '-' }}</div>
      <div class="kpi-sub">PSVs &amp; govt fleet with active track</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Trips completed (7d)</div>
      <div class="kpi-val">{{ fleet ? fmtNum(fleet.kpis.trips_7d) : '-' }}</div>
      <div class="kpi-sub">PSV trips recorded this week</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Distance covered (7d)</div>
      <div class="kpi-val">{{ fleet ? `${fmtNum(fleet.kpis.distance_7d_km)} km` : '-' }}</div>
      <div class="kpi-sub">Total network kilometres</div>
    </div>
    <div class="kpi-card" :class="fleet && fleet.governor_compliance.tamper_rate_pct < 5 ? 'good' : 'warn'">
      <div class="kpi-label">Speed governor compliance</div>
      <div class="kpi-val">{{ fleet ? fmtPct(fleet.governor_compliance.online_pct) : '-' }}</div>
      <div class="kpi-sub">Tamper rate: {{ fleet ? fmtPct(fleet.governor_compliance.tamper_rate_pct) : '-' }}</div>
    </div>
    <div class="kpi-card warn">
      <div class="kpi-label">Critical behaviour events (24h)</div>
      <div class="kpi-val">{{ fleet ? fmtNum(fleet.behaviour_critical_24h) : '-' }}</div>
      <div class="kpi-sub">Speeding · harsh brake · deviation</div>
    </div>
  </div>

  <!-- Fleet composition tags -->
  <div v-if="fleet?.vehicles_by_type?.length" class="spark-card">
    <div class="spark-card-head">Fleet composition by vehicle type</div>
    <div class="spark-card-body">
      <div class="fleet-tags">
        <span
          v-for="t in fleet.vehicles_by_type"
          :key="t.vehicle_type"
          class="fleet-tag"
        >
          {{ t.vehicle_type.replace(/_/g, ' ') }}: <strong>{{ fmtNum(t.total) }}</strong>
        </span>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       4. PASSENGER COUNT - RAIL & AVIATION
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">Passenger Count - Rail, Aviation &amp; Public Transport
    <span class="section-pill">KRC · KAA · KCAA · NaMATA · NTSA</span>
  </div>

  <div class="dual-col">
    <!-- Rail block -->
    <div>
      <div class="sub-section-head">
        Rail (SGR / MGR / Commuter)
        <span v-if="rail" class="sub-section-pill">KRC · {{ freshnessLabel(rail.generated_at) }}</span>
      </div>
      <div class="kpi-grid-2">
        <div class="kpi-card good">
          <div class="kpi-label">Ridership (30d)</div>
          <div class="kpi-val">{{ rail ? fmtNum(rail.ridership_30d.passengers) : '-' }}</div>
          <div class="kpi-sub">Total boarded passengers</div>
          <div class="kpi-source"><span class="source-dot live" />KRC Ticketing</div>
        </div>
        <div class="kpi-card" :class="rail && rail.on_time_30d.on_time_pct >= 80 ? 'good' : 'warn'">
          <div class="kpi-label">On-time performance</div>
          <div class="kpi-val">{{ rail ? fmtPct(rail.on_time_30d.on_time_pct) : '-' }}</div>
          <div class="kpi-sub">{{ rail ? fmtNum(rail.on_time_30d.cancelled) : '-' }} cancellations</div>
          <div class="kpi-source"><span class="source-dot live" />KRC Ops</div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-label">Freight tonnage (30d)</div>
          <div class="kpi-val">{{ rail ? fmtNum(rail.freight_30d.total_tons) + ' t' : '-' }}</div>
          <div class="kpi-sub">{{ rail ? fmtNum(rail.freight_30d.shipments) : '-' }} shipments</div>
          <div class="kpi-source"><span class="source-dot batch" />KRC Freight</div>
        </div>
        <div class="kpi-card good">
          <div class="kpi-label">Revenue (30d)</div>
          <div class="kpi-val">{{ rail ? `KES ${fmtKsh(rail.ridership_30d.revenue_kes)}` : '-' }}</div>
          <div class="kpi-sub">Passenger + freight revenue</div>
          <div class="kpi-source"><span class="source-dot batch" />KRC Finance</div>
        </div>
      </div>
    </div>

    <!-- Aviation block -->
    <div>
      <div class="sub-section-head">
        Air (JKIA · Moi · Wilson)
        <span v-if="aviation" class="sub-section-pill">KAA · {{ freshnessLabel(aviation.generated_at) }}</span>
      </div>
      <div class="kpi-grid-2">
        <div class="kpi-card good">
          <div class="kpi-label">Flight movements (7d)</div>
          <div class="kpi-val">{{ aviation ? fmtNum(aviation.kpis.flights_total) : '-' }}</div>
          <div class="kpi-sub">Arrivals + departures</div>
          <div class="kpi-source"><span class="source-dot live" />KAA / KCAA</div>
        </div>
        <div class="kpi-card good">
          <div class="kpi-label">Passenger throughput (7d)</div>
          <div class="kpi-val">{{ aviation ? fmtNum(aviation.kpis.pax_total) : '-' }}</div>
          <div class="kpi-sub">Processed through terminals</div>
          <div class="kpi-source"><span class="source-dot live" />KAA / KCAA</div>
        </div>
        <div class="kpi-card" :class="aviation && aviation.kpis.otp_pct >= 85 ? 'good' : 'warn'">
          <div class="kpi-label">On-time performance</div>
          <div class="kpi-val">{{ aviation ? fmtPct(aviation.kpis.otp_pct) : '-' }}</div>
          <div class="kpi-sub">Avg delay: {{ aviation ? aviation.kpis.avg_delay_min?.toFixed(0) : '-' }} min</div>
          <div class="kpi-source"><span class="source-dot live" />KAA / KCAA / KMD</div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-label">Air cargo (7d)</div>
          <div class="kpi-val">{{ aviation ? `${fmtKsh(aviation.kpis.cargo_kg_total / 1000)} t` : '-' }}</div>
          <div class="kpi-sub">Freight moved through terminals</div>
          <div class="kpi-source"><span class="source-dot batch" />KAA / KenTrade</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       5. INFRASTRUCTURE CONDITION & PROGRESS
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Infrastructure Condition &amp; Progress
    <span class="section-pill" v-if="infra">KeNHA · KURA · KeRRA · KRB · LAPSSET · {{ freshnessLabel(infra.generated_at) }}</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card" :class="infraGoodPct >= 60 ? 'good' : 'warn'">
      <div class="kpi-label">Network in good condition</div>
      <div class="kpi-val">{{ infra ? fmtPct(infraGoodPct) : '-' }}</div>
      <div class="kpi-sub">of {{ infra ? fmtNum(infra.network.total_length_km) : '-' }} km classified network</div>
      <div class="kpi-source"><span class="source-dot batch" />IRI Survey</div>
    </div>
    <div class="kpi-card info">
      <div class="kpi-label">Average IRI score</div>
      <div class="kpi-val">{{ infra ? infra.network.iri_average?.toFixed(2) ?? '-' : '-' }}</div>
      <div class="kpi-sub">Lower = smoother road surface</div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA Surveys</div>
    </div>
    <div class="kpi-card warn">
      <div class="kpi-label">Bridges - critical</div>
      <div class="kpi-val">{{ infra ? fmtNum(infra.bridges.critical_count) : '-' }}</div>
      <div class="kpi-sub">of {{ infra ? fmtNum(infra.bridges.total) : '-' }} total structures</div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA BMS / KRB</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Projects in progress</div>
      <div class="kpi-val">{{ infra ? fmtNum(infra.construction.in_progress) : '-' }}</div>
      <div class="kpi-sub">of {{ infra ? fmtNum(infra.construction.total_projects) : '-' }} total</div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA / KeRRA</div>
    </div>
    <div class="kpi-card" :class="infra && infra.budget.utilization_pct >= 60 ? 'good' : 'warn'">
      <div class="kpi-label">Budget utilisation</div>
      <div class="kpi-val">{{ infra ? fmtPct(infra.budget.utilization_pct) : '-' }}</div>
      <div class="kpi-sub">KES {{ infra ? fmtKsh(infra.budget.allocated_kes) : '-' }} allocated</div>
      <div class="kpi-source"><span class="source-dot batch" />KRB / SDT Finance</div>
    </div>
    <div class="kpi-card crit">
      <div class="kpi-label">Maintenance backlog</div>
      <div class="kpi-val">{{ infra ? `KES ${fmtKsh(infra.maintenance.open_value_kes)}` : '-' }}</div>
      <div class="kpi-sub">{{ infra ? fmtNum(infra.maintenance.open_orders) : '-' }} open orders</div>
      <div class="kpi-source"><span class="source-dot batch" />KeNHA / KURA</div>
    </div>
  </div>

  <!-- Condition distribution bar -->
  <div v-if="infra?.network?.condition_distribution?.length" class="spark-card">
    <div class="spark-card-head">National road condition index - distribution</div>
    <div class="spark-card-body">
      <div class="condition-bar">
        <div
          v-for="c in sortedConditions"
          :key="c.condition_class"
          class="condition-seg"
          :style="{
            flex: c.length || 1,
            background: conditionColor(c.condition_class),
          }"
          :title="`${c.condition_class}: ${fmtNum(c.total)} segments · ${fmtNum(c.length, 1)} km`"
        />
      </div>
      <div class="condition-legend">
        <span v-for="c in sortedConditions" :key="c.condition_class" class="condition-legend-item">
          <span class="condition-swatch" :style="{ background: conditionColor(c.condition_class) }" />
          {{ c.condition_class }} - {{ fmtNum(c.total) }} segs / {{ fmtNum(c.length, 0) }} km
        </span>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       6. PORT OPERATIONS
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">
    Port &amp; Corridor Operations
    <span class="section-pill" v-if="maritime">KPA · KMA · KenTrade · NCTTCA · {{ freshnessLabel(maritime.generated_at) }}</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card info">
      <div class="kpi-label">Active ports</div>
      <div class="kpi-val">{{ maritime ? fmtNum(maritime.kpis.active_ports) : '-' }}</div>
      <div class="kpi-sub">Sea + inland dry ports connected</div>
      <div class="kpi-source"><span class="source-dot live" />KPA / KMA / NCTTCA</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Live vessels in port</div>
      <div class="kpi-val">{{ maritime ? fmtNum(maritime.kpis.live_vessels) : '-' }}</div>
      <div class="kpi-sub">Currently berthed or at anchor</div>
      <div class="kpi-source"><span class="source-dot live" />KPA AIS</div>
    </div>
    <div class="kpi-card warn">
      <div class="kpi-label">Incidents (30d)</div>
      <div class="kpi-val">{{ maritime ? fmtNum(maritime.kpis.incidents_30d) : '-' }}</div>
      <div class="kpi-sub">Maritime safety incidents</div>
      <div class="kpi-source"><span class="source-dot batch" />KMA</div>
    </div>
    <div
      v-for="port in portList.slice(0, 3)"
      :key="port.port_unlocode"
      class="kpi-card"
      :class="port.avg_yard_dwell_days < 5 ? 'good' : 'warn'"
    >
      <div class="kpi-label">{{ port.port_name }} TEUs (30d)</div>
      <div class="kpi-val">{{ fmtNum(port.teu_throughput_30d) }}</div>
      <div class="kpi-sub">
        {{ fmtNum(port.currently_in_port) }} vessels · dwell {{ port.avg_yard_dwell_days?.toFixed(1) }} days
      </div>
      <div class="kpi-source"><span class="source-dot batch" />KPA</div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       7. GIS MAP + ACTIVE ALERTS WIDGET
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
          <div style="height:300px;background:linear-gradient(135deg,#e8ecee,#dde2e5,#cfd5d9);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:11px;color:rgba(55,65,81,.5)">Loading map…</span>
          </div>
        </template>
      </ClientOnly>
      <!-- Risk tier legend -->
      <div class="map-legend-strip">
        <span class="map-legend-title">Risk tier</span>
        <span class="map-legend-item"><span class="map-dot" style="background:#ef4444"></span>Critical</span>
        <span class="map-legend-item"><span class="map-dot" style="background:#f97316"></span>High</span>
        <span class="map-legend-item"><span class="map-dot" style="background:#eab308"></span>Medium</span>
        <span class="map-legend-item"><span class="map-dot" style="background:#94a3b8"></span>Low</span>
        <span class="map-legend-sep"></span>
        <span class="map-legend-item map-legend-dim"><span class="map-dot map-dot-sm" style="background:#f97316"></span>Black spot</span>
        <template v-if="roads">
          <span class="map-legend-sep"></span>
          <span class="map-legend-item map-legend-dim"><span class="map-dash" style="background:#64748b"></span>Roads</span>
        </template>
      </div>
    </div>

    <div class="alerts-section">
      <div class="alerts-head">
        Active alerts
        <span class="alerts-count">{{ activeAlerts.length }}</span>
      </div>

      <div
        v-for="(alert, i) in activeAlerts"
        :key="i"
        class="alert-item"
        :class="alert.severity"
      >
        <div class="alert-title">{{ alert.title }}</div>
        <div class="alert-meta">{{ alert.meta }}</div>
      </div>

      <div
        v-if="!loading && activeAlerts.length === 0"
        class="alert-item info"
      >
        <div class="alert-title">All systems nominal - no active escalations</div>
        <div class="alert-meta">UAPTS Platform · Live</div>
      </div>

      <div v-if="loading && activeAlerts.length === 0" class="alerts-loading">
        Loading alerts…
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       8. AGENCY FEED HEALTH (from useIntegrations)
  ════════════════════════════════════════════════════════════════ -->
  <div class="section-label">Agency Data Integration Status
    <!-- <span class="section-pill">15 agencies · NTSA · KeNHA · KURA · KeRRA · KRB · KAA · KCAA · KMD · KenTrade · LAPSSET · NaMATA · KRC · KPA · KMA · NCTTCA</span> -->
  </div>

  <div class="table-card">
    <table class="feed-table">
      <thead>
        <tr>
          <th>Agency / source system</th>
          <th>Status</th>
          <th>Mode</th>
          <th>Records today</th>
          <th>Last sync</th>
        </tr>
      </thead>
      <tbody v-if="integrations.length">
        <tr v-for="feed in integrations" :key="feed.id">
          <td><strong>{{ feed.agency_code }}</strong> - {{ feed.source_system }}</td>
          <td><span class="badge" :class="feedBadge(feed.status)">{{ feed.status }}</span></td>
          <td class="feed-mode">{{ feed.mode }}</td>
          <td class="feed-num">{{ feed.records_today != null ? fmtNum(feed.records_today) : '-' }}</td>
          <td class="feed-time">{{ feed.last_sync_at ? fmtTime(feed.last_sync_at) : '-' }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr>
          <td colspan="5" class="feed-empty">
            {{ loading ? 'Loading integration status…' : 'No integration data available' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       9. AGENCY DRILL-DOWN PREVIEWS (real data)
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
definePageMeta({ layout: 'default' })
useNavSubtitle('Executive Command Center')

import {
  useSafety, useFleet, useRailway, useAviationMaritime,
  useInfrastructure, useIntegrations, useGis,
} from '~/composables/api'
import type {
  SafetySummary, FleetSummary, RailwaySummary,
  AviationSummary, MaritimeOps, InfrastructureSummary,
  Integration, PredictiveHotspot, BlackSpot, GeoJSONFeatureCollection,
} from '~/composables/api'

type MarkerSpec = {
  id: string; lat: number; lon: number
  title?: string; subtitle?: string
  color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'
  size?: 'sm' | 'md' | 'lg'
}

// ── Domain data refs ───────────────────────────────────────────────────
const safety       = ref<SafetySummary | null>(null)
const fleet        = ref<FleetSummary | null>(null)
const rail         = ref<RailwaySummary | null>(null)
const aviation     = ref<AviationSummary | null>(null)
const maritime     = ref<MaritimeOps | null>(null)
const infra        = ref<InfrastructureSummary | null>(null)
const integrations = ref<Integration[]>([])
const hotspots     = ref<PredictiveHotspot[]>([])
const blackspots   = ref<BlackSpot[]>([])
const roads        = ref<GeoJSONFeatureCollection | null>(null)

const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')

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
    maritimeRes, infraRes, intsRes, hotspotsRes, blackspotsRes, roadsRes,
  ] = await Promise.allSettled([
    safetyApi.summary(),
    fleetApi.summary(),
    railApi.summary(),
    avApi.aviationSummary(7),
    avApi.maritimeOperations(30),
    infraApi.summary(),
    intsApi.list({ page_size: 50 }),
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
  if (hotspotsRes.status   === 'fulfilled') hotspots.value     = (hotspotsRes.value as any).results ?? []
  if (blackspotsRes.status === 'fulfilled') blackspots.value   = (blackspotsRes.value as any).results ?? []
  if (roadsRes.status      === 'fulfilled') roads.value        = roadsRes.value

  const allFailed = [safetyRes, fleetRes, railRes, aviationRes, maritimeRes, infraRes].every(
    r => r.status === 'rejected',
  )
  if (allFailed) error.value = 'Unable to reach the UAPTS API. Verify your connection and that the backend is running.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)

// Auto-refresh every 2 minutes
let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { refreshTimer = setInterval(load, 120_000) })
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })

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
const safetyBadge = computed((): 'crit' | 'warn' | 'good' => {
  if (!safety.value) return 'warn'
  if (safety.value.kpis.active > 10 || safety.value.kpis.fatal_30d > 20) return 'crit'
  if (safety.value.kpis.active > 5  || safety.value.kpis.fatal_30d > 10) return 'warn'
  return 'good'
})
const safetyLabel = computed(() =>
  safetyBadge.value === 'crit' ? 'CRITICAL' : safetyBadge.value === 'warn' ? 'WATCH' : 'GOOD',
)

// ── Derived: Infrastructure good % ────────────────────────────────────
const infraGoodPct = computed((): number => {
  if (!infra.value?.network?.condition_distribution) return 0
  const total = infra.value.network.condition_distribution.reduce((s, c) => s + (c.length || 0), 0)
  const good  = infra.value.network.condition_distribution
    .filter(c => c.condition_class === 'good')
    .reduce((s, c) => s + (c.length || 0), 0)
  return total > 0 ? (good / total) * 100 : 0
})

const sortedConditions = computed(() => {
  const order = ['good', 'fair', 'poor', 'critical', 'failed']
  return [...(infra.value?.network?.condition_distribution ?? [])]
    .sort((a, b) => order.indexOf(a.condition_class) - order.indexOf(b.condition_class))
})

// ── Derived: Port KPIs ─────────────────────────────────────────────────
const portList = computed(() => maritime.value?.ports ?? [])
const portSummaryLabel = computed(() => {
  if (!maritime.value) return '-'
  const teus = portList.value.reduce((s, p) => s + (p.teu_throughput_30d || 0), 0)
  return `${fmtNum(teus)} TEUs`
})
const portAvgDwell = computed(() => {
  if (!portList.value.length) return null
  const avg = portList.value.reduce((s, p) => s + (p.avg_yard_dwell_days || 0), 0) / portList.value.length
  return avg
})
const portAvgDwellLabel = computed(() =>
  portAvgDwell.value != null ? `Avg dwell: ${portAvgDwell.value.toFixed(1)} days` : '-',
)
const portDwellOk = computed(() => portAvgDwell.value != null && portAvgDwell.value < 5)
const portBadge = computed((): 'good' | 'warn' => (portDwellOk.value ? 'good' : 'warn'))

// ── Derived: Fatality sparkline max ───────────────────────────────────
const maxFatalities = computed(() => {
  const trend = safety.value?.fatality_trend_30d ?? []
  return Math.max(1, ...trend.map(d => d.fatalities))
})

// ── Helpers: condition colours + badges ───────────────────────────────
function conditionColor(cls: string): string {
  const map: Record<string, string> = {
    good: '#0ca30c', fair: '#84cc16', poor: '#fab219', critical: '#ec835a', failed: '#d03b3b',
  }
  return map[cls] ?? '#94a3b8'
}
function conditionBadge(cls: string): string {
  const map: Record<string, string> = {
    good: 'good', fair: 'info', poor: 'warn', critical: 'warn', failed: 'crit',
  }
  return map[cls] ?? 'info'
}
function feedBadge(status: Integration['status']): string {
  return status === 'connected'    ? 'good'
       : status === 'degraded'     ? 'warn'
       : status === 'pending'      ? 'info'
       : 'crit'
}

// ── Derived: Active alerts list ────────────────────────────────────────
type AlertSeverity = 'critical' | 'warning' | 'info'
interface AlertEntry { severity: AlertSeverity; title: string; meta: string }

const activeAlerts = computed((): AlertEntry[] => {
  const list: AlertEntry[] = []

  if (safety.value) {
    if (safety.value.kpis.active > 10)
      list.push({ severity: 'critical', title: `${fmtNum(safety.value.kpis.active)} active incidents - above threshold`, meta: 'NTSA IRSMS · Live' })
    else if (safety.value.kpis.active > 5)
      list.push({ severity: 'warning', title: `${fmtNum(safety.value.kpis.active)} active road incidents`, meta: 'NTSA IRSMS · Live' })

    if (safety.value.kpis.fatal_30d > 20)
      list.push({ severity: 'critical', title: `${fmtNum(safety.value.kpis.fatal_30d)} road fatalities in 30 days - exceeds threshold`, meta: 'NTSA IRSMS · 30d rolling' })
    else if (safety.value.kpis.fatal_30d > 10)
      list.push({ severity: 'warning', title: `${fmtNum(safety.value.kpis.fatal_30d)} road fatalities (30d) above normal`, meta: 'NTSA IRSMS · 30d rolling' })

    const criticalBlackSpots = safety.value.black_spots_by_tier['critical'] ?? 0
    if (criticalBlackSpots > 0)
      list.push({ severity: 'warning', title: `${fmtNum(criticalBlackSpots)} critical black spots active`, meta: 'NTSA KDE Analysis · Batch' })
  }

  if (fleet.value && fleet.value.governor_compliance.tamper_rate_pct > 5)
    list.push({ severity: 'warning', title: `Speed governor tamper rate: ${fmtPct(fleet.value.governor_compliance.tamper_rate_pct)}`, meta: 'NTSA iTIMS · Live' })

  if (infra.value && infra.value.bridges.critical_count > 0)
    list.push({ severity: 'warning', title: `${fmtNum(infra.value.bridges.critical_count)} bridges at critical condition`, meta: 'BMS · Batch survey' })

  if (rail.value && rail.value.incidents_90d.fatal > 0)
    list.push({ severity: 'critical', title: `${fmtNum(rail.value.incidents_90d.fatal)} fatal rail incidents (90d)`, meta: 'KRC Safety · Batch' })

  if (rail.value && rail.value.on_time_30d.on_time_pct < 70)
    list.push({ severity: 'warning', title: `Rail OTP below benchmark: ${fmtPct(rail.value.on_time_30d.on_time_pct)}`, meta: 'KRC Ops · Live' })

  if (aviation.value && aviation.value.kpis.otp_pct < 80)
    list.push({ severity: 'warning', title: `Aviation OTP below benchmark: ${fmtPct(aviation.value.kpis.otp_pct)}`, meta: 'KAA · Live' })

  const offlineFeeds = integrations.value.filter(f => f.status === 'disconnected' || f.status === 'degraded')
  if (offlineFeeds.length > 0)
    list.push({
      severity: offlineFeeds.some(f => f.status === 'disconnected') ? 'critical' : 'warning',
      title: `${offlineFeeds.length} agency feed(s) offline / degraded`,
      meta: offlineFeeds.map(f => f.agency_code).join(', '),
    })

  return list
})

// ── Map markers ────────────────────────────────────────────────────────
const mapMarkers = computed((): MarkerSpec[] => {
  const markers: MarkerSpec[] = []

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  for (const h of hotspots.value) {
    const color: MarkerSpec['color'] =
      h.risk_tier === 'critical' ? 'red'
      : h.risk_tier === 'high'   ? 'orange'
      : h.risk_tier === 'medium' ? 'yellow'
      : 'gray'
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Risk tier',   value: cap(h.risk_tier) },
      { label: 'Risk score',  value: `${(h.predicted_risk_score * 100).toFixed(0)}%` },
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
      size:  h.risk_tier === 'critical' ? 'lg' : 'md',
    })
  }

  for (const b of blackspots.value) {
    if (b.centroid_latitude == null || b.centroid_longitude == null) continue
    const color: MarkerSpec['color'] =
      b.ranking_tier === 'critical' ? 'red'
      : b.ranking_tier === 'high'   ? 'orange'
      : 'yellow'
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Tier',               value: cap(b.ranking_tier) },
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
/* ── Freshness badge ────────────────────────────────────────────────── */
.freshness-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f0fdf4;
  color: #15803d;
  border: 0.5px solid #bbf7d0;
}
.freshness-badge.loading {
  background: #fefce8;
  color: #854d0e;
  border-color: #fef08a;
}

/* ── Live pulse dot ─────────────────────────────────────────────────── */
.dot-live {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0ca30c;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* ── Source dots (live vs batch) ────────────────────────────────────── */
.source-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-right: 3px;
  vertical-align: middle;
  flex-shrink: 0;
}
.source-dot.live  { background: #0ca30c; }
.source-dot.batch { background: #1d5ca6; }

/* ── Error banner ───────────────────────────────────────────────────── */
.error-banner {
  margin: 12px 0;
  padding: 10px 16px;
  border-radius: 6px;
  background: #fef9c3;
  border: 0.5px solid #ca8a04;
  font-size: 13px;
  color: #854d0e;
}

/* ── Section labels ─────────────────────────────────────────────────── */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, #94a3b8);
  margin: 20px 0 8px;
}
.section-label::after {
  content: '';
  flex: 1;
  height: 0.5px;
  background: var(--border, rgba(11, 11, 11, 0.1));
}
.section-pill {
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 20px;
  background: var(--surface-1, #f4f3f0);
  color: var(--text-muted, #94a3b8);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ── KPI grid layouts ───────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}
.kpi-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* ── KPI card ───────────────────────────────────────────────────────── */
.kpi-card {
  background: var(--surface-2, #fff);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  position: relative;
  overflow: hidden;
}
.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 8px 0 0 8px;
}
.kpi-card.good::before  { background: #0ca30c; }
.kpi-card.warn::before  { background: #fab219; }
.kpi-card.crit::before  { background: #d03b3b; }
.kpi-card.info::before  { background: #1d5ca6; }

.kpi-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted, #94a3b8);
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.kpi-val {
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary, #0b0b0b);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.kpi-sub {
  font-size: 10px;
  color: var(--text-secondary, #52514e);
  line-height: 1.4;
}
.kpi-trend {
  font-size: 10px;
  margin-top: 2px;
  line-height: 1.3;
}
.kpi-trend.up   { color: #166534; }
.kpi-trend.down { color: #991b1b; }
.kpi-source {
  font-size: 9px;
  color: var(--text-muted, #94a3b8);
  margin-top: 4px;
  display: flex;
  align-items: center;
}

/* ── Badges ─────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}
.badge.good { background: #dcfce7; color: #166534; }
.badge.warn { background: #fef9c3; color: #854d0e; }
.badge.crit { background: #fee2e2; color: #991b1b; }
.badge.info { background: #e8f0f9; color: #1d5ca6; }

/* ── Spark / mini card (sparkline, fleet tags, condition bar) ────────── */
.spark-card {
  background: var(--surface-2, #fff);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  border-radius: 8px;
  overflow: hidden;
  margin-top: 8px;
}
.spark-card-head {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #52514e);
}
.spark-card-body {
  padding: 10px 12px;
}

/* ── Fatality sparkline ─────────────────────────────────────────────── */
.sparkbar {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 56px;
}
.sparkbar-bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  min-height: 3px;
  transition: opacity 0.15s;
}
.sparkbar-bar:hover { opacity: 0.75; }

/* ── Fleet composition tags ─────────────────────────────────────────── */
.fleet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fleet-tag {
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--surface-1, #f4f3f0);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  font-size: 11px;
  color: var(--text-secondary, #52514e);
}

/* ── Condition distribution bar ─────────────────────────────────────── */
.condition-bar {
  display: flex;
  height: 16px;
  border-radius: 4px;
  overflow: hidden;
  gap: 1px;
}
.condition-seg { min-width: 3px; }
.condition-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.condition-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-secondary, #52514e);
}
.condition-swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}

/* ── Dual-column layout (Rail + Aviation) ───────────────────────────── */
.dual-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.sub-section-head {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #52514e);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sub-section-pill {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted, #94a3b8);
}

/* ── Map + alerts row ───────────────────────────────────────────────── */
.map-alerts-row {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 12px;
}
.map-wrap {
  background: var(--surface-2, #fff);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  border-radius: 8px;
  overflow: hidden;
}
.map-wrap-head {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #52514e);
  display: flex;
  align-items: center;
  gap: 8px;
}
.map-head-meta {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: #94a3b8;
  white-space: nowrap;
}
.map-legend-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-top: 0.5px solid var(--border, rgba(11,11,11,0.08));
  background: #f8fafc;
  flex-wrap: wrap;
}
.map-legend-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-right: 2px;
}
.map-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #475569;
  white-space: nowrap;
}
.map-legend-dim { opacity: 0.75; }
.map-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid rgba(255,255,255,0.5);
}
.map-dot-sm {
  width: 6px;
  height: 6px;
}
.map-dash {
  display: inline-block;
  width: 16px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
  opacity: 0.7;
}
.map-legend-sep {
  display: inline-block;
  width: 1px;
  height: 12px;
  background: #e2e8f0;
  flex-shrink: 0;
}
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
  color: rgba(55, 65, 81, 0.5);
  letter-spacing: 0.02em;
}
.gis-legend {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 5px;
  padding: 7px 10px;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  z-index: 1;
  border: 0.5px solid rgba(11, 11, 11, 0.08);
}
.gis-legend-title {
  font-size: 9px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 2px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.gis-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #374151;
}
.gis-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

/* ── Alerts panel ───────────────────────────────────────────────────── */
.alerts-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.alerts-head {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #52514e);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.alerts-count {
  font-size: 10px;
  font-weight: 400;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--surface-1, #f4f3f0);
  color: var(--text-muted, #94a3b8);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
}
.alerts-loading {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  padding: 8px 0;
}
.alert-item {
  padding: 8px 10px;
  border-radius: 6px;
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  background: var(--surface-2, #fff);
  border-left-width: 3px;
}
.alert-item.critical { border-left-color: #d03b3b; background: #fff9f9; }
.alert-item.warning  { border-left-color: #fab219; background: #fffdf0; }
.alert-item.info     { border-left-color: #1d5ca6; background: #f5f8fd; }
.alert-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary, #0b0b0b);
  line-height: 1.4;
}
.alert-meta {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
  margin-top: 2px;
}

/* ── Integration feed table ─────────────────────────────────────────── */
.table-card {
  background: var(--surface-2, #fff);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  border-radius: 8px;
  overflow: hidden;
}
.feed-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.feed-table th {
  text-align: left;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #94a3b8);
  padding: 8px 12px 8px;
  border-bottom: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
}
.feed-table td {
  padding: 7px 12px;
  border-bottom: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  color: var(--text-primary, #0b0b0b);
  vertical-align: middle;
}
.feed-table tr:last-child td {
  border-bottom: none;
}
.feed-mode { color: var(--text-muted, #94a3b8); font-size: 10px; }
.feed-num  { font-variant-numeric: tabular-nums; }
.feed-time { white-space: nowrap; color: var(--text-muted, #94a3b8); font-size: 10px; }
.feed-empty {
  text-align: center;
  color: var(--text-muted, #94a3b8);
  padding: 20px;
  font-size: 12px;
}

/* ── Agency drill-down grid ─────────────────────────────────────────── */
.agency-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.agency-card {
  background: var(--surface-2, #fff);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.agency-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.agency-card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #0b0b0b);
}
.agency-tag {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--surface-1, #f4f3f0);
  color: var(--text-muted, #94a3b8);
  border: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}
.agency-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 0;
  border-bottom: 0.5px solid var(--border, rgba(11, 11, 11, 0.1));
}
.agency-row:last-of-type { border-bottom: none; }
.agency-row-label {
  font-size: 10px;
  color: var(--text-secondary, #52514e);
}
.agency-loading {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  padding: 4px 0;
}
.agency-link {
  font-size: 10px;
  color: #1d5ca6;
  text-decoration: none;
  margin-top: 6px;
  display: inline-block;
}
.agency-link:hover { text-decoration: underline; }

/* ── Mobile: collapse the 6-col KPI ribbon + 2-col dual blocks ───────── */
@media (max-width: 900px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .dual-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .kpi-grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  .kpi-grid-2 {
    grid-template-columns: 1fr;
  }
  .kpi-card {
    padding: 10px 12px;
  }
}
</style>