/** Pages reachable without signing in. Mirrored by PUBLIC_PAGES in tests/unit/page-access-coverage.test.ts. */
const PUBLIC_ROUTES = ['/login', '/forgot-password']

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.includes(path) || path.startsWith('/reset-password/')
}
