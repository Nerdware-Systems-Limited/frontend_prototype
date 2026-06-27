<template>
  <!--
    Sidebar - fixed left, white background, grouped collapsible nav.
    Mapped to 13 UAPTS core modules, derived from confirmed API paths in UAPTS_API v1.0.0.
    Uses native <details> for groups (theme.css styles them as collapsible).
  -->
  <aside class="sidebar" id="app-sidebar">
    <div class="sidebar-section">

      <!-- M01 · Dashboard & Visualization - /api/v1/dashboard/summary/ -->
      <NuxtLink class="sidebar-link sidebar-link-top" to="/dashboard" :class="{ active: isActive('/dashboard') }">
        Dashboard
      </NuxtLink>

      <!-- M02 · Traffic Management - /api/v1/traffic/* -->
      <details class="sidebar-group" :open="groupIsOpen('/traffic')">
        <summary class="sidebar-group-title">
          Traffic Management<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/traffic" :class="{ active: isActive('/traffic') }">Live Traffic Map</NuxtLink>
          <NuxtLink class="sidebar-link" to="/traffic/analytics" :class="{ active: isActive('/traffic/analytics') }">Traffic Analytics</NuxtLink>
          <NuxtLink class="sidebar-link" to="/traffic/alerts" :class="{ active: isActive('/traffic/alerts') }">Traffic Alerts</NuxtLink>
        </div>
      </details>

      <!-- M03 · Fleet & Vehicle Tracking - /api/v1/fleet/* -->
      <details class="sidebar-group" :open="groupIsOpen('/fleet')">
        <summary class="sidebar-group-title">
          Fleet & Vehicle Tracking<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/fleet" :class="{ active: isActive('/fleet') }">Fleet Overview</NuxtLink>
          <NuxtLink class="sidebar-link" to="/fleet/live" :class="{ active: isActive('/fleet/live') }">Live Positions</NuxtLink>
          <NuxtLink class="sidebar-link" to="/fleet/geofences" :class="{ active: isActive('/fleet/geofences') }">Geofences</NuxtLink>
          <NuxtLink class="sidebar-link" to="/fleet/trip-playbacks" :class="{ active: isActive('/fleet/trip-playbacks') }">Trip Playback</NuxtLink>
        </div>
      </details>

      <!-- M04 · Public Transport Operations - /api/v1/public-transport/* -->
      <details class="sidebar-group" :open="groupIsOpen('/public-transport')">
        <summary class="sidebar-group-title">
          Public Transport<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/public-transport" :class="{ active: isActive('/public-transport') }">Operations Overview</NuxtLink>
          <NuxtLink class="sidebar-link" to="/public-transport/compliance" :class="{ active: isActive('/public-transport/compliance') }">PSV Compliance</NuxtLink>
          <NuxtLink class="sidebar-link" to="/public-transport/brt" :class="{ active: isActive('/public-transport/brt') }">BRT Stops & Headway</NuxtLink>
          <NuxtLink class="sidebar-link" to="/public-transport/operators" :class="{ active: isActive('/public-transport/operators') }">Operator Metrics</NuxtLink>
        </div>
      </details>

      <!-- M05 · Safety & Incident Management - /api/v1/safety/* -->
      <details class="sidebar-group" :open="groupIsOpen('/safety')">
        <summary class="sidebar-group-title">
          Safety & Incidents<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/safety" :class="{ active: isActive('/safety') }">Safety Overview</NuxtLink>
          <NuxtLink class="sidebar-link" to="/safety/incidents" :class="{ active: isActive('/safety/incidents') }">Incident Command</NuxtLink>
          <NuxtLink class="sidebar-link" to="/safety/blackspots" :class="{ active: isActive('/safety/blackspots') }">Blackspot Analysis</NuxtLink>
          <NuxtLink class="sidebar-link" to="/safety/kpis" :class="{ active: isActive('/safety/kpis') }">Safety KPIs</NuxtLink>
        </div>
      </details>

      <!-- M06 · Infrastructure Monitoring - /api/v1/infrastructure/* -->
      <details class="sidebar-group" :open="groupIsOpen('/infrastructure')">
        <summary class="sidebar-group-title">
          Infrastructure<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/infrastructure" :class="{ active: isActive('/infrastructure') }">Asset Condition</NuxtLink>
          <NuxtLink class="sidebar-link" to="/infrastructure/projects" :class="{ active: isActive('/infrastructure/projects') }">Construction Projects</NuxtLink>
          <NuxtLink class="sidebar-link" to="/infrastructure/maintenance" :class="{ active: isActive('/infrastructure/maintenance') }">Maintenance Orders</NuxtLink>
          <NuxtLink class="sidebar-link" to="/infrastructure/bridges" :class="{ active: isActive('/infrastructure/bridges') }">Bridges</NuxtLink>
        </div>
      </details>

      <!-- M07 · Aviation & Maritime Data - /api/v1/aviation-maritime/* -->
      <details class="sidebar-group" :open="groupIsOpen(['/aviation', '/maritime'])">
        <summary class="sidebar-group-title">
          Aviation & Maritime<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/aviation" :class="{ active: isActive('/aviation') }">Flight Movements</NuxtLink>
          <NuxtLink class="sidebar-link" to="/aviation/passenger-stats" :class="{ active: isActive('/aviation/passenger-stats') }">Passenger Stats</NuxtLink>
          <NuxtLink class="sidebar-link" to="/maritime" :class="{ active: isActive('/maritime') }">Vessel Movements</NuxtLink>
          <NuxtLink class="sidebar-link" to="/maritime/port-ops" :class="{ active: isActive('/maritime/port-ops') }">Port Operations</NuxtLink>
        </div>
      </details>

      <!-- M08 · Railway Management - /api/v1/railway/* -->
      <details class="sidebar-group" :open="groupIsOpen('/railway')">
        <summary class="sidebar-group-title">
          Railway<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/railway" :class="{ active: isActive('/railway') }">Railway Overview</NuxtLink>
          <NuxtLink class="sidebar-link" to="/railway/live" :class="{ active: isActive('/railway/live') }">Live Operations</NuxtLink>
          <NuxtLink class="sidebar-link" to="/railway/freight" :class="{ active: isActive('/railway/freight') }">Freight Volumes</NuxtLink>
          <NuxtLink class="sidebar-link" to="/railway/schedules" :class="{ active: isActive('/railway/schedules') }">Schedules</NuxtLink>
        </div>
      </details>

      <!-- M09 · Analytics & Reporting (AI/ML) - /api/v1/reports/*, /api/v1/query/* -->
      <details class="sidebar-group" :open="groupIsOpen(['/analytics', '/reports', '/query-builder'])">
        <summary class="sidebar-group-title">
          Analytics & Reporting<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/analytics" :class="{ active: isActive('/analytics') }">AI Predictive Workbench</NuxtLink>
          <NuxtLink class="sidebar-link" to="/query-builder" :class="{ active: isActive('/query-builder') }">Query Builder</NuxtLink>
          <NuxtLink class="sidebar-link" to="/reports" :class="{ active: isActive('/reports') }">Report Center</NuxtLink>
        </div>
      </details>

      <!-- M10 · User Management & Access Control - /api/v1/accounts/* + audit -->
      <details class="sidebar-group" :open="groupIsOpen(['/users', '/roles', '/audit'])">
        <summary class="sidebar-group-title">
          Access Control<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/users" :class="{ active: isActive('/users') }">User Management</NuxtLink>
          <NuxtLink class="sidebar-link" to="/roles" :class="{ active: isActive('/roles') }">Roles & Permissions</NuxtLink>
          <NuxtLink class="sidebar-link" to="/audit" :class="{ active: isActive('/audit') }">Audit Trail</NuxtLink>
        </div>
      </details>

      <!-- M11 · Notifications & Alerts - /api/v1/notifications/* -->
      <details class="sidebar-group" :open="groupIsOpen('/notifications')">
        <summary class="sidebar-group-title">
          Notifications<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink class="sidebar-link" to="/notifications" :class="{ active: isActive('/notifications') }">Notification Feed</NuxtLink>
          <NuxtLink class="sidebar-link" to="/notifications/rules" :class="{ active: isActive('/notifications/rules') }">Alert Rules</NuxtLink>
        </div>
      </details>

      <!-- M12 · Data Integration Hub - /api/v1/integrations/* -->
      <NuxtLink class="sidebar-link sidebar-link-top" to="/integrations" :class="{ active: isActive('/integrations') }">
        Integration Hub
      </NuxtLink>

      <!-- M13 · GIS & Spatial Analysis - /api/v1/gis/*, /api/v1/geojson/* -->
      <NuxtLink class="sidebar-link sidebar-link-top" to="/gis" :class="{ active: isActive('/gis') }">
        GIS & Spatial Analysis
      </NuxtLink>

    </div>
  </aside>
</template>

<script setup lang="ts">
const route = useRoute()

function isActive(prefix: string) {
  return route.path === prefix || route.path.startsWith(prefix + '/')
}

function groupIsOpen(prefixes: string | string[]) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes]
  return list.some(p => isActive(p))
}

const auth = useAuth()
const ADMIN_ROLES = ['super_admin', 'admin', 'superuser']
const canManageUsers = computed(() => {
  const role = auth.user.value?.role
  return role ? ADMIN_ROLES.includes(role) : false
})
</script>