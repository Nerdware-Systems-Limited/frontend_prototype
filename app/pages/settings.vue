<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">System</div>
        <h1 class="text-heading">Settings</h1>
        <p class="text-xs text-fg-muted mt-1">Platform configuration and system preferences</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge badge-success"><span class="dot-live mr-1" />All systems nominal</span>
      </div>
    </div>

    <div class="settings-layout">
      <!-- Left nav -->
      <nav class="settings-nav card">
        <div v-for="section in sections" :key="section.id">
          <button class="settings-nav-item" :class="{ active: activeSection === section.id }" @click="activeSection = section.id">
            <component :is="section.icon" :size="14" />
            {{ section.label }}
          </button>
        </div>
      </nav>

      <!-- Content -->
      <div class="settings-content">
        <!-- General -->
        <div v-if="activeSection === 'general'" class="settings-section">
          <div class="section-head">
            <Globe :size="15" class="text-primary" />
            <div>
              <div class="text-subhead">General Configuration</div>
              <div class="text-xs text-fg-muted">Timezone, locale, display preferences</div>
            </div>
          </div>
          <div class="settings-grid">
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Platform name</div>
                <div class="text-xs text-fg-muted">Display name shown across the platform</div>
              </div>
              <input v-model="general.platform_name" type="text" class="input setting-input" />
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Default timezone</div>
                <div class="text-xs text-fg-muted">Used for all timestamps and scheduling</div>
              </div>
              <select v-model="general.timezone" class="input setting-input">
                <option value="Africa/Nairobi">Africa/Nairobi (EAT +3)</option>
                <option value="UTC">UTC</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT +1)</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Date format</div>
                <div class="text-xs text-fg-muted">How dates are displayed platform-wide</div>
              </div>
              <select v-model="general.date_format" class="input setting-input">
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Data refresh interval</div>
                <div class="text-xs text-fg-muted">How often live dashboards poll for updates</div>
              </div>
              <select v-model="general.refresh_interval" class="input setting-input">
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
              </select>
            </div>
          </div>
          <div class="section-actions">
            <button class="btn btn-primary">Save changes</button>
          </div>
        </div>

        <!-- Security -->
        <div v-if="activeSection === 'security'" class="settings-section">
          <div class="section-head">
            <ShieldCheck :size="15" class="text-primary" />
            <div>
              <div class="text-subhead">Security & Authentication</div>
              <div class="text-xs text-fg-muted">MFA policy, session limits, lockout rules</div>
            </div>
          </div>
          <div class="settings-grid">
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Enforce MFA for all users</div>
                <div class="text-xs text-fg-muted">All accounts must set up 2FA before accessing the platform</div>
              </div>
              <toggle-switch v-model="security.enforce_mfa" />
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Account lockout threshold</div>
                <div class="text-xs text-fg-muted">Number of consecutive MFA failures before locking</div>
              </div>
              <select v-model="security.lockout_threshold" class="input setting-input">
                <option value="3">3 attempts</option>
                <option value="5">5 attempts</option>
                <option value="10">10 attempts</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">JWT access token lifetime</div>
                <div class="text-xs text-fg-muted">How long access tokens are valid</div>
              </div>
              <select v-model="security.token_lifetime" class="input setting-input">
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Concurrent sessions</div>
                <div class="text-xs text-fg-muted">Maximum active sessions per user</div>
              </div>
              <select v-model="security.max_sessions" class="input setting-input">
                <option value="1">1 session</option>
                <option value="3">3 sessions</option>
                <option value="10">10 sessions</option>
                <option value="-1">Unlimited</option>
              </select>
            </div>
          </div>
          <div class="section-actions">
            <button class="btn btn-primary">Save security settings</button>
          </div>
        </div>

        <!-- System Health -->
        <div v-if="activeSection === 'health'" class="settings-section">
          <div class="section-head">
            <Activity :size="15" class="text-primary" />
            <div>
              <div class="text-subhead">System Health</div>
              <div class="text-xs text-fg-muted">Live service status, database connections, background jobs</div>
            </div>
          </div>
          <div class="health-grid">
            <div v-for="svc in services" :key="svc.name" class="health-card card">
              <div class="health-top">
                <span :class="`dot-${svc.status === 'online' ? 'live' : svc.status === 'degraded' ? 'warn' : 'dead'}`" />
                <span class="text-sm font-medium">{{ svc.name }}</span>
                <span class="badge ml-auto" :class="svc.status === 'online' ? 'badge-success' : svc.status === 'degraded' ? 'badge-warning' : 'badge-danger'">{{ svc.status }}</span>
              </div>
              <div class="health-metrics">
                <div class="health-metric">
                  <span class="text-xs text-fg-dim">Response</span>
                  <span class="text-xs font-mono">{{ svc.ms }}ms</span>
                </div>
                <div class="health-metric">
                  <span class="text-xs text-fg-dim">Uptime</span>
                  <span class="text-xs font-mono">{{ svc.uptime }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Backup -->
        <div v-if="activeSection === 'backup'" class="settings-section">
          <div class="section-head">
            <HardDrive :size="15" class="text-primary" />
            <div>
              <div class="text-subhead">Backup & Recovery</div>
              <div class="text-xs text-fg-muted">Backup schedules, retention policies, disaster recovery</div>
            </div>
          </div>
          <div class="settings-grid">
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Automatic backups</div>
                <div class="text-xs text-fg-muted">Enable scheduled database backups</div>
              </div>
              <toggle-switch v-model="backup.auto_backup" />
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Backup frequency</div>
                <div class="text-xs text-fg-muted">How often to create backups</div>
              </div>
              <select v-model="backup.frequency" class="input setting-input">
                <option value="hourly">Every hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="text-sm font-medium">Retention period</div>
                <div class="text-xs text-fg-muted">How long to keep backups</div>
              </div>
              <select v-model="backup.retention" class="input setting-input">
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
          <div class="backup-status card">
            <div class="flex items-center gap-3">
              <CheckCircle :size="16" class="text-green-400" />
              <div>
                <div class="text-sm font-medium">Last backup successful</div>
                <div class="text-xs text-fg-muted font-mono">2025-01-11 02:00:00 EAT · 2.4 GB</div>
              </div>
            </div>
            <button class="btn btn-secondary text-xs">Run backup now</button>
          </div>
          <div class="section-actions">
            <button class="btn btn-primary">Save backup settings</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Globe, ShieldCheck, Activity, HardDrive, CheckCircle
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const activeSection = ref('general')

const sections = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'backup', label: 'Backup & Recovery', icon: HardDrive },
]

const general = reactive({
  platform_name: 'UAPTS Platform',
  timezone: 'Africa/Nairobi',
  date_format: 'DD/MM/YYYY',
  refresh_interval: '30',
})

const security = reactive({
  enforce_mfa: true,
  lockout_threshold: '3',
  token_lifetime: '15',
  max_sessions: '3',
})

const backup = reactive({
  auto_backup: true,
  frequency: 'daily',
  retention: '30',
})

const services = [
  { name: 'API Server', status: 'online', ms: '48', uptime: '99.98%' },
  { name: 'Database (Primary)', status: 'online', ms: '12', uptime: '99.99%' },
  { name: 'Redis Cache', status: 'online', ms: '3', uptime: '100%' },
  { name: 'Celery Workers', status: 'degraded', ms: '—', uptime: '97.2%' },
  { name: 'WebSocket Service', status: 'online', ms: '21', uptime: '99.95%' },
  { name: 'GIS Engine', status: 'offline', ms: '—', uptime: '—' },
]

// Simple toggle switch component
defineComponent({
  name: 'ToggleSwitch',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
})
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

.settings-layout { display: grid; grid-template-columns: 200px 1fr; gap: 16px; align-items: start; }
@media (max-width: 768px) { .settings-layout { grid-template-columns: 1fr; } }

.settings-nav { padding: 8px; display: flex; flex-direction: column; gap: 2px; position: sticky; top: 24px; }
.settings-nav-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 9px 12px; border-radius: var(--radius-sm); font-size: 0.8125rem;
  font-weight: 500; color: var(--fg-muted); background: none; border: none;
  cursor: pointer; text-align: left; transition: all 0.1s;
}
.settings-nav-item:hover { color: var(--fg); background: rgba(255,255,255,0.04); }
.settings-nav-item.active { color: var(--fg); background: rgba(59,130,246,0.12); }

.settings-content { display: flex; flex-direction: column; gap: 14px; }
.settings-section { display: flex; flex-direction: column; gap: 16px; }

.section-head {
  display: flex; align-items: center; gap: 12px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px;
}

.settings-grid { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.setting-row {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.setting-row:last-child { border-bottom: none; }
.setting-info { flex: 1; min-width: 0; }
.setting-input { width: 200px; flex-shrink: 0; }
@media (max-width: 600px) { .setting-row { flex-direction: column; align-items: flex-start; } .setting-input { width: 100%; } }

.section-actions { display: flex; justify-content: flex-end; }

.health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.health-card { padding: 14px; }
.health-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.health-metrics { display: flex; justify-content: space-between; }
.health-metric { display: flex; flex-direction: column; gap: 2px; }

.backup-status {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px;
}

.mr-1 { margin-right: 4px; }
</style>