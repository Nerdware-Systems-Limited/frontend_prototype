<template>
  <!--
    /dashboard - every signed-in user lands here.

    1. Ask the server which dashboard this viewer gets (agency / department /
       role / user assignments, RBAC-stripped).
    2. None assigned, or the Dashboard Manager API isn't deployed yet →
       exactly the previous behaviour (National / Agency Command Centre),
       so rolling this out changes nothing until an admin publishes one.
    3. If the assignment allows it, the viewer can customise their own copy
       (hide / move / resize) without touching anyone else's.
  -->
  <div>
    <div v-if="notice" class="error-banner dash-notice" role="alert" aria-live="polite">
      <span>{{ notice }}</span>
      <button type="button" class="error-retry-btn" @click="load">Retry</button>
    </div>
    <EmptyState v-if="state === 'loading'" loading />

    <template v-else-if="state === 'custom' && resolved">
      <!-- personal layout editing -->
      <template v-if="personalizing">
        <div v-if="personalError" class="error-banner" role="alert" aria-live="polite">⚠ {{ personalError }}</div>
        <div class="pz-bar" role="region" aria-label="Customise your view">
          <span><strong>Customising your view.</strong> Drag to move, drag the corner to resize, “Hide” what you don't need. Only you see this.</span>
          <div class="pz-actions">
            <button v-if="resolved.personalized" type="button" class="btn btn-sm" :disabled="busy" @click="resetPersonal">Reset to default</button>
            <button type="button" class="btn btn-sm" :disabled="busy" @click="personalizing = false">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="busy" @click="savePersonal">{{ busy ? 'Saving…' : 'Save my layout' }}</button>
          </div>
        </div>
        <PersonalCanvas v-model:widgets="personalWidgets" :definition="resolved.dashboard.definition" />
      </template>

      <DashboardRenderer v-else :key="resolved.dashboard.id + ':' + resolved.dashboard.publishedVersion" :definition="resolved.dashboard.definition">
        <template #header-actions>
          <button v-if="resolved.canPersonalize" type="button" class="btn btn-sm" @click="startPersonalizing">Customise</button>
          <button type="button" class="btn btn-sm why-btn" :aria-expanded="whyOpen" @click="whyOpen = !whyOpen">Why this view?</button>
          <NuxtLink v-if="canManage" :to="`/admin/dashboards/${resolved.dashboard.id}`" class="btn btn-sm">Edit</NuxtLink>
        </template>
      </DashboardRenderer>

      <SideDrawer :open="whyOpen" title="Why am I seeing this?" @close="whyOpen = false">
        <div class="why">
          <p>You're on <strong>{{ resolved.dashboard.name }}</strong> (v{{ resolved.dashboard.publishedVersion }}).</p>
          <p v-if="resolved.matchedAssignment">It's assigned to <strong>{{ describeScope(resolved.matchedAssignment) }}</strong>, which includes you<template v-if="resolved.matchedAssignment.locked"> and is locked for that audience</template>.</p>
          <p v-else>You opened it directly.</p>
          <p v-if="resolved.personalized">You've customised the layout. “Customise → Reset to default” undoes that.</p>
          <p v-if="resolved.strippedWidgetIds.length">{{ resolved.strippedWidgetIds.length }} widget(s) on this dashboard need permissions you don't have, so they're not shown.</p>
          <p class="why-muted">Dashboard assignments are managed by your agency's administrators.</p>
        </div>
      </SideDrawer>
    </template>

    <!-- Fallback: unchanged legacy behaviour -->
    <template v-else>
      <NationalCommandCentre v-if="showNational" />
      <AgencyCommandCentre v-else-if="agency" />
      <NationalCommandCentre v-else />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ResolvedDashboard, WidgetInstance } from '~/types/dashboard'
import { useDashboardApi, toDashboardApiError } from '~/composables/useDashboardApi'
import { describeScope } from '~/utils/resolveDashboard'
import DashboardRenderer from '~/components/dashboard/DashboardRenderer.vue'
import PersonalCanvas from '~/components/dashboard/PersonalCanvas.vue'

definePageMeta({ layout: 'default' })

const { isSuperAdmin, agencyCode, agency } = useAccessControl()
const showNational = computed(() => isSuperAdmin.value || agencyCode.value === 'SDT')
const { canManageDashboards, canManageAgencyDashboards } = useViewerContext()
const canManage = computed(() => canManageDashboards.value || canManageAgencyDashboards.value)

const api = useDashboardApi()
const route = useRoute()
const state = ref<'loading' | 'custom' | 'fallback'>('loading')
const resolved = ref<ResolvedDashboard | null>(null)
const whyOpen = ref(false)
/** Shown above whatever renders; a failure never blocks the landing page. */
const notice = ref<string | null>(null)

async function load() {
  state.value = 'loading'
  notice.value = null
  const id = typeof route.query.id === 'string' ? route.query.id : undefined
  try {
    // null = HTTP 204: nothing is assigned to this viewer -> the Command Centre, silently.
    const res = await api.resolve({ dashboardId: id })
    resolved.value = res
    state.value = res ? 'custom' : 'fallback'
  } catch (err) {
    const e = toDashboardApiError(err)
    resolved.value = null
    state.value = 'fallback'
    if (id && e.status === 404) notice.value = "That dashboard doesn't exist or isn't shared with you. Showing your Command Centre instead."
    // 404 on a plain /resolve/: the Dashboard Manager API isn't deployed on this backend - behave exactly as before.
    else if (e.status !== 404) notice.value = `Couldn't load your assigned dashboard: ${e.message} Showing the Command Centre instead.`
  }
}
onMounted(load)
watch(() => route.query.id, load)

// ── personal layout ──
const personalizing = ref(false)
const personalWidgets = ref<WidgetInstance[]>([])
const busy = ref(false)
function startPersonalizing() {
  personalWidgets.value = structuredClone(toRaw(resolved.value!.dashboard.definition.widgets))
  personalizing.value = true
}
const personalError = ref<string | null>(null)
async function savePersonal() {
  busy.value = true
  personalError.value = null
  try {
    await api.savePersonalLayout(resolved.value!.dashboard.id, personalWidgets.value.map(({ id, x, y, w, h, hidden }) => ({ id, x, y, w, h, hidden })))
    personalizing.value = false
    await load()
  } catch (err) {
    personalError.value = `Your layout wasn't saved: ${toDashboardApiError(err).message}`
  } finally { busy.value = false }
}
async function resetPersonal() {
  busy.value = true
  personalError.value = null
  try {
    await api.resetPersonalLayout(resolved.value!.dashboard.id)
    personalizing.value = false
    await load()
  } catch (err) {
    personalError.value = `Couldn't reset your layout: ${toDashboardApiError(err).message}`
  } finally { busy.value = false }
}
</script>

<style scoped>
.pz-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; margin-bottom: 14px; border-radius: var(--r-sm);
  background: var(--info-bg); color: var(--info-fg); font-size: 12.5px; position: sticky; top: 0; z-index: 30;
}
.pz-actions { display: flex; gap: 6px; }
.dash-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.why { display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--fg-2); line-height: 1.55; }
.why p { margin: 0; }
.why-muted { color: var(--fg-3); font-size: 12px; }
</style>
