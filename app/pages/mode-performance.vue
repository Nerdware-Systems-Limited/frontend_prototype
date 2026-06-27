<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m07-mode-performance.html
    h1: Mode Performance Dashboard
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Mode Performance Dashboard</h1>
          <p class="page-subtitle">Comparative performance analysis across aviation, maritime, and railway sectors</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <select class="select" style="width: 150px;">
            <option>This Month</option>
            <option selected>This Quarter</option>
            <option>This Year</option>
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

      <!-- KPI Rings -->
      <div class="stats-grid" style="margin-bottom: var(--spacing-xl);">
        <!-- Aviation -->
        <div class="stat-card" style="text-align: center;">
          <div style="position: relative; width: 120px; height: 120px; margin: 0 auto var(--spacing-md);">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--secondary-bg)" stroke-width="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#3b82f6" stroke-width="10" stroke-dasharray="314"
                stroke-dashoffset="47" transform="rotate(-90 60 60)" />
            </svg>
            <div
              style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 1.75rem; font-weight: 700; color: #3b82f6;">85%</div>
              <div style="font-size: 0.625rem; color: var(--text-muted);">of 95% target</div>
            </div>
          </div>
          <div
            style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <path
                d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z" />
            </svg>
            <span style="font-size: 0.875rem; font-weight: 600;">Aviation</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">JKIA Performance Score</div>
        </div>

        <!-- Maritime -->
        <div class="stat-card" style="text-align: center;">
          <div style="position: relative; width: 120px; height: 120px; margin: 0 auto var(--spacing-md);">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--secondary-bg)" stroke-width="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" stroke-width="10" stroke-dasharray="314"
                stroke-dashoffset="16" transform="rotate(-90 60 60)" />
            </svg>
            <div
              style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 1.75rem; font-weight: 700; color: #10b981;">95%</div>
              <div style="font-size: 0.625rem; color: var(--text-muted);">of 95% target</div>
            </div>
          </div>
          <div
            style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <path d="M18 8c0-3.314-2.686-6-6-6S6 4.686 6 8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4z" />
              <path d="M12 12v10" />
              <path d="M8 22h8" />
            </svg>
            <span style="font-size: 0.875rem; font-weight: 600;">Maritime</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">KPA Port Efficiency</div>
        </div>

        <!-- Railway -->
        <div class="stat-card" style="text-align: center;">
          <div style="position: relative; width: 120px; height: 120px; margin: 0 auto var(--spacing-md);">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--secondary-bg)" stroke-width="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#8b5cf6" stroke-width="10" stroke-dasharray="314"
                stroke-dashoffset="47" transform="rotate(-90 60 60)" />
            </svg>
            <div
              style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 1.75rem; font-weight: 700; color: #8b5cf6;">85%</div>
              <div style="font-size: 0.625rem; color: var(--text-muted);">of 90% target</div>
            </div>
          </div>
          <div
            style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span style="font-size: 0.875rem; font-weight: 600;">Railway</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">SGR On-Time Rate</div>
        </div>

        <!-- Overall -->
        <div class="stat-card" style="text-align: center;">
          <div style="position: relative; width: 120px; height: 120px; margin: 0 auto var(--spacing-md);">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--secondary-bg)" stroke-width="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f59e0b" stroke-width="10" stroke-dasharray="314"
                stroke-dashoffset="31" transform="rotate(-90 60 60)" />
            </svg>
            <div
              style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 1.75rem; font-weight: 700; color: #f59e0b;">90%</div>
              <div style="font-size: 0.625rem; color: var(--text-muted);">avg efficiency</div>
            </div>
          </div>
          <div
            style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style="font-size: 0.875rem; font-weight: 600;">Overall</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Network Efficiency</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid-2" style="margin-bottom: var(--spacing-xl);">
        <!-- On-Time Rate Comparison -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">On-Time Rate Trend</div>
              <div class="card-subtitle">Monthly on-time performance comparison across modes</div>
            </div>
            <div class="chart-labels">
              <div class="chart-label">
                <div class="chart-label-dot" style="background: #3b82f6;"></div>
                <span>Aviation</span>
              </div>
              <div class="chart-label">
                <div class="chart-label-dot" style="background: #10b981;"></div>
                <span>Maritime</span>
              </div>
              <div class="chart-label">
                <div class="chart-label-dot" style="background: #8b5cf6;"></div>
                <span>Railway</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height: 250px;">
              <svg width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid meet">
                <!-- Grid lines -->
                <line x1="50" y1="20" x2="580" y2="20" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="60" x2="580" y2="60" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="100" x2="580" y2="100" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />
                <line x1="50" y1="140" x2="580" y2="140" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" />

                <!-- Aviation line -->
                <polyline points="50,70 94,65 138,60 182,55 226,50 270,45 314,48 358,42 402,38 446,42 490,38 534,35"
                  fill="none" stroke="#3b82f6" stroke-width="2" />

                <!-- Maritime line -->
                <polyline points="50,80 94,75 138,70 182,65 226,60 270,55 314,50 358,48 402,45 446,42 490,40 534,38"
                  fill="none" stroke="#10b981" stroke-width="2" />

                <!-- Railway line -->
                <polyline points="50,75 94,72 138,68 182,62 226,58 270,52 314,50 358,55 402,48 446,52 490,45 534,42"
                  fill="none" stroke="#8b5cf6" stroke-width="2" />

                <!-- Target line -->
                <line x1="50" y1="28" x2="580" y2="28" stroke="#ef4444" stroke-width="1" stroke-dasharray="5,5" />
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
                <span style="font-size: 0.625rem; color: var(--accent-amber); font-weight: 600;">Mar</span>
              </div>
            </div>
            <div style="text-align: center; margin-top: var(--spacing-md);">
              <span style="font-size: 0.75rem; color: var(--danger);">Red dashed line: 95% Target</span>
            </div>
          </div>
        </div>

        <!-- Capacity Utilization -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Capacity Utilization</div>
              <div class="card-subtitle">Resource utilization rates by transport mode</div>
            </div>
          </div>
          <div class="card-body">
            <div style="margin-bottom: var(--spacing-xl);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                    <path
                      d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z" />
                  </svg>
                  <span style="font-size: 0.875rem;">Aviation (Passenger Load Factor)</span>
                </div>
                <span style="font-size: 1rem; font-weight: 600; color: #3b82f6;">78%</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar" style="width: 78%;"></div>
              </div>
            </div>

            <div style="margin-bottom: var(--spacing-xl);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <path d="M18 8c0-3.314-2.686-6-6-6S6 4.686 6 8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4z" />
                    <path d="M12 12v10" />
                    <path d="M8 22h8" />
                  </svg>
                  <span style="font-size: 0.875rem;">Maritime (Container Utilization)</span>
                </div>
                <span style="font-size: 1rem; font-weight: 600; color: #10b981;">85%</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar success" style="width: 85%;"></div>
              </div>
            </div>

            <div style="margin-bottom: var(--spacing-xl);">
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span style="font-size: 0.875rem;">Railway (Cargo Load Factor)</span>
                </div>
                <span style="font-size: 1rem; font-weight: 600; color: #8b5cf6;">72%</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar" style="width: 72%;"></div>
              </div>
            </div>

            <div>
              <div
                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                    <path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <span style="font-size: 0.875rem;">Overall (Weighted Average)</span>
                </div>
                <span style="font-size: 1rem; font-weight: 600; color: #f59e0b;">78%</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar warning" style="width: 78%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Comparison Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Comprehensive Efficiency Comparison</div>
            <div class="card-subtitle">Key performance indicators across transport modes</div>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th style="color: #3b82f6;">Aviation (JKIA)</th>
                <th style="color: #10b981;">Maritime (KPA)</th>
                <th style="color: #8b5cf6;">Railway (SGR)</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 500;">On-Time Rate</td>
                <td>
                  <span style="color: var(--warning);">85%</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"
                    style="vertical-align: middle; margin-left: 4px;">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </td>
                <td>
                  <span style="color: var(--success);">95%</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"
                    style="vertical-align: middle; margin-left: 4px;">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </td>
                <td>
                  <span style="color: var(--success);">88%</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"
                    style="vertical-align: middle; margin-left: 4px;">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </td>
                <td>95%</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Daily Throughput</td>
                <td>248 flights</td>
                <td>42 vessels / 8,420 TEUs</td>
                <td>186 trains / 12,450 tonnes</td>
                <td>-</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Avg Turnaround Time</td>
                <td>
                  <span style="color: var(--success);">45 min</span>
                </td>
                <td>
                  <span style="color: var(--warning);">18 hrs</span>
                </td>
                <td>
                  <span style="color: var(--success);">2.5 hrs</span>
                </td>
                <td>Air: 45min, Sea: 12hrs, Rail: 3hrs</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Capacity Utilization</td>
                <td>
                  <span style="color: var(--warning);">78%</span>
                </td>
                <td>
                  <span style="color: var(--success);">85%</span>
                </td>
                <td>
                  <span style="color: var(--warning);">72%</span>
                </td>
                <td>80%</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Safety Incidents</td>
                <td>
                  <span style="color: var(--success);">0</span>
                </td>
                <td>
                  <span style="color: var(--success);">1</span>
                </td>
                <td>
                  <span style="color: var(--success);">0</span>
                </td>
                <td>0</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Customer Satisfaction</td>
                <td>
                  <span style="color: var(--success);">4.2/5</span>
                </td>
                <td>
                  <span style="color: var(--success);">4.0/5</span>
                </td>
                <td>
                  <span style="color: var(--warning);">3.8/5</span>
                </td>
                <td>4.0/5</td>
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
useNavSubtitle('Mode Performance')
</script>
