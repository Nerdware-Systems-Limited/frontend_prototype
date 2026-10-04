<template>
  <!-- Key for AccessScopeToggle's two fills, shown in the card header of each scope table. -->
  <div class="scope-legend" aria-hidden="true">
    <span class="scope-legend-item"><span class="swatch swatch-inherited" />Inherited</span>
    <span class="scope-legend-item"><span class="swatch swatch-set" />Set here</span>
  </div>
</template>

<style scoped>
.scope-legend { display: flex; gap: 12px; font-size: 11px; font-weight: 500; color: var(--fg-3); text-transform: none; letter-spacing: 0; }
.scope-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.swatch { width: 12px; height: 12px; border-radius: var(--r-xs); border: 1px solid var(--border-interactive); }
.swatch-inherited { background: var(--primary-wash-strong); border-color: color-mix(in srgb, var(--primary) 30%, transparent); }
.swatch-set { background: var(--primary-fill); border-color: var(--primary-fill); }
</style>
