import { applyStoredTheme } from '~/composables/useTheme'

/**
 * Apply the stored light/dark choice to <html> as early as possible, before
 * the first paint of the SPA shell, so there is no flash of the wrong theme.
 */
export default defineNuxtPlugin(() => {
  applyStoredTheme()
})
