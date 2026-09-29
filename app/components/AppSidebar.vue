<template>
  <!--
    Sidebar - fixed left, white background, grouped collapsible nav.
    Mapped to 13 UAPTS core modules, derived from confirmed API paths in UAPTS_API v1.0.0.
    Uses native <details> for groups (theme.css styles them as collapsible).
  -->
  <div class="sidebar-backdrop" :class="{ active: sidebarOpen }" @click="sidebarOpen = false" />
  <aside class="sidebar" :class="{ 'mobile-open': sidebarOpen }" id="app-sidebar">
    <div class="sidebar-section">

      <!-- M01 · Command Centre - /api/v1/dashboard/summary/ -->
      <NuxtLink v-if="canSee('/dashboard')" class="sidebar-group-title sidebar-link sidebar-link-top" to="/dashboard" :class="{ active: isActive('/dashboard') }">
        Command Centre
      </NuxtLink>

      <!-- M02 · Road Traffic Management - /api/v1/traffic/* -->
      <details v-if="canSeeModule('M02')" class="sidebar-group" :open="groupIsOpen('/traffic')">
        <summary class="sidebar-group-title">
          Road Traffic Management<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/traffic')" class="sidebar-link" to="/traffic" :class="{ active: isActive('/traffic') }">Live Traffic Map</NuxtLink>
          <NuxtLink v-if="canSee('/traffic/analytics')" class="sidebar-link" to="/traffic/analytics" :class="{ active: isActive('/traffic/analytics') }">Traffic Analytics</NuxtLink>
          <NuxtLink v-if="canSee('/traffic/alerts')" class="sidebar-link" to="/traffic/alerts" :class="{ active: isActive('/traffic/alerts') }">Traffic Alerts</NuxtLink>
        </div>
      </details>

      <!-- M03 · Fleet & Vehicle Tracking - /api/v1/fleet/* -->
      <details v-if="canSeeModule('M03')" class="sidebar-group" :open="groupIsOpen('/fleet')">
        <summary class="sidebar-group-title">
          Fleet & Vehicle Tracking<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/fleet')" class="sidebar-link" to="/fleet" :class="{ active: isActive('/fleet') }">Fleet Overview</NuxtLink>
          <NuxtLink v-if="canSee('/fleet/behaviour')" class="sidebar-link" to="/fleet/behaviour" :class="{ active: isActive('/fleet/behaviour') }">Driver Behaviour</NuxtLink>
          <NuxtLink v-if="canSee('/fleet/live')" class="sidebar-link" to="/fleet/live" :class="{ active: isActive('/fleet/live') }">Live Positions</NuxtLink>
          <NuxtLink v-if="canSee('/fleet/geofences')" class="sidebar-link" to="/fleet/geofences" :class="{ active: isActive('/fleet/geofences') }">Geofences</NuxtLink>
          <NuxtLink v-if="canSee('/fleet/trip-playbacks')" class="sidebar-link" to="/fleet/trip-playbacks" :class="{ active: isActive('/fleet/trip-playbacks') }">Trip Playback</NuxtLink>
        </div>
      </details>

      <!-- M04 · Public Transport Operations - /api/v1/public-transport/* -->
      <details v-if="canSeeModule('M04')" class="sidebar-group" :open="groupIsOpen('/public-transport')">
        <summary class="sidebar-group-title">
          Public Transport<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/public-transport')" class="sidebar-link" to="/public-transport" :class="{ active: isActive('/public-transport') }">Operations Overview</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/compliance')" class="sidebar-link" to="/public-transport/compliance" :class="{ active: isActive('/public-transport/compliance') }">PSV Compliance</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/brt')" class="sidebar-link" to="/public-transport/brt" :class="{ active: isActive('/public-transport/brt') }">BRT Stops & Headway</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/operators')" class="sidebar-link" to="/public-transport/operators" :class="{ active: isActive('/public-transport/operators') }">Public Operators</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/vehicle-registration')" class="sidebar-link" to="/public-transport/vehicle-registration" :class="{ active: isActive('/public-transport/vehicle-registration') }">Vehicle Registration</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/vehicle-inspections')" class="sidebar-link" to="/public-transport/vehicle-inspections" :class="{ active: isActive('/public-transport/vehicle-inspections') }">Vehicle Inspections</NuxtLink>
          <NuxtLink v-if="canSee('/public-transport/driver-licensing')" class="sidebar-link" to="/public-transport/driver-licensing" :class="{ active: isActive('/public-transport/driver-licensing') }">Driver Licensing</NuxtLink>
        </div>
      </details>

      <!-- M05 · Safety & Incident Management - /api/v1/safety/* -->
      <details v-if="canSeeModule('M05')" class="sidebar-group" :open="groupIsOpen('/safety')">
        <summary class="sidebar-group-title">
          Safety & Incidents<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/safety')" class="sidebar-link" to="/safety" :class="{ active: isActive('/safety') }">Safety Overview</NuxtLink>
          <NuxtLink v-if="canSee('/safety/incidents')" class="sidebar-link" to="/safety/incidents" :class="{ active: isActive('/safety/incidents') }">Incident Command</NuxtLink>
          <NuxtLink v-if="canSee('/safety/blackspots')" class="sidebar-link" to="/safety/blackspots" :class="{ active: isActive('/safety/blackspots') }">Blackspot Analysis</NuxtLink>
          <NuxtLink v-if="canSee('/safety/kpis')" class="sidebar-link" to="/safety/kpis" :class="{ active: isActive('/safety/kpis') }">Safety KPIs</NuxtLink>
        </div>
      </details>

      <!-- M06 · Road Infrastructure - /api/v1/infrastructure/* -->
      <details v-if="canSeeModule('M06')" class="sidebar-group" :open="groupIsOpen('/infrastructure')">
        <summary class="sidebar-group-title">
          Road Infrastructure<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/infrastructure')" class="sidebar-link" to="/infrastructure" :class="{ active: isActive('/infrastructure') }">Road Network Inventory</NuxtLink>
          <NuxtLink v-if="canSee('/infrastructure/projects')" class="sidebar-link" to="/infrastructure/projects" :class="{ active: isActive('/infrastructure/projects') }">Road Infrastructure Status</NuxtLink>
          <NuxtLink v-if="canSee('/infrastructure/bridges')" class="sidebar-link" to="/infrastructure/bridges" :class="{ active: isActive('/infrastructure/bridges') }">Bridges & Assets</NuxtLink>
          <NuxtLink v-if="canSee('/infrastructure/funding')" class="sidebar-link" to="/infrastructure/funding" :class="{ active: isActive('/infrastructure/funding') }">Funding Allocations</NuxtLink>
        </div>
      </details>

      <!-- M07a · Aviation - /api/v1/aviation-maritime/aviation/* -->
      <details v-if="canSeeModule('M07a')" class="sidebar-group" :open="groupIsOpen('/aviation')">
        <summary class="sidebar-group-title">
          Aviation<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/aviation')" class="sidebar-link" to="/aviation" :class="{ active: isActive('/aviation') }">Flight Movements</NuxtLink>
          <NuxtLink v-if="canSee('/aviation/flights')" class="sidebar-link" to="/aviation/flights" :class="{ active: isActive('/aviation/flights') }">Flight Log</NuxtLink>
          <NuxtLink v-if="canSee('/aviation/passenger-stats')" class="sidebar-link" to="/aviation/passenger-stats" :class="{ active: isActive('/aviation/passenger-stats') }">Passenger Stats</NuxtLink>
          <NuxtLink v-if="canSee('/aviation/licensing')" class="sidebar-link" to="/aviation/licensing" :class="{ active: isActive('/aviation/licensing') }">Aircraft Licencing</NuxtLink>
          <NuxtLink v-if="canSee('/aviation/infrastructure')" class="sidebar-link" to="/aviation/infrastructure" :class="{ active: isActive('/aviation/infrastructure') }">Aviation Infrastructure</NuxtLink>
        </div>
      </details>

      <!-- M07b · Maritime - /api/v1/aviation-maritime/maritime/* -->
      <details v-if="canSeeModule('M07b')" class="sidebar-group" :open="groupIsOpen('/maritime')">
        <summary class="sidebar-group-title">
          Maritime<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/maritime')" class="sidebar-link" to="/maritime" :class="{ active: isActive('/maritime') }">Vessel Movements</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/vessels')" class="sidebar-link" to="/maritime/vessels" :class="{ active: isActive('/maritime/vessels') }">Vessel Registry</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/port-ops')" class="sidebar-link" to="/maritime/port-ops" :class="{ active: isActive('/maritime/port-ops') }">Port Operations</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/services')" class="sidebar-link" to="/maritime/services" :class="{ active: isActive('/maritime/services') }">Port Services</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/cargo')" class="sidebar-link" to="/maritime/cargo" :class="{ active: isActive('/maritime/cargo') }">Cargo Tracking</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/imports-exports')" class="sidebar-link" to="/maritime/imports-exports" :class="{ active: isActive('/maritime/imports-exports') }">Imports and Exports</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/waterways')" class="sidebar-link" to="/maritime/waterways" :class="{ active: isActive('/maritime/waterways') }">Waterways</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/infrastructure')" class="sidebar-link" to="/maritime/infrastructure" :class="{ active: isActive('/maritime/infrastructure') }">Maritime Infrastructure</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/accidents')" class="sidebar-link" to="/maritime/accidents" :class="{ active: isActive('/maritime/accidents') }">Accidents & Safety</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/green-transport')" class="sidebar-link" to="/maritime/green-transport" :class="{ active: isActive('/maritime/green-transport') }">Green Transport</NuxtLink>
          <NuxtLink v-if="canSee('/maritime/performance')" class="sidebar-link" to="/maritime/performance" :class="{ active: isActive('/maritime/performance') }">Performance & Ranking</NuxtLink>
        </div>
      </details>

      <!-- M08 · Railway Management - /api/v1/railway/* -->
      <details v-if="canSeeModule('M08')" class="sidebar-group" :open="groupIsOpen('/railway')">
        <summary class="sidebar-group-title">
          Railway<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/railway')" class="sidebar-link" to="/railway" :class="{ active: isActive('/railway') }">Railway Overview</NuxtLink>
          <NuxtLink v-if="canSee('/railway/live')" class="sidebar-link" to="/railway/live" :class="{ active: isActive('/railway/live') }">Train Operations</NuxtLink>
          <NuxtLink v-if="canSee('/railway/freight')" class="sidebar-link" to="/railway/freight" :class="{ active: isActive('/railway/freight') }">Freight Volumes</NuxtLink>
          <NuxtLink v-if="canSee('/railway/schedules')" class="sidebar-link" to="/railway/schedules" :class="{ active: isActive('/railway/schedules') }">Schedules</NuxtLink>
          <NuxtLink v-if="canSee('/railway/infrastructure')" class="sidebar-link" to="/railway/infrastructure" :class="{ active: isActive('/railway/infrastructure') }">Rail Infrastructure</NuxtLink>
          <NuxtLink v-if="canSee('/railway/network-inventory')" class="sidebar-link" to="/railway/network-inventory" :class="{ active: isActive('/railway/network-inventory') }">Rail Network Inventory</NuxtLink>
          <NuxtLink v-if="canSee('/railway/safety')" class="sidebar-link" to="/railway/safety" :class="{ active: isActive('/railway/safety') }">Rail Safety</NuxtLink>
        </div>
      </details>

      <!-- M09 · Analytics & Reporting (AI/ML) - /api/v1/reports/*, /api/v1/query/* -->
      <details v-if="canSeeModule('M09')" class="sidebar-group" :open="groupIsOpen(['/analytics', '/reports', '/query-builder'])">
        <summary class="sidebar-group-title">
          Analytics & Reporting<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/analytics')" class="sidebar-link" to="/analytics" :class="{ active: isActive('/analytics') }">AI Predictive Workbench</NuxtLink>
          <NuxtLink v-if="canSee('/query-builder')" class="sidebar-link" to="/query-builder" :class="{ active: isActive('/query-builder') }">Query Builder</NuxtLink>
          <NuxtLink v-if="canSee('/reports')" class="sidebar-link" to="/reports" :class="{ active: isActive('/reports') }">Report Center</NuxtLink>
        </div>
      </details>

      <!-- M12 · Data Integration Hub - /api/v1/integrations/* -->
      <details v-if="canSeeModule('M12')" class="sidebar-group" :open="groupIsOpen('/integrations')">
        <summary class="sidebar-group-title">
          Integration Hub<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/integrations')" class="sidebar-link" to="/integrations" :class="{ active: isActive('/integrations') }">Upload & Connect</NuxtLink>
          <NuxtLink v-if="canSee('/integrations/files')" class="sidebar-link" to="/integrations/files" :class="{ active: isActive('/integrations/files', false) }">Files & Feeds</NuxtLink>
          <NuxtLink v-if="canSee('/integrations/analytics')" class="sidebar-link" to="/integrations/analytics" :class="{ active: isActive('/integrations/analytics', false) }">Ingestion Analytics</NuxtLink>
        </div>
      </details>

      <!-- M13 · GIS & Spatial Analysis - /api/v1/gis/*, /api/v1/geojson/* -->
      <NuxtLink v-if="canSee('/gis')" class="sidebar-group-title sidebar-link sidebar-link-top" to="/gis" :class="{ active: isActive('/gis', false) }">
        GIS & Spatial Analysis
      </NuxtLink>

      <!-- M14 · Training Institutes - /api/v1/training/* -->
      <details v-if="canSeeModule('M14')" class="sidebar-group" :open="groupIsOpen('/training')">
        <summary class="sidebar-group-title">
          Training Institutes<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/training')" class="sidebar-link" to="/training" :class="{ active: isActive('/training') }">Overview</NuxtLink>
          <NuxtLink v-if="canSee('/training/cohorts')" class="sidebar-link" to="/training/cohorts" :class="{ active: isActive('/training/cohorts') }">Cohorts</NuxtLink>
          <NuxtLink v-if="canSee('/training/enrollments')" class="sidebar-link" to="/training/enrollments" :class="{ active: isActive('/training/enrollments') }">Enrollments</NuxtLink>
          <NuxtLink v-if="canSee('/training/completions')" class="sidebar-link" to="/training/completions" :class="{ active: isActive('/training/completions') }">Certificates</NuxtLink>
        </div>
      </details>

      <!-- M11 · Notifications & Alerts - /api/v1/notifications/* -->
      <details v-if="canSeeModule('M11')" class="sidebar-group" :open="groupIsOpen('/notifications')">
        <summary class="sidebar-group-title">
          Notifications<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/notifications')" class="sidebar-link" to="/notifications" :class="{ active: isActive('/notifications') }">Notification Feed</NuxtLink>
          <NuxtLink v-if="canSee('/notifications/rules')" class="sidebar-link" to="/notifications/rules" :class="{ active: isActive('/notifications/rules') }">Alert Rules</NuxtLink>
        </div>
      </details>

      <!-- M10 · User Management & Access Control - /api/v1/accounts/* + audit -->
      <details v-if="canSeeModule('M10')" class="sidebar-group" :open="groupIsOpen(['/agencies', '/users', '/roles', '/access-policies', '/admin/dashboards', '/audit'])">
        <summary class="sidebar-group-title">
          Access Control<span class="sidebar-caret">▾</span>
        </summary>
        <div class="sidebar-group-items">
          <NuxtLink v-if="canSee('/agencies')" class="sidebar-link" to="/agencies" :class="{ active: isActive('/agencies') }">Agencies</NuxtLink>
          <NuxtLink v-if="canSee('/users')" class="sidebar-link" to="/users" :class="{ active: isActive('/users') }">User Management</NuxtLink>
          <NuxtLink v-if="canSee('/roles')" class="sidebar-link" to="/roles" :class="{ active: isActive('/roles') }">Roles & Permissions</NuxtLink>
          <NuxtLink v-if="canSee('/access-policies')" class="sidebar-link" to="/access-policies" :class="{ active: isActive('/access-policies') }">Module Access</NuxtLink>
          <NuxtLink v-if="canManageDashboardsAny" class="sidebar-link" to="/admin/dashboards" :class="{ active: isActive('/admin/dashboards', false) }">Dashboard Manager</NuxtLink>
          <NuxtLink v-if="canSee('/audit')" class="sidebar-link" to="/audit" :class="{ active: isActive('/audit') }">Audit Trail</NuxtLink>
        </div>
      </details>

    </div>
    <div class="sidebar-footer">
      <button class="sidebar-logout" :disabled="loggingOut" @click="handleLogout">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{{ loggingOut ? 'Signing out…' : 'Logout' }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
const route = useRoute()
const sidebarOpen = useState('sidebarOpen', () => false)

// Close drawer on navigation (mobile)
watch(() => route.path, () => {
  if (typeof window !== 'undefined' && window.innerWidth <= 900)
    sidebarOpen.value = false
})

function isActive(path: string, exact = true) {
  if (exact) return route.path === path
  return route.path === path || route.path.startsWith(path + '/')
}

function groupIsOpen(prefixes: string | string[]) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes]
  return list.some(p => isActive(p, false))
}

const auth = useAuth()

// RBAC spec section 8.1/8.3 gap #4 - navigation must only show destinations
// the resolved agency scope can actually open, wired through the same
// resolver route middleware uses (useAccessControl.ts) rather than a
// second, divergent set of checks.
const access = useAccessControl()
const canSee = access.canAccessRoute
const canSeeModule = access.canAccessModule
// Dashboard Manager: route access plus a manage permission (same rule as middleware/dashboard-manager.global.ts).
const { canManageDashboards, canManageAgencyDashboards } = useViewerContext()
const canManageDashboardsAny = computed(() =>
  canSee('/admin/dashboards') && (canManageDashboards.value || canManageAgencyDashboards.value))

const loggingOut = ref(false)
async function handleLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout()
  } finally {
    loggingOut.value = false
  }
}
</script>
