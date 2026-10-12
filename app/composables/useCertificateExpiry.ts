/**
 * useCertificateExpiry - the certificates a viewer may see, classified and
 * ordered by urgency.
 *
 * - Only sources whose page the viewer can open are fetched (the same
 *   agency-scope check the sidebar uses), so nobody sees or triggers a
 *   request for a certificate type outside their access.
 * - One source failing never blanks the rest: its name goes in `failed` and the
 *   panel says so.
 * - Window and thresholds come from the `policy` you pass (default
 *   `DEFAULT_CERT_POLICY`); the fetch reaches `policy.upcomingDays` ahead.
 */
import { computed, ref } from 'vue'
import { CERTIFICATE_SOURCES, type CertificateSource } from '~/config/certificateSources'
import {
  DEFAULT_CERT_POLICY, countByStatus, dedupe, sortByUrgency, toView,
  type CertificatePolicy, type CertificateRecord, type CertificateView,
} from '~/utils/certificateExpiry'

export interface UseCertificateExpiryOptions {
  /** Restrict to these source ids (a module's own overview shows only its certificates). */
  sources?: string[]
  policy?: CertificatePolicy
}

export function useCertificateExpiry(opts: UseCertificateExpiryOptions = {}) {
  const { canAccessRoute } = useAccessControl()
  const policy = opts.policy ?? DEFAULT_CERT_POLICY

  const raw = ref<CertificateRecord[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const failed = ref<string[]>([])
  const checked = ref<string[]>([])

  const permitted = computed<CertificateSource[]>(() =>
    CERTIFICATE_SOURCES.filter(s => (!opts.sources || opts.sources.includes(s.id)) && canAccessRoute(s.route)))

  async function load() {
    loading.value = true
    const list = permitted.value
    checked.value = list.map(s => s.label)
    const results = await Promise.allSettled(list.map(s => s.fetch(policy.upcomingDays)))
    const next: CertificateRecord[] = []
    const bad: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next.push(...r.value.filter(c => c.expiry))
      else bad.push(list[i]!.label)
    })
    raw.value = dedupe(next)
    failed.value = bad
    loading.value = false
    loaded.value = true
  }

  const all = computed<CertificateView[]>(() => sortByUrgency(raw.value.map(r => toView(r, policy))))
  const counts = computed(() => countByStatus(all.value))

  return { policy, permitted, all, counts, loading, loaded, failed, checked, load }
}
