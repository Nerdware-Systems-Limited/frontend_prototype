<template>
  <!--
    Top nav - institutional-blue gradient bar with gold underline.
    Brand + per-page subtitle on the left; global search, security, live
    indicator, clock, theme toggle, notifications and profile on the right.
  -->
  <nav class="top-nav">
    <div class="top-nav-left">
      <button class="hamburger-btn" aria-label="Toggle navigation" @click="toggleSidebar">☰</button>
      <div class="top-nav-brand">
        <div class="top-nav-logo">
          <NuxtLink to="/"><img src="/uapts-logo.png" alt="UAPTS" /></NuxtLink>
        </div>
        <div class="top-nav-text">
          <div class="top-nav-title">UAPTS</div>
          <div class="top-nav-subtitle">{{ subtitle }}</div>
        </div>
      </div>
    </div>

    <div class="top-nav-actions">
      <button
        type="button"
        class="topnav-search"
        aria-label="Open global search"
        @click="openGlobalSearch"
      >
        <Search :size="15" aria-hidden="true" />
        <span class="topnav-search-copy">Search the platform</span>
        <kbd class="topnav-search-key">Ctrl K</kbd>
      </button>

      <div class="sec-badge" title="MFA active · Session secure">
        <span class="sec-dot"></span>Secure
      </div>
      <div
        class="live-indicator"
        :class="{ 'is-offline': !liveConnected }"
        :title="liveConnected ? 'Real-time feed connected' : 'Real-time feed disconnected'"
      >
        {{ liveConnected ? 'Live' : 'Offline' }}
      </div>
      <div class="nav-time" id="navClock">{{ clock }}</div>

      <button
        type="button"
        class="theme-toggle"
        :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="theme.toggle()"
      >
        <svg v-if="isDark" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>

      <button
        class="bell-btn" :class="{ 'is-shaking': isShaking }"
        :aria-label="`Notifications${alertCount ? `, ${alertCount} unread` : ''}`"
        @click="goNotifications"
      >
        <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span v-if="alertCount" class="badge">{{ alertCount }}</span>
      </button>

      <NuxtLink to="/profile" class="avatar" :title="user?.full_name ?? 'Profile'">
        {{ userInitials }}
      </NuxtLink>
    </div>
  </nav>

  <Teleport to="body">
    <Transition name="command">
      <div v-if="searchOpen" class="command-backdrop" role="presentation" @click.self="closeGlobalSearch">
        <section class="command-panel" role="dialog" aria-modal="true" aria-labelledby="command-title">
          <header class="command-head">
            <Search :size="17" aria-hidden="true" />
            <input
              ref="searchInputEl"
              v-model="globalSearch"
              type="search"
              placeholder="Search modules, pages and workspace tools"
              autocomplete="off"
              @keydown.down.prevent="moveSearchSelection(1)"
              @keydown.up.prevent="moveSearchSelection(-1)"
              @keydown.enter.prevent="openSelectedSearchResult"
            />
            <kbd>Esc</kbd>
          </header>
          <div class="command-meta">
            <span>{{ filteredSearchItems.length }} result{{ filteredSearchItems.length === 1 ? '' : 's' }}</span>
            <span>Use &uarr; &darr; to navigate &middot; Enter to open</span>
          </div>
          <nav class="command-results" aria-label="Global search results">
            <button
              v-for="(item, index) in filteredSearchItems"
              :key="item.to"
              type="button"
              class="command-result"
              :class="{ active: index === searchSelection }"
              @mouseenter="searchSelection = index"
              @click="openSearchResult(item.to)"
            >
              <span class="command-result-icon"><component :is="item.icon" :size="15" /></span>
              <span class="command-result-copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.group }}</small>
              </span>
              <span class="command-result-path">{{ item.to }}</span>
            </button>
            <div v-if="!filteredSearchItems.length" class="command-empty">
              No matching pages. Try a module, workspace tool, or system area.
            </div>
          </nav>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * AppTopNav - fixed top navigation. Subtitle comes from
 * useState('navSubtitle'); each PageHeader sets it.
 */
import { useNotificationStore } from '~/stores/notifications'
import {
  Search, LayoutDashboard, TrafficCone, Truck, BusFront, ShieldAlert,
  Construction, Plane, Ship, TrainFront, BarChart3, Cable, MapPinned,
  GraduationCap, BellRing, Users,
} from 'lucide-vue-next'

const notificationStore = useNotificationStore()
const router = useRouter()

const sidebarOpen = useState('sidebarOpen', () => false)
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }

const theme = useTheme()
const isDark = theme.isDark

const subtitle = useState<string>('navSubtitle', () => 'Command Centre')

const auth = useAuth()
const user = computed(() => auth.user.value)

// RBAC spec section 8.1/8.3 gap #5 - the palette must not advertise a
// route the resolved agency scope can't open, wired through the same
// resolver as the sidebar (AppSidebar.vue) and route middleware
// (auth.global.ts) rather than a third, divergent check.
const access = useAccessControl()
const userInitials = computed(() => {
  const u = user.value
  if (!u) return 'JM'
  const name = u.full_name ?? u.email ?? ''
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'JM'
})

const alertCount = computed(() => notificationStore.unreadCount)
// Real-time feed state - the "Live" pill must reflect the actual socket, not
// assert a steady live state during an outage.
const liveConnected = computed(() => notificationStore.isConnected)

// Shake the bell when unread count rises.
const isShaking = ref(false)
let shakeTimer: ReturnType<typeof setTimeout> | null = null
watch(alertCount, async (next, prev) => {
  if (next <= prev) return
  isShaking.value = false
  await nextTick()
  isShaking.value = true
  if (shakeTimer) clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => { isShaking.value = false }, 650)
})
onUnmounted(() => { if (shakeTimer) clearTimeout(shakeTimer) })

// Live clock - updates every second
const clock = ref('--:--:--')
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const tick = () => {
    const iso = new Date().toISOString()
    clock.value = `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
  }
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// Live-notifications socket - connected once here for the whole default layout.
onMounted(() => { notificationStore.connect() })
onUnmounted(() => { notificationStore.disconnect() })

function goNotifications() { router.push('/notifications') }

// ─── Global search (Ctrl/Cmd+K command palette) ─────────────────────────
type SearchItem = { label: string; group: string; to: string; icon: any }

const searchItems: SearchItem[] = [
  { label: 'Command Centre', group: 'Overview', to: '/dashboard', icon: LayoutDashboard },

  { label: 'Live Traffic Map', group: 'Road Traffic Management', to: '/traffic', icon: TrafficCone },
  { label: 'Traffic Analytics', group: 'Road Traffic Management', to: '/traffic/analytics', icon: TrafficCone },
  { label: 'Traffic Alerts', group: 'Road Traffic Management', to: '/traffic/alerts', icon: TrafficCone },

  { label: 'Fleet Overview', group: 'Fleet & Vehicle Tracking', to: '/fleet', icon: Truck },
  { label: 'Driver Behaviour', group: 'Fleet & Vehicle Tracking', to: '/fleet/behaviour', icon: Truck },
  { label: 'Live Positions', group: 'Fleet & Vehicle Tracking', to: '/fleet/live', icon: Truck },
  { label: 'Geofences', group: 'Fleet & Vehicle Tracking', to: '/fleet/geofences', icon: Truck },
  { label: 'Trip Playback', group: 'Fleet & Vehicle Tracking', to: '/fleet/trip-playbacks', icon: Truck },

  { label: 'Operations Overview', group: 'Public Transport', to: '/public-transport', icon: BusFront },
  { label: 'PSV Compliance', group: 'Public Transport', to: '/public-transport/compliance', icon: BusFront },
  { label: 'BRT Stops & Headway', group: 'Public Transport', to: '/public-transport/brt', icon: BusFront },
  { label: 'Public Operators', group: 'Public Transport', to: '/public-transport/operators', icon: BusFront },
  { label: 'Vehicle Registration', group: 'Public Transport', to: '/public-transport/vehicle-registration', icon: BusFront },
  { label: 'Vehicle Inspections', group: 'Public Transport', to: '/public-transport/vehicle-inspections', icon: BusFront },
  { label: 'Driver Licensing', group: 'Public Transport', to: '/public-transport/driver-licensing', icon: BusFront },

  { label: 'Safety Overview', group: 'Safety & Incidents', to: '/safety', icon: ShieldAlert },
  { label: 'Incident Command', group: 'Safety & Incidents', to: '/safety/incidents', icon: ShieldAlert },
  { label: 'Blackspot Analysis', group: 'Safety & Incidents', to: '/safety/blackspots', icon: ShieldAlert },
  { label: 'Safety KPIs', group: 'Safety & Incidents', to: '/safety/kpis', icon: ShieldAlert },

  { label: 'Road Network Inventory', group: 'Road Infrastructure', to: '/infrastructure', icon: Construction },
  { label: 'Road Infrastructure Status', group: 'Road Infrastructure', to: '/infrastructure/projects', icon: Construction },
  { label: 'Bridges & Assets', group: 'Road Infrastructure', to: '/infrastructure/bridges', icon: Construction },
  { label: 'Funding Allocations', group: 'Road Infrastructure', to: '/infrastructure/funding', icon: Construction },

  { label: 'Flight Movements', group: 'Aviation', to: '/aviation', icon: Plane },
  { label: 'Flight Log', group: 'Aviation', to: '/aviation/flights', icon: Plane },
  { label: 'Passenger Stats', group: 'Aviation', to: '/aviation/passenger-stats', icon: Plane },
  { label: 'Aircraft Licencing', group: 'Aviation', to: '/aviation/licensing', icon: Plane },
  { label: 'Aviation Infrastructure', group: 'Aviation', to: '/aviation/infrastructure', icon: Plane },

  { label: 'Vessel Movements', group: 'Maritime', to: '/maritime', icon: Ship },
  { label: 'Vessel Registry', group: 'Maritime', to: '/maritime/vessels', icon: Ship },
  { label: 'Port Operations', group: 'Maritime', to: '/maritime/port-ops', icon: Ship },
  { label: 'Port Services', group: 'Maritime', to: '/maritime/services', icon: Ship },
  { label: 'Cargo Tracking', group: 'Maritime', to: '/maritime/cargo', icon: Ship },
  { label: 'Imports and Exports', group: 'Maritime', to: '/maritime/imports-exports', icon: Ship },
  { label: 'Waterways', group: 'Maritime', to: '/maritime/waterways', icon: Ship },
  { label: 'Maritime Infrastructure', group: 'Maritime', to: '/maritime/infrastructure', icon: Ship },
  { label: 'Accidents & Safety', group: 'Maritime', to: '/maritime/accidents', icon: Ship },
  { label: 'Green Transport', group: 'Maritime', to: '/maritime/green-transport', icon: Ship },
  { label: 'Performance & Ranking', group: 'Maritime', to: '/maritime/performance', icon: Ship },

  { label: 'Railway Overview', group: 'Railway', to: '/railway', icon: TrainFront },
  { label: 'Train Operations', group: 'Railway', to: '/railway/live', icon: TrainFront },
  { label: 'Freight Volumes', group: 'Railway', to: '/railway/freight', icon: TrainFront },
  { label: 'Schedules', group: 'Railway', to: '/railway/schedules', icon: TrainFront },
  { label: 'Rail Infrastructure', group: 'Railway', to: '/railway/infrastructure', icon: TrainFront },
  { label: 'Rail Network Inventory', group: 'Railway', to: '/railway/network-inventory', icon: TrainFront },
  { label: 'Rail Safety', group: 'Railway', to: '/railway/safety', icon: TrainFront },

  { label: 'AI Predictive Workbench', group: 'Analytics & Reporting', to: '/analytics', icon: BarChart3 },
  { label: 'Query Builder', group: 'Analytics & Reporting', to: '/query-builder', icon: BarChart3 },
  { label: 'Report Center', group: 'Analytics & Reporting', to: '/reports', icon: BarChart3 },

  { label: 'Upload & Connect', group: 'Overview', to: '/integrations', icon: Cable },
  { label: 'Files & Feeds', group: 'Overview', to: '/integrations/files', icon: Cable },
  { label: 'Ingestion Analytics', group: 'Overview', to: '/integrations/analytics', icon: Cable },
  { label: 'GIS & Spatial Analysis', group: 'Overview', to: '/gis', icon: MapPinned },

  { label: 'Training Overview', group: 'Training Institutes', to: '/training', icon: GraduationCap },
  { label: 'Cohorts', group: 'Training Institutes', to: '/training/cohorts', icon: GraduationCap },
  { label: 'Enrollments', group: 'Training Institutes', to: '/training/enrollments', icon: GraduationCap },
  { label: 'Certificates', group: 'Training Institutes', to: '/training/completions', icon: GraduationCap },

  { label: 'Notification Feed', group: 'Notifications', to: '/notifications', icon: BellRing },
  { label: 'Alert Rules', group: 'Notifications', to: '/notifications/rules', icon: BellRing },

  { label: 'Agencies', group: 'Access Control', to: '/agencies', icon: Users },
  { label: 'User Management', group: 'Access Control', to: '/users', icon: Users },
  { label: 'Roles & Permissions', group: 'Access Control', to: '/roles', icon: Users },
  { label: 'Module Access', group: 'Access Control', to: '/access-policies', icon: Users },
  { label: 'Dashboard Manager', group: 'Access Control', to: '/admin/dashboards', icon: Users },
  { label: 'Audit Trail', group: 'Access Control', to: '/audit', icon: Users },
]

const searchOpen = ref(false)
const globalSearch = ref('')
const searchSelection = ref(0)
const searchInputEl = ref<HTMLInputElement | null>(null)

// The Dashboard Manager also needs a manage permission, not just route access.
const { canManageDashboards, canManageAgencyDashboards } = useViewerContext()
const reachableSearchItems = computed(() => searchItems.filter(item =>
  access.canAccessRoute(item.to)
  && (item.to !== '/admin/dashboards' || canManageDashboards.value || canManageAgencyDashboards.value)))

const filteredSearchItems = computed(() => {
  const query = globalSearch.value.trim().toLowerCase()
  const source = query
    ? reachableSearchItems.value.filter(item => `${item.label} ${item.group} ${item.to}`.toLowerCase().includes(query))
    : reachableSearchItems.value
  return source.slice(0, 12)
})

watch(filteredSearchItems, () => { searchSelection.value = 0 })

// Prevent body scroll behind the command palette while it's open - same
// convention as AppModal.
watch(searchOpen, (open) => {
  if (import.meta.client) document.body.style.overflow = open ? 'hidden' : ''
})

async function openGlobalSearch() {
  globalSearch.value = ''
  searchSelection.value = 0
  searchOpen.value = true
  await nextTick()
  searchInputEl.value?.focus()
}
function closeGlobalSearch() {
  searchOpen.value = false
  globalSearch.value = ''
}
function moveSearchSelection(delta: number) {
  const count = filteredSearchItems.value.length
  if (!count) return
  searchSelection.value = (searchSelection.value + delta + count) % count
}
function openSelectedSearchResult() {
  const item = filteredSearchItems.value[searchSelection.value]
  if (item) openSearchResult(item.to)
}
async function openSearchResult(to: string) {
  closeGlobalSearch()
  await router.push(to)
}

function onSearchKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value ? closeGlobalSearch() : openGlobalSearch()
    return
  }
  if (e.key === 'Escape' && searchOpen.value) closeGlobalSearch()
}
onMounted(() => { if (import.meta.client) document.addEventListener('keydown', onSearchKeydown) })
onUnmounted(() => { if (import.meta.client) document.removeEventListener('keydown', onSearchKeydown) })
</script>
