/**
 * accessPolicy - Module Access override layers (ceiling / agency enabled /
 * role) on top of app/config/access-control.json. See
 * docs/superpowers/specs/2026-09-28-module-access-control-design.md.
 *
 * `overrides` is what the resolver reads (useAccessControl); `draft` is what
 * /access-policies edits until Save. Every change goes through edit(), which
 * checks the viewer's rights first - the page's disabled controls are a
 * convenience, not the gate (and once the accounts API replaces the storage
 * adapter, the server is the real gate, spec section 2.1).
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { AccessPolicyStorageError, localAccessPolicyStorage, type AccessPolicyStorage } from '~/utils/accessPolicyStorage'
import {
  BASE_SETTINGS, EMPTY_OVERRIDES, adminCanManagePolicy, isCategoryLocked, partitionStale, resolveFor, type PolicyOverrides,
} from '~/utils/resolveAccess'
import { applyEdit, cloneOverrides, editLayer, pruneOverrides, stableStringify, type AccessEdit } from '~/utils/accessEdits'
import { HISTORY_LIMIT, describeChanges, type HistoryEntry } from '~/utils/accessHistory'

export class AccessPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccessPolicyError'
  }
}

let storage: AccessPolicyStorage = localAccessPolicyStorage

/** Swap point for tests now and the accounts API adapter later. */
export function setAccessPolicyStorage(next: AccessPolicyStorage) {
  storage = next
}

interface PolicyViewer { id?: string; email?: string; role_type?: string; agency_code?: string | null }

export const useAccessPolicyStore = defineStore('accessPolicy', () => {
  const auth = useAuthStore()

  const overrides = ref<PolicyOverrides>(cloneOverrides(EMPTY_OVERRIDES))
  const draft = ref<PolicyOverrides>(cloneOverrides(EMPTY_OVERRIDES))
  const loaded = ref(false)
  /** The account the current overrides were loaded for - a different one must not inherit them (see ensureLoaded). */
  const loadedFor = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  /** Change log across all agencies, newest first (see historyFor). */
  const history = ref<HistoryEntry[]>([])

  const viewer = computed(() => auth.user as unknown as PolicyViewer | null)
  const isSuperAdmin = computed(() => viewer.value?.role_type === 'super_admin')

  const dirtyAgencies = computed(() => {
    const codes = new Set([...Object.keys(draft.value.agencies), ...Object.keys(overrides.value.agencies)])
    return [...codes].filter(c => stableStringify(draft.value.agencies[c]) !== stableStringify(overrides.value.agencies[c]))
  })
  const isDirty = computed(() => dirtyAgencies.value.length > 0)
  // Based on the draft, not saved overrides, so clearing stale keys (which
  // edits the draft) makes the note disappear right away rather than only
  // after Save.
  const staleKeys = computed(() => partitionStale(draft.value).stale)

  /**
   * super_admin: any agency. Agency admin: only their own, and only when
   * their own SAVED (not draft) /access-policies scope still resolves to
   * 'full' - otherwise the UI's disabled controls would be the only gate,
   * and a viewer could still call edit()/store actions directly.
   */
  function canEditAgency(code: string): boolean {
    if (!BASE_SETTINGS.agencies[code]) return false
    if (isSuperAdmin.value) return true
    if (viewer.value?.role_type !== 'admin' || viewer.value.agency_code?.toUpperCase() !== code) return false
    return resolveFor(overrides.value, viewer.value, '/access-policies').scopeLevel === 'full'
  }

  function edit(code: string, e: AccessEdit) {
    if (!canEditAgency(code)) throw new AccessPolicyError(`You can't change access for ${code}.`)
    if (editLayer(e) === 'ceiling' && !isSuperAdmin.value) {
      throw new AccessPolicyError('Only super admin can change what an agency is allowed.')
    }
    if (e.kind === 'category' && isCategoryLocked(e.category)) {
      throw new AccessPolicyError(`${e.category} is blocked platform-wide and can't be changed here.`)
    }
    const next = applyEdit(draft.value, code, e)
    if (!isSuperAdmin.value && adminCanManagePolicy(draft.value, code) && !adminCanManagePolicy(next, code)) {
      throw new AccessPolicyError("That change would remove your own ability to manage your agency's access.")
    }
    draft.value = next
  }

  /** super_admin clears every layer; an agency admin clears enabled + roles and keeps the ceiling. */
  function resetAgency(code: string) {
    edit(code, { kind: 'reset', keepCeiling: !isSuperAdmin.value })
  }

  function historyFor(code: string): HistoryEntry[] {
    return history.value.filter(e => e.agency === code)
  }

  function discard() {
    draft.value = cloneOverrides(overrides.value)
    saveError.value = null
  }

  function clearStale() {
    if (!isSuperAdmin.value) throw new AccessPolicyError('Only super admin can clear stale settings.')
    draft.value = pruneOverrides(partitionStale(draft.value).cleaned)
  }

  async function load() {
    try {
      const stored = await storage.load()
      if (stored) overrides.value = cloneOverrides(stored)
    } catch (err) {
      console.warn('[access-policy] could not load saved access settings - using defaults', err)
    }
    try {
      history.value = (await storage.loadHistory?.()) ?? []
    } catch (err) {
      console.warn('[access-policy] could not load change history', err)
    }
    draft.value = cloneOverrides(overrides.value)
    loadedFor.value = viewer.value?.id ?? null
    loaded.value = true
  }

  /** Forget everything held for the previous account (sign-out, or a different account signing in). */
  function reset() {
    overrides.value = cloneOverrides(EMPTY_OVERRIDES)
    draft.value = cloneOverrides(EMPTY_OVERRIDES)
    history.value = []
    saveError.value = null
    loaded.value = false
    loadedFor.value = null
  }

  /**
   * Load once per signed-in account. The route middleware calls this after
   * authentication (the access token is memory-only and is only refreshed
   * there, so nothing can be fetched before it), and it never lets one
   * account's policy linger for the next.
   */
  async function ensureLoaded() {
    const id = viewer.value?.id ?? null
    if (loaded.value && loadedFor.value === id) return
    if (loadedFor.value !== id) reset()
    await load()
  }

  async function save() {
    if (!isDirty.value) return
    saving.value = true
    saveError.value = null
    const next = cloneOverrides(draft.value)
    const stamp = new Date().toISOString()
    const by = viewer.value?.email ?? 'unknown'
    for (const code of dirtyAgencies.value) {
      const agency = next.agencies[code]
      if (agency) {
        agency.updatedAt = stamp
        agency.updatedBy = by
      }
    }
    // One log entry per agency whose effective settings actually changed.
    const entries: HistoryEntry[] = dirtyAgencies.value
      .map(code => ({ code, changes: describeChanges(overrides.value, next, code) }))
      .filter(x => x.changes.length)
      .map(x => ({ id: `${stamp}-${x.code}`, at: stamp, by, agency: x.code, changes: x.changes }))
    try {
      // A backend that normalises and stamps what it stores hands the result back: adopt that, not our draft.
      const stored = (await storage.save(next)) as PolicyOverrides | undefined
      const adopted = stored ? cloneOverrides(stored) : next
      overrides.value = adopted
      draft.value = cloneOverrides(adopted)
    } catch (err) {
      console.warn('[access-policy] save failed', err)
      saveError.value = err instanceof AccessPolicyStorageError
        ? err.message
        : "Couldn't save in this browser (storage may be full or blocked). Your changes are still here - try again."
      saving.value = false
      return
    }
    if (storage.recordsHistory) {
      // The server wrote the log itself (and would refuse ours); read it back.
      try {
        history.value = (await storage.loadHistory?.()) ?? history.value
      } catch (err) {
        console.warn('[access-policy] could not reload change history', err)
      }
    } else if (entries.length) {
      history.value = [...entries, ...history.value].slice(0, HISTORY_LIMIT)
      try {
        await storage.saveHistory?.(history.value)
      } catch (err) {
        // The settings themselves are saved; only the log entry failed to persist.
        console.warn('[access-policy] could not save change history', err)
      }
    }
    saving.value = false
  }

  return {
    overrides, draft, loaded, saving, saveError, history,
    isSuperAdmin, dirtyAgencies, isDirty, staleKeys,
    canEditAgency, edit, resetAgency, discard, clearStale, load, ensureLoaded, reset, save, historyFor,
  }
})
