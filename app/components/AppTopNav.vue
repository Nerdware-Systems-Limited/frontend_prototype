<template>
  <!--
    Top nav - ported from UAPTS_WEB_WIREFRAMES index.html <nav class="top-nav">
    Green-on-green gradient + 4px gold underline + right cluster.
    Subtitle changes per page via $page subtitle (set in layouts/default).
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
      <div class="sec-badge" title="MFA active · Session secure">
        <span class="sec-dot"></span>Secure
      </div>
      <div class="live-indicator">Live Data</div>
      <div class="nav-time" id="navClock">{{ clock }}</div>

      <button class="bell-btn" aria-label="Notifications" @click="goNotifications">
        <span class="bell-label">Alerts</span> <span class="badge">{{ alertCount }}</span>
      </button>

      <NuxtLink to="/profile" class="avatar" :title="user?.full_name ?? 'Profile'">
        {{ userInitials }}
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
/**
 * AppTopNav - fixed top navigation matching wireframe pattern.
 * Subtitle comes from useState('navSubtitle') so each page can update it.
 */
import { useNotificationStore } from '~/stores/notifications'

const notificationStore = useNotificationStore()

const sidebarOpen = useState('sidebarOpen', () => false)
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }

const locale = ref<'EN' | 'SW'>('EN')
function setLocale(l: 'EN' | 'SW') { locale.value = l }

const subtitle = useState<string>('navSubtitle', () => 'Executive Command Center')

const auth = useAuth()
const user = computed(() => auth.user.value)
const userInitials = computed(() => {
  const u = user.value
  if (!u) return 'JM'
  const name = u.full_name ?? u.email ?? ''
  return name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
    || 'JM'
})

const alertCount = computed(() => notificationStore.unreadCount)

// Live clock - updates every second
const clock = ref('--:--:--')
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const tick = () => {
    const d = new Date()
    clock.value = `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`
  }
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// Live-notifications socket. AppTopNav is rendered by every page on the
// default layout and unmounts/remounts together with it, so this is the
// connection's whole lifetime - connect once here, disconnect once here.
// (See the cleanup note in useNotificationSocket.ts for why this can't live
// inside the store itself.)
onMounted(() => { notificationStore.connect() })
onUnmounted(() => { notificationStore.disconnect() })

const router = useRouter()
function goNotifications() { router.push('/notifications') }
</script>