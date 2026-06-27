<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m07-intermodal.html
    h1: Intermodal Operations Dashboard
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">
 <!-- Page Header -->
 <div class="page-header">
 <div>
 <h1 class="page-title">Intermodal Operations Dashboard</h1>
 <p class="page-subtitle">Multi-modal transport integration and cargo flow monitoring</p>
 </div>
 <div style="display: flex; gap: var(--spacing-sm);">
 <select class="select" style="width: 150px;">
 <option>Today</option>
 <option selected>Yesterday</option>
 <option>Last 7 Days</option>
 <option>Last 30 Days</option>
 </select>
 <button class="btn btn-primary">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
 <polyline points="7 10 12 15 17 10"/>
 <line x1="12" y1="15" x2="12" y2="3"/>
 </svg>
 Export Report
 </button>
 </div>
 </div>

 <!-- Mode Tabs -->
 <div class="card" style="margin-bottom: var(--spacing-xl);">
 <div class="card-body" style="padding: 0;">
 <div style="display: flex; border-bottom: 1px solid var(--border-color);">
 <button class="tab-btn active" style="padding: var(--spacing-md) var(--spacing-xl); border-bottom: 2px solid var(--accent-blue); color: var(--accent-blue); font-weight: 600;">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
 <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z"/>
 </svg>
 Aviation (248 flights)
 </button>
 <button class="tab-btn" style="padding: var(--spacing-md) var(--spacing-xl); color: var(--text-secondary);">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
 <path d="M18 8c0-3.314-2.686-6-6-6S6 4.686 6 8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4z"/>
 <path d="M12 12v10"/>
 <path d="M8 22h8"/>
 </svg>
 Maritime (42 vessels)
 </button>
 <button class="tab-btn" style="padding: var(--spacing-md) var(--spacing-xl); color: var(--text-secondary);">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
 <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
 <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
 </svg>
 Railway (186 trains)
 </button>
 </div>
 </div>
 </div>

 <!-- Stats Overview -->
 <div class="stats-grid">
 <div class="stat-card">
 <div class="stat-card-icon blue">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z"/>
 </svg>
 </div>
 <div class="stat-card-value">42,580</div>
 <div class="stat-card-label">Passengers Handled</div>
 <div class="stat-card-trend up">
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <polyline points="18 15 12 9 6 15"/>
 </svg>
 +12.5% from yesterday
 </div>
 </div>
 <div class="stat-card">
 <div class="stat-card-icon emerald">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
 <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
 <line x1="12" y1="22.08" x2="12" y2="12"/>
 </svg>
 </div>
 <div class="stat-card-value">8,420</div>
 <div class="stat-card-label">TEUs Transferred</div>
 <div class="stat-card-trend up">
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <polyline points="18 15 12 9 6 15"/>
 </svg>
 +8.3% from yesterday
 </div>
 </div>
 <div class="stat-card">
 <div class="stat-card-icon amber">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="12 6 12 12 16 14"/>
 </svg>
 </div>
 <div class="stat-card-value">92.5%</div>
 <div class="stat-card-label">On-Time Rate</div>
 <div class="stat-card-trend up">
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <polyline points="18 15 12 9 6 15"/>
 </svg>
 +2.1% from last week
 </div>
 </div>
 <div class="stat-card">
 <div class="stat-card-icon red">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
 <line x1="12" y1="9" x2="12" y2="13"/>
 <line x1="12" y1="17" x2="12.01" y2="17"/>
 </svg>
 </div>
 <div class="stat-card-value">3</div>
 <div class="stat-card-label">Active Incidents</div>
 <div class="stat-card-trend down">
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <polyline points="6 9 12 15 18 9"/>
 </svg>
 -2 from yesterday
 </div>
 </div>
 </div>

 <!-- Modal Split & Flow -->
 <div class="grid-2" style="margin-bottom: var(--spacing-xl);">
 <!-- Freight Volume by Mode -->
 <div class="card">
 <div class="card-header">
 <div>
 <div class="card-title">Freight Volume by Mode</div>
 <div class="card-subtitle">Daily cargo tonnage distribution across transport modes</div>
 </div>
 </div>
 <div class="card-body">
 <div style="display: flex; gap: var(--spacing-xl); align-items: center;">
 <!-- Donut chart -->
 <div style="position: relative; width: 180px; height: 180px;">
 <svg width="180" height="180" viewBox="0 0 180 180">
 <!-- Road: 45% = 169 -->
 <circle cx="90" cy="90" r="70" fill="none" stroke="#3b82f6" stroke-width="35" stroke-dasharray="198 440" transform="rotate(-90 90 90)"/>
 <!-- Rail: 30% = 132 -->
 <circle cx="90" cy="90" r="70" fill="none" stroke="#8b5cf6" stroke-width="35" stroke-dasharray="132 440" stroke-dashoffset="-198" transform="rotate(-90 90 90)"/>
 <!-- Water: 25% = 110 -->
 <circle cx="90" cy="90" r="70" fill="none" stroke="#10b981" stroke-width="35" stroke-dasharray="110 440" stroke-dashoffset="-330" transform="rotate(-90 90 90)"/>
 </svg>
 <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
 <div style="font-size: 1.5rem; font-weight: 700;">12,450</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">tonnes</div>
 </div>
 </div>

 <!-- Legend -->
 <div style="flex: 1;">
 <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
 <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 2px;"></div>
 <div style="flex: 1;">
 <div style="font-size: 0.875rem; font-weight: 500;">Road Transport</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Mombasa-Nairobi Corridor</div>
 </div>
 <div style="text-align: right;">
 <div style="font-size: 0.875rem; font-weight: 600;">5,602 t</div>
 <div style="font-size: 0.625rem; color: var(--text-muted);">45%</div>
 </div>
 </div>
 <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
 <div style="width: 12px; height: 12px; background: #8b5cf6; border-radius: 2px;"></div>
 <div style="flex: 1;">
 <div style="font-size: 0.875rem; font-weight: 500;">Railway (SGR)</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Mombasa-Nairobi SGR</div>
 </div>
 <div style="text-align: right;">
 <div style="font-size: 0.875rem; font-weight: 600;">3,735 t</div>
 <div style="font-size: 0.625rem; color: var(--text-muted);">30%</div>
 </div>
 </div>
 <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) 0;">
 <div style="width: 12px; height: 12px; background: #10b981; border-radius: 2px;"></div>
 <div style="flex: 1;">
 <div style="font-size: 0.875rem; font-weight: 500;">Maritime</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Mombasa Port to ICD Nairobi</div>
 </div>
 <div style="text-align: right;">
 <div style="font-size: 0.875rem; font-weight: 600;">3,113 t</div>
 <div style="font-size: 0.625rem; color: var(--text-muted);">25%</div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>

 <!-- Connection Efficiency -->
 <div class="card">
 <div class="card-header">
 <div>
 <div class="card-title">Connection Efficiency</div>
 <div class="card-subtitle">Average transfer times between modes</div>
 </div>
 </div>
 <div class="card-body">
 <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">
 <div style="padding: var(--spacing-lg); background: var(--secondary-bg); border-radius: var(--radius-lg); text-align: center;">
 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" style="margin-bottom: var(--spacing-sm);">
 <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z"/>
 </svg>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Port to ICD (Maritime-Rail)</div>
 <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-emerald);">4.5 hrs</div>
 <div style="font-size: 0.75rem; color: var(--success);">On Target</div>
 </div>

 <div style="padding: var(--spacing-lg); background: var(--secondary-bg); border-radius: var(--radius-lg); text-align: center;">
 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2" style="margin-bottom: var(--spacing-sm);">
 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
 <circle cx="12" cy="10" r="3"/>
 </svg>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">JKIA to ICD (Air-Road)</div>
 <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-emerald);">2.0 hrs</div>
 <div style="font-size: 0.75rem; color: var(--success);">On Target</div>
 </div>

 <div style="padding: var(--spacing-lg); background: var(--secondary-bg); border-radius: var(--radius-lg); text-align: center;">
 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" stroke-width="2" style="margin-bottom: var(--spacing-sm);">
 <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
 <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
 </svg>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">SGR to ICD (Rail-Road)</div>
 <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-emerald);">1.5 hrs</div>
 <div style="font-size: 0.75rem; color: var(--success);">On Target</div>
 </div>

 <div style="padding: var(--spacing-lg); background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); border-radius: var(--radius-lg); text-align: center;">
 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="margin-bottom: var(--spacing-sm);">
 <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l4.8 3.2-2.8 2.8L4 14v5h5l2.6-2.6 2.8 2.8 3.2-4.8c.2-.4.7-.5 1.1-.3l.5.3c.4.2.6.6.5 1.1z"/>
 </svg>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Airport to Station</div>
 <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">45 min</div>
 <div style="font-size: 0.75rem; color: var(--warning);">Needs Improvement</div>
 </div>
 </div>
 </div>
 </div>
 </div>

 <!-- Cargo Tracking -->
 <div class="card">
 <div class="card-header">
 <div>
 <div class="card-title">Container Tracking Timeline</div>
 <div class="card-subtitle">Real-time cargo movement through intermodal corridor</div>
 </div>
 <div class="input-group" style="margin: 0;">
 <input type="text" class="input" placeholder="Container number..." style="width: 200px;">
 <button class="btn btn-secondary">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 <circle cx="11" cy="11" r="8"/>
 <line x1="21" y1="21" x2="16.65" y2="16.65"/>
 </svg>
 </button>
 </div>
 </div>
 <div class="card-body">
 <div style="display: flex; align-items: center; gap: var(--spacing-xl); margin-bottom: var(--spacing-xl);">
 <!-- Timeline visualization -->
 <div style="flex: 1; display: flex; align-items: center; justify-content: space-between;">
 <div style="text-align: center;">
 <div style="width: 60px; height: 60px; background: rgba(16, 185, 129, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-sm);">
 <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
 <path d="M18 8c0-3.314-2.686-6-6-6S6 4.686 6 8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4z"/>
 <path d="M12 12v10"/>
 <path d="M8 22h8"/>
 </svg>
 </div>
 <div style="font-size: 0.875rem; font-weight: 600;">Mombasa Port</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Arrived Apr 8, 06:00</div>
 </div>

 <div style="flex: 1; position: relative; height: 4px; background: var(--success); border-radius: 2px;">
 <div style="position: absolute; right: -6px; top: -8px; width: 20px; height: 20px; background: var(--success); border-radius: 50%;"></div>
 </div>

 <div style="text-align: center;">
 <div style="width: 60px; height: 60px; background: rgba(139, 92, 246, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-sm);">
 <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
 <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
 <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
 </svg>
 </div>
 <div style="font-size: 0.875rem; font-weight: 600;">SGR Loading</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Apr 8, 08:30</div>
 </div>

 <div style="flex: 1; position: relative; height: 4px; background: linear-gradient(90deg, var(--success) 60%, var(--accent-amber) 60%); border-radius: 2px;">
 <div style="position: absolute; right: -6px; top: -8px; width: 20px; height: 20px; background: var(--accent-amber); border-radius: 50%;"></div>
 </div>

 <div style="text-align: center;">
 <div style="width: 60px; height: 60px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-sm);">
 <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
 <rect x="1" y="3" width="15" height="13"/>
 <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
 <circle cx="5.5" cy="18.5" r="2.5"/>
 <circle cx="18.5" cy="18.5" r="2.5"/>
 </svg>
 </div>
 <div style="font-size: 0.875rem; font-weight: 600;">ICD Nairobi</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">In Transit (ETA 14:30)</div>
 </div>

 <div style="flex: 1; position: relative; height: 4px; background: var(--secondary-bg); border-radius: 2px;">
 <div style="position: absolute; right: -6px; top: -8px; width: 20px; height: 20px; background: var(--secondary-bg); border: 2px solid var(--border-color); border-radius: 50%;"></div>
 </div>

 <div style="text-align: center; opacity: 0.5;">
 <div style="width: 60px; height: 60px; background: var(--secondary-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--spacing-sm);">
 <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
 <circle cx="12" cy="7" r="4"/>
 </svg>
 </div>
 <div style="font-size: 0.875rem; font-weight: 600;">Consignee</div>
 <div style="font-size: 0.75rem; color: var(--text-muted);">Pending</div>
 </div>
 </div>
 </div>

 <!-- Cargo Details -->
 <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-lg); padding-top: var(--spacing-lg); border-top: 1px solid var(--border-color);">
 <div>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Container Number</div>
 <div style="font-size: 1rem; font-weight: 600; font-family: var(--font-mono);">MSCU 1234567</div>
 </div>
 <div>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Contents</div>
 <div style="font-size: 1rem; font-weight: 600;">Electronics & Machinery</div>
 </div>
 <div>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Weight</div>
 <div style="font-size: 1rem; font-weight: 600;">18.5 tonnes</div>
 </div>
 <div>
 <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Transit Status</div>
 <span class="badge badge-amber">In Transit</span>
 </div>
 </div>
 </div>
 </div>
 </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Intermodal Hub')
</script>
