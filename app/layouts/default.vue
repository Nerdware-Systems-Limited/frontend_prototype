<template>
  <div class="shell">
    <!-- Top Nav -->
    <header class="topnav">
      <div class="flex items-center gap-3">
        <button class="btn btn-ghost btn-icon lg:hidden" @click="sidebarOpen = !sidebarOpen">
          <Menu :size="18" />
        </button>
        <div class="flex items-center gap-2.5">
          <img src="/logo.png" alt="UAPTS" class="h-8 w-8 object-contain rounded-lg" @error="showFallbackLogo = true" />
          <span v-if="showFallbackLogo" class="logo-fallback">🚦</span>
          <div>
            <span class="text-primary font-bold text-sm tracking-tight">UAPTS</span>
            <span class="text-fg-muted text-sm"> Platform</span>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="search-wrap">
        <Search :size="13" class="search-icon" />
        <input class="search-input" type="text" placeholder="Search modules, routes, vehicles…" />
        <kbd class="search-kbd">⌘K</kbd>
      </div>

      <!-- Right cluster -->
      <div class="flex items-center gap-3">
        <div class="hidden md:flex items-center gap-1.5 text-xs text-green-400">
          <span class="dot-live"></span>
          <span>Live</span>
          <span class="font-mono text-fg-muted">{{ clock }}</span>
        </div>

        <!-- Health indicators -->
        <div class="hidden lg:flex items-center gap-1">
          <span v-for="(h, i) in health" :key="i"
            class="w-2 h-2 rounded-full"
            :class="h === 'ok' ? 'bg-green-400' : h === 'warn' ? 'bg-amber-400' : 'bg-red-500'"
          />
        </div>

        <!-- Notifications -->
        <button class="relative btn btn-ghost btn-icon">
          <Bell :size="16" />
          <span class="notif-badge">3</span>
        </button>

        <!-- Avatar — now powered by real auth user -->
        <NuxtLink to="/profile" class="avatar-btn">
          <div class="avatar">
            <img v-if="user?.avatar" :src="user.avatar" :alt="user.full_name" class="avatar-img" />
            <span v-else>{{ userInitials }}</span>
          </div>
          <span class="hidden sm:block text-xs font-medium">{{ user?.full_name ?? 'Loading…' }}</span>
          <ChevronDown :size="12" class="text-fg-dim" />
        </NuxtLink>
      </div>
    </header>

    <div class="body-wrap">
      <!-- Sidebar -->
      <nav class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
        <div class="sidebar-scroll">
          <div class="nav-section-label">Core</div>
          <NuxtLink to="/dashboard" class="nav-link" active-class="active"><BarChart3 :size="15" /> Dashboard</NuxtLink>
          <NuxtLink to="/kenya-map" class="nav-link" active-class="active"><Map :size="15" /> Kenya Map</NuxtLink>
          <NuxtLink to="/traffic" class="nav-link" active-class="active"><Clock :size="15" /> Traffic</NuxtLink>
          <NuxtLink to="/public-transport" class="nav-link" active-class="active"><Bus :size="15" /> Public Transport</NuxtLink>
          <NuxtLink to="/fleet" class="nav-link" active-class="active"><Truck :size="15" /> Fleet GPS</NuxtLink>
          <NuxtLink to="/infrastructure" class="nav-link" active-class="active"><Building2 :size="15" /> Infrastructure</NuxtLink>
          <NuxtLink to="/incidents" class="nav-link" active-class="active"><ShieldAlert :size="15" /> Incidents</NuxtLink>
          <NuxtLink to="/compliance" class="nav-link" active-class="active"><ClipboardList :size="15" /> Compliance</NuxtLink>

          <div class="nav-section-label">Logistics</div>
          <NuxtLink to="/maritime" class="nav-link" active-class="active"><Ship :size="15" /> Maritime</NuxtLink>
          <NuxtLink to="/rail" class="nav-link" active-class="active"><Train :size="15" /> Rail</NuxtLink>
          <NuxtLink to="/aviation" class="nav-link" active-class="active"><Plane :size="15" /> Aviation</NuxtLink>

          <div class="nav-section-label">Analytics & Admin</div>
          <NuxtLink to="/analytics" class="nav-link" active-class="active"><TrendingUp :size="15" /> Analytics Workbench</NuxtLink>
          <NuxtLink to="/query-builder" class="nav-link" active-class="active"><Search :size="15" /> Query Builder</NuxtLink>
          <NuxtLink to="/reports" class="nav-link" active-class="active"><FileText :size="15" /> Report Center</NuxtLink>

          <div class="nav-section-label">System</div>
          <!-- Role-gated: only god/admin can see User Management -->
          <NuxtLink v-if="canManageUsers" to="/users" class="nav-link" active-class="active"><Users :size="15" /> User Management</NuxtLink>
          <NuxtLink to="/audit" class="nav-link" active-class="active"><ScrollText :size="15" /> Audit Trail</NuxtLink>
          <NuxtLink to="/integrations" class="nav-link" active-class="active"><Link2 :size="15" /> Integration Hub</NuxtLink>
          <NuxtLink to="/notifications" class="nav-link" active-class="active"><Bell :size="15" /> Notifications</NuxtLink>
          <NuxtLink to="/settings" class="nav-link" active-class="active"><Settings :size="15" /> Settings</NuxtLink>

          <div class="sidebar-footer">
            <!-- Role badge -->
            <div v-if="user?.role" class="role-badge">
              <span class="role-dot" :class="`role-dot--${user.role}`"></span>
              {{ roleLabel }}
            </div>
            <button class="nav-link w-full text-red-400 hover:text-red-300" @click="handleLogout" :disabled="isLoading">
              <LogOut :size="15" /> {{ isLoading ? 'Signing out…' : 'Sign Out' }}
            </button>
          </div>
        </div>
      </nav>

      <!-- Overlay for mobile -->
      <div v-if="sidebarOpen" class="sidebar-overlay lg:hidden" @click="sidebarOpen = false" />

      <!-- Main Content -->
      <main class="main-content animate-fade-in">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BarChart3, Clock, Truck, Building2, ShieldAlert, ClipboardList,
  Ship, Train, Plane, TrendingUp, Search, FileText, Users, ScrollText,
  Link2, Bell, Settings, LogOut, ChevronDown, Menu, Bus, Map
} from 'lucide-vue-next'

// ── Auth ─────────────────────────────────────────────────────────────────────
const { user, userInitials, logout, isLoading } = useAuth()

console.log(user)

const ADMIN_ROLES = ['super_admin', 'admin', 'superuser']

const canManageUsers = computed(() =>
  user.value?.role ? ADMIN_ROLES.includes(user.value.role) : false
)

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    superuser: 'Super User',
    operator: 'Operator',
    analyst: 'Analyst',
    viewer: 'Viewer',
  }
  return map[user.value?.role ?? ''] ?? user.value?.role ?? ''
})

async function handleLogout() {
  await logout()
}

// ── UI state ─────────────────────────────────────────────────────────────────
const sidebarOpen    = ref(false)
const showFallbackLogo = ref(false)
const clock          = ref('')
const health         = ['ok','ok','warn','ok','ok','dead','ok','ok']

onMounted(() => {
  const tick = () => {
    clock.value = new Date().toLocaleTimeString('en-KE', { hour12: false })
  }
  tick()
  const t = setInterval(tick, 1000)
  onUnmounted(() => clearInterval(t))
})
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

.topnav {
  height: 54px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 50;
  gap: 16px;
  flex-shrink: 0;
}

.logo-fallback { font-size: 20px; }

.search-wrap {
  flex: 1;
  max-width: 380px;
  position: relative;
  display: none;
}
@media (min-width: 640px) { .search-wrap { display: flex; align-items: center; } }

.search-icon { position: absolute; left: 12px; color: var(--fg-dim); pointer-events: none; }
.search-input {
  width: 100%;
  padding: 7px 40px 7px 34px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-size: 0.8125rem;
  outline: none;
  font-family: var(--font-sans);
  transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--primary); }
.search-input::placeholder { color: var(--fg-dim); }
.search-kbd {
  position: absolute;
  right: 10px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.6875rem;
  color: var(--fg-dim);
  font-family: var(--font-mono);
}

.dot-live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.notif-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  color: var(--fg);
  text-decoration: none;
}
.avatar-btn:hover { background: rgba(255,255,255,0.05); }
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.body-wrap { display: flex; flex: 1; overflow: hidden; position: relative; }

.sidebar {
  width: 216px;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
  overflow: hidden;
  display: none;
  flex-direction: column;
}
@media (min-width: 1024px) { .sidebar { display: flex; } }
.sidebar.sidebar-open { display: flex; position: fixed; top: 54px; left: 0; bottom: 0; z-index: 40; }

.sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 39; }

.sidebar-scroll { flex: 1; overflow-y: auto; padding: 8px 0 16px; }

.sidebar-footer {
  padding: 12px 8px 8px;
  border-top: 1px solid var(--border);
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--fg-muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--fg-dim);
}
.role-dot--god       { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
.role-dot--admin     { background: #6366f1; }
.role-dot--superuser { background: #8b5cf6; }
.role-dot--operator  { background: #10b981; }
.role-dot--analyst   { background: #3b82f6; }
.role-dot--viewer    { background: #6b7280; }

.main-content { flex: 1; overflow-y: auto; padding: 24px; min-width: 0; }
</style>