<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m05-safety-analytics.html
    h1: Safety Analytics Dashboard
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Safety Analytics Dashboard</h1>
          <p class="page-subtitle">Accident trend analysis and black spot identification</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <select class="select" style="width: 150px;">
            <option>This Month</option>
            <option>This Quarter</option>
            <option selected>This Year</option>
            <option>Custom</option>
          </select>
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

      <!-- Stats Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div class="stat-card-value">156</div>
          <div class="stat-card-label">Total Accidents</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -18.5% from last year
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div class="stat-card-value">12</div>
          <div class="stat-card-label">Fatalities</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -25.0% from last year
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div class="stat-card-value">234</div>
          <div class="stat-card-label">Injuries</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -12.3% from last year
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div class="stat-card-value">45.2</div>
          <div class="stat-card-label">Accident Rate per 100M km</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -8.7% from last year
          </div>
        </div>
      </div>

      <!-- Main Analysis Area -->
      <div class="grid-2" style="margin-bottom: var(--spacing-xl);">
        <!-- Accident Trend Chart -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Accident Trend Analysis</div>
              <div class="card-subtitle">Monthly accident count and severity changes over 12 months</div>
            </div>
            <div style="display: flex; gap: var(--spacing-xs);">
              <button class="btn btn-sm btn-secondary">Monthly</button>
              <button class="btn btn-sm btn-ghost">Weekly</button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height: 280px;">
              <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet">
                <!-- Grid lines -->
                <line x1="50" y1="20" x2="580" y2="20" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="65" x2="580" y2="65" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="110" x2="580" y2="110" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="155" x2="580" y2="155" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />

                <!-- Total accidents line -->
                <polyline
                  points="50,130 94,115 138,120 182,105 226,110 270,95 314,100 358,85 402,90 446,75 490,80 534,65"
                  fill="none" stroke="#3b82f6" stroke-width="2" />

                <!-- Fatal accidents line -->
                <polyline
                  points="50,170 94,165 138,168 182,160 226,165 270,158 314,162 358,155 402,158 446,150 490,155 534,148"
                  fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5" />

                <!-- Data points -->
                <circle cx="534" cy="65" r="5" fill="#3b82f6" />
                <circle cx="534" cy="148" r="5" fill="#ef4444" />
              </svg>
              <!-- X-axis labels -->
              <div
                style="display: flex; justify-content: space-between; padding: 0 50px; margin-top: var(--spacing-sm);">
                <span style="font-size: 0.625rem; color: var(--text-muted);">Apr</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">May</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Jun</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Jul</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Aug</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Sep</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Oct</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Nov</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Dec</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Jan</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">Feb</span>
                <span style="font-size: 0.625rem; color: var(--accent-blue); font-weight: 600;">Mar</span>
              </div>
            </div>
            <div class="chart-labels">
              <div class="chart-label">
                <div class="chart-label-dot" style="background: var(--accent-blue);"></div>
                <span>Total Accidents</span>
              </div>
              <div class="chart-label">
                <div class="chart-label-dot" style="background: var(--accent-red);"></div>
                <span>Fatal Accidents</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Cause Distribution -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Accident Cause Analysis</div>
              <div class="card-subtitle">Primary accident cause statistics</div>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: var(--spacing-xl);">
              <!-- Donut chart -->
              <div style="position: relative; width: 160px; height: 160px;">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="60" fill="none" stroke="#ef4444" stroke-width="30"
                    stroke-dasharray="113 376" transform="rotate(-90 80 80)" />
                  <circle cx="80" cy="80" r="60" fill="none" stroke="#f59e0b" stroke-width="30"
                    stroke-dasharray="94 376" stroke-dashoffset="-113" transform="rotate(-90 80 80)" />
                  <circle cx="80" cy="80" r="60" fill="none" stroke="#3b82f6" stroke-width="30"
                    stroke-dasharray="75 376" stroke-dashoffset="-207" transform="rotate(-90 80 80)" />
                  <circle cx="80" cy="80" r="60" fill="none" stroke="#10b981" stroke-width="30"
                    stroke-dasharray="56 376" stroke-dashoffset="-282" transform="rotate(-90 80 80)" />
                  <circle cx="80" cy="80" r="60" fill="none" stroke="#8b5cf6" stroke-width="30"
                    stroke-dasharray="38 376" stroke-dashoffset="-338" transform="rotate(-90 80 80)" />
                </svg>
              </div>

              <!-- Legend -->
              <div style="flex: 1;">
                <div
                  style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
                  <div style="width: 12px; height: 12px; background: var(--danger); border-radius: 2px;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 500;">Excessive Speed</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.875rem; font-weight: 600;">30%</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">47 cases
                    </div>
                  </div>
                </div>
                <div
                  style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
                  <div style="width: 12px; height: 12px; background: var(--warning); border-radius: 2px;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 500;">Distracted Driving</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.875rem; font-weight: 600;">25%</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">39 cases
                    </div>
                  </div>
                </div>
                <div
                  style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
                  <div style="width: 12px; height: 12px; background: var(--accent-blue); border-radius: 2px;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 500;">Illegal Lane Change</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.875rem; font-weight: 600;">20%</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">31 cases
                    </div>
                  </div>
                </div>
                <div
                  style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
                  <div style="width: 12px; height: 12px; background: var(--accent-emerald); border-radius: 2px;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 500;">Driving Under Influence</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.875rem; font-weight: 600;">15%</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">23 cases
                    </div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0;">
                  <div style="width: 12px; height: 12px; background: var(--accent-purple); border-radius: 2px;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 500;">Other Causes</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.875rem; font-weight: 600;">10%</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">16 cases
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accident Black Spot Analysis -->
      <div class="grid-2">
        <!-- Density Map -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Accident Black Spot Density Analysis</div>
              <div class="card-subtitle">Accident hotspot identification based on kernel density estimation</div>
            </div>
          </div>
          <div class="card-body">
            <div class="density-map" style="height: 350px;">
              <div class="map-grid"></div>

              <!-- Density heatmap -->
              <svg style="position: absolute; inset: 0; width: 100%; height: 100%;" viewBox="0 0 600 300"
                preserveAspectRatio="xMidYMid slice">
                <!-- Roads -->
                <path d="M50,150 Q200,150 300,120 T550,150" stroke="rgba(59, 130, 246, 0.3)" stroke-width="20"
                  fill="none" />
                <path d="M100,50 Q300,80 500,50" stroke="rgba(59, 130, 246, 0.3)" stroke-width="16" fill="none" />
                <path d="M100,250 Q300,220 500,250" stroke="rgba(59, 130, 246, 0.3)" stroke-width="16" fill="none" />

                <!-- Density hotspots -->
                <ellipse cx="280" cy="130" rx="80" ry="50" fill="rgba(239, 68, 68, 0.4)" />
                <ellipse cx="280" cy="130" rx="120" ry="75" fill="rgba(239, 68, 68, 0.2)" />

                <ellipse cx="450" cy="150" rx="60" ry="40" fill="rgba(245, 158, 11, 0.35)" />
                <ellipse cx="450" cy="150" rx="100" ry="65" fill="rgba(245, 158, 11, 0.15)" />

                <ellipse cx="150" cy="150" rx="50" ry="35" fill="rgba(245, 158, 11, 0.25)" />

                <!-- Markers -->
                <g transform="translate(280, 130)">
                  <circle r="8" fill="#ef4444" />
                  <text y="25" text-anchor="middle" fill="white" font-size="8" font-weight="600">Black Spot 1</text>
                  <text y="38" text-anchor="middle" fill="#ef4444" font-size="7">23 cases</text>
                </g>

                <g transform="translate(450, 150)">
                  <circle r="6" fill="#f59e0b" />
                  <text y="20" text-anchor="middle" fill="white" font-size="7" font-weight="600">Black Spot 2</text>
                  <text y="32" text-anchor="middle" fill="#f59e0b" font-size="6">15 cases</text>
                </g>

                <g transform="translate(150, 150)">
                  <circle r="5" fill="#f59e0b" />
                  <text y="18" text-anchor="middle" fill="white" font-size="6" font-weight="600">Black Spot 3</text>
                  <text y="28" text-anchor="middle" fill="#f59e0b" font-size="5">8 cases</text>
                </g>
              </svg>
            </div>

            <!-- Legend -->
            <div style="display: flex; justify-content: center; gap: var(--spacing-xl); margin-top: var(--spacing-md);">
              <div class="legend-item">
                <div
                  style="width: 24px; height: 12px; background: radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, transparent 70%);">
                </div>
                <span>High Density</span>
              </div>
              <div class="legend-item">
                <div
                  style="width: 24px; height: 12px; background: radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%);">
                </div>
                <span>Medium Density</span>
              </div>
              <div class="legend-item">
                <div
                  style="width: 24px; height: 12px; background: radial-gradient(circle, rgba(234, 179, 8, 0.2) 0%, transparent 70%);">
                </div>
                <span>Low Density</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Black Spot List -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Accident Black Spot Rankings</div>
              <div class="card-subtitle">High-accident locations requiring priority treatment</div>
            </div>
          </div>
          <div class="card-body" style="padding: 0; max-height: 380px; overflow-y: auto;">
            <div
              style="padding: var(--spacing-md); background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--danger);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span class="badge badge-red">High Risk</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">23 accidents</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Mombasa Road + Ngong Road Junction
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Main causes: Traffic conflict, poor sight
                distance</div>
              <div style="margin-top: var(--spacing-sm);">
                <span class="badge badge-amber">Recommendation: Signal optimization</span>
              </div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 3px solid var(--warning);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span class="badge badge-amber">Medium Risk</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">15 accidents</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Waiyaki Way km 4-8</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Main causes: Speed differential, distracted
                driving</div>
              <div style="margin-top: var(--spacing-sm);">
                <span class="badge badge-blue">Recommendation: Speed limit adjustment</span>
              </div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 3px solid var(--warning);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span class="badge badge-amber">Medium Risk</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">12 accidents</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Outer Ring Road + Ruiru Junction
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Main causes: Lane change conflicts, merging
                traffic</div>
              <div style="margin-top: var(--spacing-sm);">
                <span class="badge badge-cyan">Recommendation: Add warning signs</span>
              </div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 3px solid var(--info);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span class="badge badge-blue">Low Risk</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">8 accidents</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Kenyatta Avenue (Kenyatta Hospital
                Section)</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Main causes: Pedestrian crossing, illegal
                parking</div>
              <div style="margin-top: var(--spacing-sm);">
                <span class="badge badge-emerald">Recommendation: Add barriers</span>
              </div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 3px solid var(--info);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span class="badge badge-blue">Low Risk</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">6 accidents</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Enterprise Road (Industrial Area
                Section)</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Main causes: High truck volume, inadequate
                lighting</div>
              <div style="margin-top: var(--spacing-sm);">
                <span class="badge badge-blue">Recommendation: Improve lighting</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Data Table -->
      <div class="card" style="margin-top: var(--spacing-xl);">
        <div class="card-header">
          <div>
            <div class="card-title">Detailed Accident Records</div>
            <div class="card-subtitle">All accidents this year with detailed data</div>
          </div>
          <div class="input-group" style="margin: 0;">
            <input type="text" class="input" placeholder="Search location..." style="width: 200px;">
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Casualties</th>
                <th>Primary Cause</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-family: var(--font-mono);">2026-04-08</td>
                <td style="font-weight: 500;">Mombasa Road A109 km 25</td>
                <td>Rear-end collision</td>
                <td><span class="badge badge-red">Fatal</span></td>
                <td>2 deaths</td>
                <td>Excessive speed</td>
                <td><span class="badge badge-amber">In Progress</span></td>
              </tr>
              <tr>
                <td style="font-family: var(--font-mono);">2026-04-06</td>
                <td style="font-weight: 500;">Waiyaki Way km 6</td>
                <td>Rollover accident</td>
                <td><span class="badge badge-red">Serious</span></td>
                <td>3 injured</td>
                <td>Distracted driving</td>
                <td><span class="badge badge-emerald">Closed</span></td>
              </tr>
              <tr>
                <td style="font-family: var(--font-mono);">2026-04-03</td>
                <td style="font-weight: 500;">Ngong Road (Karen Junction)</td>
                <td>Side-swipe accident</td>
                <td><span class="badge badge-amber">Moderate</span></td>
                <td>No injuries</td>
                <td>Illegal lane change</td>
                <td><span class="badge badge-emerald">Closed</span></td>
              </tr>
              <tr>
                <td style="font-family: var(--font-mono);">2026-03-29</td>
                <td style="font-weight: 500;">Kenyatta Avenue (CBD)</td>
                <td>Pedestrian collision</td>
                <td><span class="badge badge-blue">Minor</span></td>
                <td>1 minor injury</td>
                <td>Driving under influence</td>
                <td><span class="badge badge-emerald">Closed</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Safety Analytics')
</script>
