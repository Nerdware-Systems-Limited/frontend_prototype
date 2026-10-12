/** An image URL a widget may load: https, or a /path inside this app. Never data: or javascript:. */
export function safeImageUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 2048 || /\s/.test(s)) return null
  if (s.startsWith('/') && !s.startsWith('//')) return s
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}
