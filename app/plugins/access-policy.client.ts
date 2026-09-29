// Points the Module Access store at the accounts API (GET/PUT
// /api/v1/access-control/) and clears it on sign-out.
//
// Nothing is loaded here. This plugin runs before the first navigation, when
// there is no access token yet (it is memory-only; the route middleware refreshes
// it silently from the stored refresh token), and an unauthenticated request to
// the API would be answered 401 - which the $api client treats as "log out".
// middleware/auth.global.ts calls useAccessPolicyStore().ensureLoaded() once the
// account is authenticated, so route resolution always sees the saved policy.
import { watch } from 'vue'
import { useAccessPolicyStore, setAccessPolicyStorage } from '~/stores/accessPolicy'
import { useAuthStore } from '~/stores/auth'
import { createApiAccessPolicyStorage, type PolicyApiFetch } from '~/utils/accessPolicyStorage'

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore()

  setAccessPolicyStorage(createApiAccessPolicyStorage(
    // Read lazily: plugins run alphabetically and $api (plugins/api.ts) is provided after this one.
    () => nuxtApp.$api as unknown as PolicyApiFetch,
    // Only a super admin or an agency admin may read the change log; the server refuses everyone else.
    () => ['super_admin', 'admin'].includes(auth.user?.role_type ?? ''),
  ))

  // Signing out must not leave this account's policy for the next one to pick up.
  const policy = useAccessPolicyStore()
  watch(() => auth.user?.id, (id) => { if (!id) policy.reset() })
})
