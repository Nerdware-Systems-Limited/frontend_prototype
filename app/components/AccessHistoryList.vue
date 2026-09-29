<template>
  <!-- Drawer content: saved Module Access changes for one agency, newest first. -->
  <p v-if="!entries.length" class="history-empty">
    No saved changes for this agency yet. Changes appear here after you press Save changes.
  </p>
  <ol v-else class="history-list">
    <li v-for="entry in entries" :key="entry.id" class="history-entry">
      <div class="history-meta">
        <time class="history-time" :datetime="entry.at">{{ formatWhen(entry.at) }}</time>
        <span class="history-by">{{ entry.by }}</span>
      </div>
      <div v-for="group in grouped(entry.changes)" :key="group.subject" class="history-group">
        <p class="history-subject">Changed <strong>{{ group.subject }}</strong></p>
        <ul class="history-lines">
          <li v-for="(line, i) in group.lines" :key="i">
            {{ line.field }}: <span class="history-value">{{ line.from }}</span>
            <ArrowRight :size="12" class="history-arrow" aria-label="to" />
            <span class="history-value">{{ line.to }}</span>
          </li>
        </ul>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import type { ChangeLine, HistoryEntry } from '~/utils/accessHistory'

defineProps<{ entries: HistoryEntry[] }>()

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}

function grouped(changes: ChangeLine[]) {
  const bySubject = new Map<string, ChangeLine[]>()
  for (const c of changes) bySubject.set(c.subject, [...(bySubject.get(c.subject) ?? []), c])
  return [...bySubject].map(([subject, lines]) => ({ subject, lines }))
}
</script>

<style scoped>
.history-empty { margin: 0; font-size: 12.5px; color: var(--fg-3); line-height: 1.5; }
.history-list { list-style: none; margin: 0; padding: 0; }
.history-entry { padding: 12px 0; border-top: 1px solid var(--border-subtle); }
.history-entry:first-child { border-top: 0; padding-top: 0; }
.history-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 6px; }
.history-time { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 11px; color: var(--fg-2); }
.history-by { font-size: 11.5px; color: var(--fg-3); overflow-wrap: anywhere; }
.history-group + .history-group { margin-top: 6px; }
.history-subject { margin: 0; font-size: 12.5px; color: var(--fg-2); }
.history-subject strong { color: var(--fg-1); font-weight: 600; }
.history-lines { list-style: none; margin: 2px 0 0; padding: 0; font-size: 12px; color: var(--fg-3); }
.history-lines li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.history-value { color: var(--fg-1); font-weight: 500; }
.history-arrow { color: var(--fg-3); }
</style>
