<template>
  <EmptyState v-if="!allowed" icon="inbox" message="You don't have permission to edit dashboards." />
  <EmptyState v-else-if="loading" loading />
  <template v-else-if="error">
    <div class="error-banner dm-error" role="alert">
      <span>⚠ {{ error }}</span>
      <button v-if="notFound === false" type="button" class="error-retry-btn" @click="load">Retry</button>
    </div>
    <NuxtLink to="/admin/dashboards" class="btn btn-sm dm-back"><ArrowLeft :size="14" aria-hidden="true" /> All dashboards</NuxtLink>
  </template>
  <template v-else-if="record">
    <div v-if="actionError" class="error-banner dm-error" role="alert" aria-live="polite">
      <span>⚠ {{ actionError }}</span>
      <button type="button" class="error-retry-btn" @click="actionError = null">Dismiss</button>
    </div>
    <ClientOnly>
      <DashboardEditor
        :key="record.id" :initial="record" :all-dashboards="all"
        @saved="onSaved" @duplicate="duplicate" @archive="archiveOpen = true"
      />
    </ClientOnly>
  </template>

  <ConfirmDialog
    :open="archiveOpen"
    title="Archive dashboard?"
    :message="`Viewers assigned to “${record?.name ?? 'this dashboard'}” will fall back to the next matching dashboard. Unsaved edits in the editor are discarded.`"
    confirm-label="Archive"
    busy-label="Archiving…"
    :busy="archiving"
    danger
    @confirm="archive"
    @cancel="archiveOpen = false"
  />
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import type { DashboardRecord, DashboardSummary } from '~/types/dashboard'
import { useDashboardApi, toDashboardApiError } from '~/composables/useDashboardApi'
import DashboardEditor from '~/components/dashboard/DashboardEditor.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const api = useDashboardApi()
const { canManageDashboards, canManageAgencyDashboards } = useViewerContext()
const allowed = computed(() => canManageDashboards.value || canManageAgencyDashboards.value)

const record = ref<DashboardRecord | null>(null)
const all = ref<DashboardSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref<boolean | null>(null)
const actionError = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  notFound.value = null
  try {
    const [r, list] = await Promise.all([api.get(String(route.params.id)), api.list()])
    record.value = r
    all.value = list
  } catch (e) {
    const err = toDashboardApiError(e)
    notFound.value = err.status === 404
    error.value = notFound.value ? "This dashboard doesn't exist, or it belongs to an agency you can't manage." : `Couldn't open the dashboard: ${err.message}`
  } finally { loading.value = false }
}
onMounted(() => { if (allowed.value) load() })
watch(() => route.params.id, () => { if (allowed.value) load() })

function onSaved(r: DashboardRecord) {
  all.value = all.value.map(d => (d.id === r.id ? r : d))
}
async function duplicate() {
  if (!record.value) return
  actionError.value = null
  try {
    const c = await api.duplicate(record.value.id, `${record.value.name} (copy)`)
    await navigateTo(`/admin/dashboards/${c.id}`)
  } catch (e) { actionError.value = `Not duplicated: ${toDashboardApiError(e).message}` }
}

const archiveOpen = ref(false)
const archiving = ref(false)
async function archive() {
  if (!record.value) return
  archiving.value = true
  actionError.value = null
  try {
    await api.archive(record.value.id)
    archiveOpen.value = false
    // The editor's leave guard would ask about unsaved edits; the dialog already said they're discarded.
    record.value = null
    await nextTick()
    await navigateTo('/admin/dashboards')
  } catch (e) {
    archiveOpen.value = false
    actionError.value = `Not archived: ${toDashboardApiError(e).message}`
  } finally { archiving.value = false }
}
</script>

<style scoped>
.dm-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dm-back { align-self: flex-start; }
</style>
