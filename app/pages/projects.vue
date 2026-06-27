<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m06-project-tracking.html
    h1: Project Tracking Dashboard
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Project Tracking Dashboard</h1>
          <p class="page-subtitle">Real-time monitoring of infrastructure construction and maintenance projects</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <button class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
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

      <!-- Stats Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div class="stat-card-value">48</div>
          <div class="stat-card-label">Active Projects</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +5 this month
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div class="stat-card-value">KES 4.2B</div>
          <div class="stat-card-label">Total Investment</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +KES 850M from last year
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div class="stat-card-value">68.5%</div>
          <div class="stat-card-label">Avg Progress</div>
          <div class="stat-card-trend up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +8.2% from last month
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
          <div class="stat-card-value">5</div>
          <div class="stat-card-label">Delayed Projects</div>
          <div class="stat-card-trend down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            -2 from last month
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Project Type</span>
          <select class="select" style="width: 150px;">
            <option>All Types</option>
            <option>Road Construction</option>
            <option>Road Maintenance</option>
            <option>Bridge Construction</option>
            <option>Signal Installation</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Status</span>
          <select class="select" style="width: 140px;">
            <option>All Status</option>
            <option>On Schedule</option>
            <option>At Risk</option>
            <option>Delayed</option>
            <option>Completed</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Agency</span>
          <select class="select" style="width: 150px;">
            <option>All Agencies</option>
            <option>KeNHA</option>
            <option>KURA</option>
            <option>County Government</option>
          </select>
        </div>
        <div style="flex: 1;"></div>
        <div class="input-group" style="margin: 0;">
          <input type="text" class="input" placeholder="Search project name..." style="width: 200px;">
          <button class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Project Table -->
      <div class="card" style="margin-bottom: var(--spacing-xl);">
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Agency</th>
                <th>Contractor</th>
                <th>Progress</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 500;">Outer Ring Road Dualling (Ruiru Section)</td>
                <td><span class="badge badge-blue">KeNHA</span></td>
                <td>China Wu Yi Ltd</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 80px;">
                      <div class="progress-bar success" style="width: 75%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">75%</span>
                  </div>
                </td>
                <td style="font-family: var(--font-mono);">KES 1.2B</td>
                <td style="font-family: var(--font-mono);">KES 892M</td>
                <td><span class="badge badge-emerald">On Schedule</span></td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Mombasa Road A109 Overlay Project</td>
                <td><span class="badge badge-blue">KeNHA</span></td>
                <td>Strabag International</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 80px;">
                      <div class="progress-bar" style="width: 60%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">60%</span>
                  </div>
                </td>
                <td style="font-family: var(--font-mono);">KES 680M</td>
                <td style="font-family: var(--font-mono);">KES 408M</td>
                <td><span class="badge badge-emerald">On Schedule</span></td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Waiyaki Way Widening (CBD-Westlands)</td>
                <td><span class="badge badge-cyan">KURA</span></td>
                <td>China Communications Construction</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 80px;">
                      <div class="progress-bar warning" style="width: 45%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">45%</span>
                  </div>
                </td>
                <td style="font-family: var(--font-mono);">KES 2.8B</td>
                <td style="font-family: var(--font-mono);">KES 1.26B</td>
                <td><span class="badge badge-amber">At Risk</span></td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Ngong Road Signal Upgrade (12 Junctions)</td>
                <td><span class="badge badge-cyan">KURA</span></td>
                <td>M-Gas Technologies</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 80px;">
                      <div class="progress-bar success" style="width: 88%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">88%</span>
                  </div>
                </td>
                <td style="font-family: var(--font-mono);">KES 145M</td>
                <td style="font-family: var(--font-mono);">KES 128M</td>
                <td><span class="badge badge-emerald">On Schedule</span></td>
              </tr>
              <tr>
                <td style="font-weight: 500;">CBD Intelligent Transport System</td>
                <td><span class="badge badge-purple">County</span></td>
                <td>Huawei Technologies Kenya</td>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <div class="progress" style="width: 80px;">
                      <div class="progress-bar danger" style="width: 30%;"></div>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem;">30%</span>
                  </div>
                </td>
                <td style="font-family: var(--font-mono);">KES 450M</td>
                <td style="font-family: var(--font-mono);">KES 135M</td>
                <td><span class="badge badge-red">Delayed</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.875rem; color: var(--text-muted);">
            Showing 1-5 of 48 projects
          </div>
          <div style="display: flex; gap: var(--spacing-xs);">
            <button class="btn btn-ghost btn-sm" disabled>Previous</button>
            <button class="btn btn-secondary btn-sm">1</button>
            <button class="btn btn-ghost btn-sm">2</button>
            <button class="btn btn-ghost btn-sm">3</button>
            <button class="btn btn-ghost btn-sm">...</button>
            <button class="btn btn-ghost btn-sm">10</button>
            <button class="btn btn-ghost btn-sm">Next</button>
          </div>
        </div>
      </div>

      <!-- Contractor Performance -->
      <div class="grid-2">
        <!-- Contractor Rankings -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Contractor Performance Rankings</div>
              <div class="card-subtitle">Based on project delivery, quality, and safety</div>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div
              style="display: flex; align-items: center; padding: var(--spacing-md); background: rgba(16, 185, 129, 0.1); border-left: 4px solid var(--success);">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--success); width: 40px;">#1</div>
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 600;">Strabag International</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Score: 92/100 | 3 active projects</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-emerald">Excellent</span>
              </div>
            </div>

            <div
              style="display: flex; align-items: center; padding: var(--spacing-md); background: rgba(16, 185, 129, 0.05); border-left: 4px solid var(--success);">
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--success); width: 40px;">#2</div>
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 600;">China Wu Yi Ltd</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Score: 88/100 | 2 active projects</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-emerald">Excellent</span>
              </div>
            </div>

            <div
              style="display: flex; align-items: center; padding: var(--spacing-md); border-left: 4px solid var(--accent-blue);">
              <div style="font-size: 1.125rem; font-weight: 700; color: var(--accent-blue); width: 40px;">#3</div>
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 600;">M-Gas Technologies</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Score: 85/100 | 4 active projects</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-blue">Good</span>
              </div>
            </div>

            <div
              style="display: flex; align-items: center; padding: var(--spacing-md); border-left: 4px solid var(--accent-blue);">
              <div style="font-size: 1rem; font-weight: 700; color: var(--accent-blue); width: 40px;">#4</div>
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 600;">China Communications Construction</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Score: 78/100 | 1 active project</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-blue">Good</span>
              </div>
            </div>

            <div
              style="display: flex; align-items: center; padding: var(--spacing-md); border-left: 4px solid var(--warning);">
              <div style="font-size: 0.875rem; font-weight: 700; color: var(--warning); width: 40px;">#5</div>
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 600;">Huawei Technologies Kenya</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Score: 65/100 | 1 active project</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-amber">Needs Improvement</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Budget Execution -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Budget Execution Overview</div>
              <div class="card-subtitle">Annual infrastructure budget utilization</div>
            </div>
          </div>
          <div class="card-body">
            <div style="margin-bottom: var(--spacing-xl);">
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 0.875rem; font-weight: 500;">Total Budget Allocation</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--accent-blue);">KES 5.8B</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar" style="width: 100%;"></div>
              </div>
            </div>

            <div style="margin-bottom: var(--spacing-xl);">
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 0.875rem; font-weight: 500;">Total Expenditure</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--accent-emerald);">KES 3.2B</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar success" style="width: 55%;"></div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--spacing-xs);">55% utilized
              </div>
            </div>

            <div style="margin-bottom: var(--spacing-xl);">
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 0.875rem; font-weight: 500;">Committed (Contracts Awarded)</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--accent-amber);">KES 1.8B</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar warning" style="width: 31%;"></div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--spacing-xs);">31% committed
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                <span style="font-size: 0.875rem; font-weight: 500;">Remaining Balance</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary);">KES 800M</span>
              </div>
              <div class="progress" style="height: 12px;">
                <div class="progress-bar" style="width: 14%; background: var(--secondary-bg);"></div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--spacing-xs);">14% available
              </div>
            </div>

            <div
              style="margin-top: var(--spacing-xl); padding-top: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Budget by
                Source</div>
              <div style="display: flex; gap: var(--spacing-lg);">
                <div
                  style="flex: 1; text-align: center; padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md);">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">National Government</div>
                  <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-blue);">65%</div>
                </div>
                <div
                  style="flex: 1; text-align: center; padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md);">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">World Bank Loan</div>
                  <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-emerald);">25%</div>
                </div>
                <div
                  style="flex: 1; text-align: center; padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md);">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">County Gov't</div>
                  <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-amber);">10%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Project Tracking')
</script>
