<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m02-traffic-analytics.html
    h1: Traffic Analytics Dashboard
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Traffic Analytics Dashboard</h1>
          <p class="page-subtitle">Traffic pattern analysis, bottleneck identification, and prediction modeling</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <select class="select" style="width: 150px;">
            <option>Today</option>
            <option>This Week</option>
            <option selected>This Month</option>
            <option>Last 3 Months</option>
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
          <div class="stat-card-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div class="stat-card-value">1.24M</div>
          <div class="stat-card-label">Total Vehicles Tracked</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +12.3% from last month
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div class="stat-card-value">38.5</div>
          <div class="stat-card-label">Avg Network Speed (km/h)</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +5.2% from last month
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div class="stat-card-value">24.5</div>
          <div class="stat-card-label">Avg Travel Time Index</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -8.1% from last month
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
          <div class="stat-card-value">156</div>
          <div class="stat-card-label">Congestion Hotspots</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -15.2% from last month
          </div>
        </div>
      </div>

      <!-- Main Analysis Area -->
      <div class="grid-2" style="margin-bottom: var(--spacing-xl);">
        <!-- Traffic Volume Trend -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Traffic Volume Trend</div>
              <div class="card-subtitle">Hourly traffic volume changes over the past 24 hours</div>
            </div>
            <div style="display: flex; gap: var(--spacing-xs);">
              <button class="btn btn-sm btn-secondary">Hourly</button>
              <button class="btn btn-sm btn-ghost">Daily</button>
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

                <!-- Area fill -->
                <path
                  d="M50,130 Q100,110 150,120 Q200,90 250,100 Q300,70 350,80 Q400,60 450,75 Q500,55 550,70 L580,65 L580,180 L50,180 Z"
                  fill="rgba(59, 130, 246, 0.2)" />

                <!-- Line -->
                <path d="M50,130 Q100,110 150,120 Q200,90 250,100 Q300,70 350,80 Q400,60 450,75 Q500,55 550,70 L580,65"
                  fill="none" stroke="#3b82f6" stroke-width="2" />

                <!-- Peak marker -->
                <circle cx="400" cy="60" r="6" fill="#3b82f6" />
                <text x="400" y="45" text-anchor="middle" fill="#3b82f6" font-size="10" font-weight="600">Peak</text>
              </svg>
              <!-- X-axis labels -->
              <div
                style="display: flex; justify-content: space-between; padding: 0 50px; margin-top: var(--spacing-sm);">
                <span style="font-size: 0.625rem; color: var(--text-muted);">00:00</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">04:00</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">08:00</span>
                <span style="font-size: 0.625rem; color: var(--accent-blue); font-weight: 600;">12:00</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">16:00</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">20:00</span>
                <span style="font-size: 0.625rem; color: var(--text-muted);">24:00</span>
              </div>
            </div>
            <div
              style="display: flex; justify-content: space-around; margin-top: var(--spacing-lg); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color);">
              <div style="text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted);">Morning Peak (07:00-09:00)</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-blue);">48,520</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">vehicles/hour</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted);">Evening Peak (17:00-19:00)</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-blue);">52,180</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">vehicles/hour</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted);">Off-Peak Average</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">22,450</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">vehicles/hour</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Speed Distribution -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Speed Distribution Analysis</div>
              <div class="card-subtitle">Vehicle speed distribution across road categories</div>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: var(--spacing-xl);">
              <!-- Bar chart -->
              <div style="flex: 1;">
                <div style="margin-bottom: var(--spacing-lg);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Highways</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">58 km/h avg</span>
                  </div>
                  <div class="progress" style="height: 20px;">
                    <div class="progress-bar" style="width: 72%;"></div>
                  </div>
                </div>
                <div style="margin-bottom: var(--spacing-lg);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Arterial Roads</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">42 km/h avg</span>
                  </div>
                  <div class="progress" style="height: 20px;">
                    <div class="progress-bar warning" style="width: 52%;"></div>
                  </div>
                </div>
                <div style="margin-bottom: var(--spacing-lg);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Main Roads</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">35 km/h avg</span>
                  </div>
                  <div class="progress" style="height: 20px;">
                    <div class="progress-bar warning" style="width: 44%;"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Secondary Roads</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">28 km/h avg</span>
                  </div>
                  <div class="progress" style="height: 20px;">
                    <div class="progress-bar danger" style="width: 35%;"></div>
                  </div>
                </div>
              </div>

              <!-- Summary -->
              <div
                style="width: 120px; text-align: center; padding: var(--spacing-lg); background: var(--secondary-bg); border-radius: var(--radius-lg);">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Network Average</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--accent-blue);">38.5</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">km/h</div>
                <div
                  style="margin-top: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px solid var(--border-color);">
                  <span class="badge badge-emerald">Good</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Congestion Analysis -->
      <div class="grid-2">
        <!-- Heat Map -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Congestion Heat Map</div>
              <div class="card-subtitle">Traffic congestion intensity by time of day and location</div>
            </div>
          </div>
          <div class="card-body">
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                <thead>
                  <tr>
                    <th style="padding: var(--spacing-sm); text-align: left; color: var(--text-muted); width: 100px;">
                      Location</th>
                    <th style="padding: var(--spacing-sm);">00-04</th>
                    <th style="padding: var(--spacing-sm);">04-08</th>
                    <th style="padding: var(--spacing-sm); background: rgba(239, 68, 68, 0.2);">08-12</th>
                    <th style="padding: var(--spacing-sm);">12-16</th>
                    <th style="padding: var(--spacing-sm); background: rgba(239, 68, 68, 0.2);">16-20</th>
                    <th style="padding: var(--spacing-sm);">20-24</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: var(--spacing-sm); font-weight: 500;">Mombasa Road</td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: var(--spacing-sm); font-weight: 500;">Waiyaki Way</td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: var(--spacing-sm); font-weight: 500;">Ngong Road</td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: var(--spacing-sm); font-weight: 500;">Kenyatta Ave</td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px;">Med</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px;">High</span>
                    </td>
                    <td style="padding: var(--spacing-sm); text-align: center;"><span
                        style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px;">Low</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              style="display: flex; justify-content: center; gap: var(--spacing-lg); margin-top: var(--spacing-lg); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <div style="width: 16px; height: 16px; background: var(--success); border-radius: 4px;"></div>
                <span style="font-size: 0.75rem;">Low Congestion</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <div style="width: 16px; height: 16px; background: var(--warning); border-radius: 4px;"></div>
                <span style="font-size: 0.75rem;">Medium Congestion</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <div style="width: 16px; height: 16px; background: var(--danger); border-radius: 4px;"></div>
                <span style="font-size: 0.75rem;">High Congestion</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Congestion Locations -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Top 5 Congestion Locations</div>
              <div class="card-subtitle">Locations requiring priority intervention</div>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div
              style="padding: var(--spacing-md); background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--danger);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">#1</span>
                <span class="badge badge-red">Critical</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Mombasa Road + Kenyatta Hospital
                Junction</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Avg delay: 18
                min | Peak: 35 min</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Affected vehicles: 12,450/hour</div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 4px solid var(--warning);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--warning);">#2</span>
                <span class="badge badge-amber">Serious</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Waiyaki Way + University Way
                Intersection</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Avg delay: 15
                min | Peak: 28 min</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Affected vehicles: 9,820/hour</div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 4px solid var(--warning);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--warning);">#3</span>
                <span class="badge badge-amber">Serious</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Ngong Road + Karen Roundabout
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Avg delay: 12
                min | Peak: 22 min</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Affected vehicles: 8,150/hour</div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 4px solid var(--info);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 1.125rem; font-weight: 700; color: var(--info);">#4</span>
                <span class="badge badge-blue">Moderate</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Outer Ring Road + Ruiru Gate</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Avg delay: 8
                min | Peak: 15 min</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Affected vehicles: 6,780/hour</div>
            </div>

            <div style="padding: var(--spacing-md); border-left: 4px solid var(--info);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 1.125rem; font-weight: 700; color: var(--info);">#5</span>
                <span class="badge badge-blue">Moderate</span>
              </div>
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px;">Enterprise Road + Industrial Area
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Avg delay: 6
                min | Peak: 12 min</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Affected vehicles: 5,420/hour</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Traffic Analytics')
</script>
