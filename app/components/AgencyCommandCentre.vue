<template>
  <header class="acc-header">
    <div class="acc-header-main">
      <h1>{{ agency?.name ?? agencyCode }}</h1>
      <p class="acc-dek">{{ agencyCode }} · {{ roleTier }} workspace</p>
    </div>
    <NuxtLink v-if="agency?.landing && agency.landing !== '/dashboard'" :to="agency.landing" class="btn btn-primary">
      Full workspace →
    </NuxtLink>
  </header>

  <div v-if="tiles.length" class="kpi-grid">
    <KpiCard
      v-for="t in tiles" :key="t.moduleId"
      :label="t.entry.label"
      :value="t.primary.value ?? '-'"
      :unit="t.primary.unit"
      :loading="t.loading"
      :unavailable="!t.loading && t.primary.value == null"
      :unavailable-reason="t.fetchFailed ? `${t.entry.label} feed unavailable` : 'No value reported'"
      :description="t.secondary.map(k => `${k.label}: ${k.value ?? '-'}`).join(' · ')"
      :class="{ 'kpi-card--muted': t.scope === 'read' }"
      :period="t.entry.period"
      :to="t.entry.route"
    />
  </div>
  <EmptyState v-else :loading="loading" message="No modules resolved for this agency yet." />

  <template v-for="g in quickLinkGroups" :key="g.label">
    <SectionTitle>{{ g.label }}</SectionTitle>
    <div class="acc-quicklinks">
      <NuxtLink v-for="l in g.links" :key="l.path" :to="l.path" class="acc-quicklink">
        {{ l.label }}
      </NuxtLink>
    </div>
  </template>
</template>

<script setup lang="ts">
import { BASE_SETTINGS } from '~/utils/resolveAccess'

const { agency, agencyCode, roleTier, canAccessRoute } = useAccessControl()

// One tile per module this agency can open, each loaded and failing on its own.
const { tiles, loading, load } = useModuleSummaries()

onMounted(load)

const quickLinkGroups = computed(() => {
  const settings = BASE_SETTINGS
  const baseline = new Set(Object.keys(settings.defaults.baselineRoutes))
  const groups: { label: string; links: { path: string; label: string }[] }[] = []
  for (const mod of Object.values(settings.modules)) {
    const links: { path: string; label: string }[] = []
    for (const route of mod.routes) {
      if (route.includes('[')) continue
      if (baseline.has(route)) continue
      if (canAccessRoute(route)) links.push({ path: route, label: route })
    }
    if (links.length) groups.push({ label: mod.label, links })
  }
  return groups
})
</script>

<style scoped>
.acc-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.acc-dek { color:var(--fg-3); font-size:13px; margin:2px 0 0; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:16px; }
.kpi-card--muted { opacity:.7; }
.acc-quicklinks { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
.acc-quicklink { font-size:12px; padding:6px 10px; border:1px solid var(--border-subtle); border-radius:var(--r-sm); color:var(--fg-2); }
.acc-quicklink:hover { border-color:var(--primary); color:var(--primary); }
</style>
