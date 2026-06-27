<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m02-traffic-map.html
    h1: Real-Time Traffic Map
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Real-Time Traffic Map</h1>
          <p class="page-subtitle">Full network real-time traffic status monitoring with multi-layer overlay and event
            alerts</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <button class="btn btn-secondary" onclick="UAPTS.openModal('routeOptimization')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            Route Optimization
          </button>
          <button class="btn btn-secondary" onclick="UAPTS.openModal('incidentModeling')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Incident Modeling
          </button>
          <button class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            </svg>
          </div>
          <div class="stat-card-value">847</div>
          <div class="stat-card-label">Monitored Road Sections</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +2.8% from yesterday
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div class="stat-card-value">562</div>
          <div class="stat-card-label">Free Flowing</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            66.4% of network
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div class="stat-card-value">198</div>
          <div class="stat-card-label">Slow Moving</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            23.4% of network
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div class="stat-card-value">87</div>
          <div class="stat-card-label">Congested</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            10.3% of network
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Region</span>
          <select class="select" style="width: 150px;">
            <option>All Regions</option>
            <option>CBD</option>
            <option>Westlands</option>
            <option>Karen</option>
            <option>Eastlands</option>
            <option>South B</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Road Class</span>
          <select class="select" style="width: 150px;">
            <option>All Classes</option>
            <option>Highway</option>
            <option>Arterial Road</option>
            <option>Main Road</option>
            <option>Secondary Road</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Time Range</span>
          <select class="select" style="width: 150px;">
            <option>Real-time</option>
            <option>Last 1 hour</option>
            <option>Last 3 hours</option>
            <option>Today</option>
          </select>
        </div>
        <div style="flex: 1;"></div>
        <div class="filter-group">
          <button type="button" class="toggle active" aria-label="Toggle Speed Analysis"></button>
          <span class="filter-label">Speed Analysis</span>
        </div>
        <div class="filter-group">
          <button type="button" class="toggle active" aria-label="Toggle Flow Analysis"></button>
          <span class="filter-label">Flow Analysis</span>
        </div>
        <div class="filter-group">
          <button type="button" class="toggle active" aria-label="Toggle Event Alerts"></button>
          <span class="filter-label">Event Alerts</span>
        </div>
      </div>

      <!-- Main Map Area -->
      <div class="grid-2" style="margin-bottom: var(--spacing-xl);">

        <div class="map-container" style="height: 500px; position: relative;">

          <!-- Google Map (REAL MAP) -->
          <div id="map" style="width: 100%; height: 100%;"></div>

          <!-- Map Controls (kept UI layer) -->
          <div class="map-controls">
            <button class="map-control-btn" onclick="mapZoomIn()">+</button>
            <button class="map-control-btn" onclick="mapZoomOut()">−</button>
            <button class="map-control-btn" onclick="locateUser()">⌖</button>
            <button class="map-control-btn" onclick="toggleFullscreen()">⛶</button>
          </div>

          <!-- Legend -->
          <div class="map-legend">
            <div class="legend-title">Traffic Status</div>
            <div class="legend-items">
              <div class="legend-item"><span style="color: var(--success)">●</span> Free Flow</div>
              <div class="legend-item"><span style="color: var(--warning)">●</span> Slow</div>
              <div class="legend-item"><span style="color: orange">●</span> Congested</div>
              <div class="legend-item"><span style="color: red">●</span> Severe</div>
            </div>
          </div>

        </div>

        <!-- Real-time Events List -->
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Real-Time Traffic Events</div>
                            <div class="card-subtitle">18 active events currently</div>
                        </div>
                        <div class="badge badge-red">Urgent</div>
                    </div>
                    <div class="card-body" style="padding: 0; max-height: 440px; overflow-y: auto;">
                        <div class="list-item" style="border-radius: 0; border-left: none; border-right: none;">
                            <div style="width: 8px; height: 8px; background: var(--danger); border-radius: 50%; margin-right: var(--spacing-md);"></div>
                            <div class="list-item-icon" style="background: rgba(239, 68, 68, 0.2); color: var(--danger);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                </svg>
                            </div>
                            <div class="list-item-content">
                                <div class="list-item-title">Mombasa Road A109 +25km</div>
                                <div class="list-item-subtitle">Traffic collision - 2km backup both directions</div>
                            </div>
                            <span class="badge badge-red">Severe</span>
                        </div>
                        <div class="list-item" style="border-radius: 0; border-left: none; border-right: none;">
                            <div style="width: 8px; height: 8px; background: var(--warning); border-radius: 50%; margin-right: var(--spacing-md);"></div>
                            <div class="list-item-icon" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                </svg>
                            </div>
                            <div class="list-item-content">
                                <div class="list-item-title">Waiyaki Way - University Area</div>
                                <div class="list-item-subtitle">Vehicle breakdown - using emergency lane</div>
                            </div>
                            <span class="badge badge-amber">Moderate</span>
                        </div>
                        <div class="list-item" style="border-radius: 0; border-left: none; border-right: none;">
                            <div style="width: 8px; height: 8px; background: var(--info); border-radius: 50%; margin-right: var(--spacing-md);"></div>
                            <div class="list-item-icon" style="background: rgba(59, 130, 246, 0.2); color: var(--info);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                            </div>
                            <div class="list-item-content">
                                <div class="list-item-title">Ngong Road (Kenyatta Hospital Junction)</div>
                                <div class="list-item-subtitle">Road construction - Est. completion Apr 25</div>
                            </div>
                            <span class="badge badge-blue">Ongoing</span>
                        </div>
                        <div class="list-item" style="border-radius: 0; border-left: none; border-right: none;">
                            <div style="width: 8px; height: 8px; background: var(--info); border-radius: 50%; margin-right: var(--spacing-md);"></div>
                            <div class="list-item-icon" style="background: rgba(139, 92, 246, 0.2); color: var(--accent-purple);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                            </div>
                            <div class="list-item-content">
                                <div class="list-item-title">Outer Ring Road - Ruiru Junction</div>
                                <div class="list-item-subtitle">Traffic control - 06:00-18:00 daily</div>
                            </div>
                            <span class="badge badge-blue">Planned</span>
                        </div>
                        <div class="list-item" style="border-radius: 0; border-left: none; border-right: none;">
                            <div style="width: 8px; height: 8px; background: var(--warning); border-radius: 50%; margin-right: var(--spacing-md);"></div>
                            <div class="list-item-icon" style="background: rgba(6, 182, 212, 0.2); color: var(--accent-cyan);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                            </div>
                            <div class="list-item-content">
                                <div class="list-item-title">Kenyatta Avenue (Kenyatta Hospital Gate)</div>
                                <div class="list-item-subtitle">High pedestrian volume - recommend off-peak travel</div>
                            </div>
                            <span class="badge badge-amber">Advisory</span>
                        </div>
                    </div>
                    <div class="card-footer" style="text-align: center;">
                        <button class="btn btn-ghost btn-sm">View All Events</button>
                    </div>
                </div>
      </div>

      <!-- Key Road Sections Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Key Road Sections Real-Time Status</div>
            <div class="card-subtitle">Real-time flow speed and congestion index for critical corridors</div>
          </div>
          <div style="display: flex; gap: var(--spacing-sm);">
            <input type="text" class="input" placeholder="Search road name..." style="width: 200px;">
            <select class="select" style="width: 140px;">
              <option>Sort by Status</option>
              <option>Sort by Name</option>
              <option>Sort by Congestion</option>
            </select>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Road Name</th>
                <th>Road Class</th>
                <th>Current Speed</th>
                <th>Free Flow Speed</th>
                <th>Congestion Index</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 500;">Mombasa Road A109 (CBD Section)</td>
                <td><span class="badge badge-blue">Highway</span></td>
                <td style="font-family: var(--font-mono);">22 km/h</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">80 km/h</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 100px;">
                      <div class="progress-bar danger" style="width: 72%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">7.2</span>
                  </div>
                </td>
                <td><span class="traffic-status severe">Severe Congestion</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">01:20:18</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Waiyaki Way (Westlands Section)</td>
                <td><span class="badge badge-blue">Highway</span></td>
                <td style="font-family: var(--font-mono);">35 km/h</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">60 km/h</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 100px;">
                      <div class="progress-bar warning" style="width: 42%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">4.2</span>
                  </div>
                </td>
                <td><span class="traffic-status moderate">Moderate Congestion</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">01:20:15</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Ngong Road (Karen Section)</td>
                <td><span class="badge badge-cyan">Arterial</span></td>
                <td style="font-family: var(--font-mono);">48 km/h</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">60 km/h</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 100px;">
                      <div class="progress-bar" style="width: 20%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">2.0</span>
                  </div>
                </td>
                <td><span class="traffic-status slow">Slow Moving</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">01:20:12</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Kenyatta Avenue (CBD Section)</td>
                <td><span class="badge badge-cyan">Arterial</span></td>
                <td style="font-family: var(--font-mono);">52 km/h</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">50 km/h</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 100px;">
                      <div class="progress-bar success" style="width: 4%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">1.0</span>
                  </div>
                </td>
                <td><span class="traffic-status free">Free Flow</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">01:20:10</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Outer Ring Road (Southern Section)</td>
                <td><span class="badge badge-blue">Highway</span></td>
                <td style="font-family: var(--font-mono);">65 km/h</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">80 km/h</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 100px;">
                      <div class="progress-bar" style="width: 19%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">1.9</span>
                  </div>
                </td>
                <td><span class="traffic-status free">Free Flow</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">01:20:08</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.875rem; color: var(--text-muted);">
            Showing 1-5 of 847 records
          </div>
          <div style="display: flex; gap: var(--spacing-xs);">
            <button class="btn btn-ghost btn-sm" disabled>Previous</button>
            <button class="btn btn-secondary btn-sm">1</button>
            <button class="btn btn-ghost btn-sm">2</button>
            <button class="btn btn-ghost btn-sm">3</button>
            <button class="btn btn-ghost btn-sm">...</button>
            <button class="btn btn-ghost btn-sm">170</button>
            <button class="btn btn-ghost btn-sm">Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Real-Time Traffic Map')
</script>
