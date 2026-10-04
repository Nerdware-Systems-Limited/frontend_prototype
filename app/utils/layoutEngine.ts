/**
 * Grid layout engine (pure functions, no Vue).
 *
 * 12 columns, unbounded rows. Widgets never overlap: after any move/resize,
 * colliding widgets are pushed down, then everything floats up to fill gaps
 * ("vertical compaction") - the react-grid-layout model, in ~100 lines.
 */
import { GRID_COLUMNS, type WidgetInstance, type WidgetSize } from '~/types/dashboard'

type Box = Pick<WidgetInstance, 'id' | 'x' | 'y' | 'w' | 'h'>

export const overlaps = (a: Box, b: Box) =>
  a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function clampBox<T extends Box>(b: T, min: WidgetSize = { w: 1, h: 1 }): T {
  const w = Math.max(min.w, Math.min(GRID_COLUMNS, Math.round(b.w)))
  const h = Math.max(min.h, Math.round(b.h))
  const x = Math.max(0, Math.min(GRID_COLUMNS - w, Math.round(b.x)))
  const y = Math.max(0, Math.round(b.y))
  return { ...b, x, y, w, h }
}

/**
 * Resolve collisions, then float every widget up as far as it goes
 * (top-to-bottom). Safe on any input, including stored layouts that
 * overlap: an overlapping widget is first pushed down until it's clear.
 */
export function compact<T extends Box & { hidden?: boolean }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const placed: T[] = []
  const hits = (probe: Box) => placed.some(p => !p.hidden && overlaps(probe, p))
  for (const item of sorted) {
    if (item.hidden) { placed.push(item); continue }
    const next = { ...item }
    while (hits(next)) next.y++
    while (next.y > 0 && !hits({ ...next, y: next.y - 1 })) next.y--
    placed.push(next)
  }
  // keep original array order so v-for keys don't reshuffle
  const byId = new Map(placed.map(p => [p.id, p]))
  return items.map(i => byId.get(i.id)!)
}

/** Push anything overlapping `moved` downward, recursively, then compact. */
export function settle<T extends Box & { hidden?: boolean }>(items: T[], movedId: string): T[] {
  const list = items.map(i => ({ ...i }))
  const moved = list.find(i => i.id === movedId)
  if (!moved) return compact(list)
  const queue: T[] = [moved]
  while (queue.length) {
    const cur = queue.shift()!
    for (const other of list) {
      // the widget the user is holding never gets pushed - everything else yields to it
      if (other.hidden || other.id === cur.id || other.id === movedId) continue
      if (overlaps(cur, other)) {
        other.y = cur.y + cur.h
        queue.push(other)
      }
    }
  }
  return compact(list)
}

/** First free slot of the given size, scanning rows top-down. */
export function findSpot(items: Box[], size: WidgetSize): { x: number; y: number } {
  const w = Math.min(size.w, GRID_COLUMNS)
  for (let y = 0; y < 500; y++) {
    for (let x = 0; x <= GRID_COLUMNS - w; x++) {
      const probe = { id: '__probe__', x, y, w, h: size.h }
      if (!items.some(i => overlaps(probe, i))) return { x, y }
    }
  }
  return { x: 0, y: bottom(items) }
}

export const bottom = (items: Box[]) => items.reduce((m, i) => Math.max(m, i.y + i.h), 0)

export const newId = (prefix = 'w') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
