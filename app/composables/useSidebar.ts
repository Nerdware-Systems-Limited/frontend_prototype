/**
 * useSidebar - shared sidebar state for the default layout.
 *
 * Two independent states, one toggle:
 *  - `collapsed` (desktop, > 900px): sidebar slides out and main content
 *    takes the full width. Persisted to localStorage so it survives reloads.
 *  - `mobileOpen` (<= 900px): the off-canvas drawer. Never persisted - the
 *    drawer always starts closed.
 *
 * The layout mirrors `collapsed` onto `body.sidebar-collapsed`; theme.css
 * owns the actual slide/reflow rules.
 */

const STORAGE_KEY = 'uapts_sidebar_collapsed'
const MOBILE_MAX = 900

export function useSidebar() {
  const collapsed = useState<boolean>('uapts-sidebar-collapsed', () => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const mobileOpen = useState<boolean>('sidebarOpen', () => false)

  function isMobile() {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX
  }

  function setCollapsed(next: boolean) {
    collapsed.value = next
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* private mode */ }
    // Maps and size-aware widgets measure on window resize - nudge them once
    // the slide transition (theme.css, .2s) has finished.
    if (typeof window !== 'undefined')
      setTimeout(() => window.dispatchEvent(new Event('resize')), 220)
  }

  /** One button, viewport-aware: drawer on mobile, collapse on desktop. */
  function toggle() {
    if (isMobile()) mobileOpen.value = !mobileOpen.value
    else setCollapsed(!collapsed.value)
  }

  /** Whether the sidebar is currently visible at this viewport (for aria-expanded). */
  const expanded = computed(() => isMobile() ? mobileOpen.value : !collapsed.value)

  return { collapsed, mobileOpen, expanded, toggle, setCollapsed }
}
