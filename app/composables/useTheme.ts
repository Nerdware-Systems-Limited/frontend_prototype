/**
 * useTheme - light / dark mode for the UAPTS instrument-panel UI.
 *
 * Writes `data-theme="light" | "dark"` on <html>; theme.css redefines its
 * token palette under that attribute. Light is the binding product default -
 * with no explicit choice the app always opens light, regardless of the OS
 * `prefers-color-scheme` (a government dashboard used in bright offices and
 * on wall displays should not silently open dark).
 *
 * The choice is persisted to localStorage so it survives reloads. This is a
 * SPA (`ssr: false`) so there is no server render to flash; the plugin
 * `theme.client.ts` applies the stored value before the app mounts.
 */

export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'uapts_theme'

export function applyStoredTheme() {
  if (typeof window === 'undefined') return
  let stored: string | null = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
  document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')
}

export function useTheme() {
  const choice = useState<ThemeChoice>('uapts-theme-choice', () => {
    if (typeof window === 'undefined') return 'light'
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'dark') return 'dark'
    } catch { /* ignore */ }
    return 'light'
  })

  const resolved = computed<'light' | 'dark'>(() => choice.value)
  const isDark = computed(() => resolved.value === 'dark')

  function set(next: ThemeChoice) {
    choice.value = next
    if (typeof window === 'undefined') return
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    applyStoredTheme()
  }

  function toggle() {
    set(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return { choice, resolved, isDark, set, toggle }
}
