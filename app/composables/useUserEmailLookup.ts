/**
 * Resolves a Dashboard Manager 'user' assignment's scopeValue (a raw user
 * UUID - all the backend stores) to that user's email, for display. A
 * module-level cache shared by every caller in the session, so the list
 * page, the editor's audience panel and its publish drawer don't each
 * re-fetch the same id.
 *
 * A user an agency admin can't see (different agency - see
 * AgencyAdminScopingTests on the backend) or one that's since been deleted
 * both just stay unresolved - callers fall back to describeScope()'s own
 * `User <id>` text, which is the correct degrade for either case.
 */
import { useUsers } from '~/composables/api'

const cache = ref<Record<string, string>>({})
const pending = new Set<string>()

export function useUserEmailLookup() {
  const users = useUsers()

  function emailFor(userId: string): string | undefined {
    return cache.value[userId]
  }

  async function ensure(userIds: Iterable<string>): Promise<void> {
    const toFetch = [...new Set(userIds)].filter(id => id && !(id in cache.value) && !pending.has(id))
    if (!toFetch.length) return
    toFetch.forEach(id => pending.add(id))
    await Promise.all(toFetch.map(async (id) => {
      try {
        const u = await users.get(id)
        cache.value = { ...cache.value, [id]: u.email }
      } catch {
        // Not visible to this viewer, or no longer exists - leave uncached.
      } finally {
        pending.delete(id)
      }
    }))
  }

  return { emailFor, ensure }
}
