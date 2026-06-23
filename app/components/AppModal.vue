<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @mousedown.self="closeOnBackdrop && close()"
      >
        <Transition name="modal-scale">
          <div
            v-if="modelValue"
            class="modal-panel"
            :style="{ maxWidth }"
          >
            <!-- Header -->
            <div class="modal-header">
              <div>
                <h2 class="modal-title">{{ title }}</h2>
                <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
              </div>
              <button
                class="icon-btn modal-close"
                aria-label="Close modal"
                @click="close"
              >
                <X :size="14" />
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <slot />
            </div>

            <!-- Footer (optional slot) -->
            <div v-if="$slots.footer" class="modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  maxWidth?: string
  closeOnBackdrop?: boolean
}>(), {
  maxWidth: '500px',
  closeOnBackdrop: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function close() {
  emit('update:modelValue', false)
}

// Close on Escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

// Prevent body scroll while modal is open
watch(() => props.modelValue, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.modal-panel {
  position: relative;
  width: 100%;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius, 12px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.modal-title {
  font-size: .9375rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
  margin: 0;
}

.modal-subtitle {
  font-size: .75rem;
  color: #6b7280;
  margin: 3px 0 0;
}

.modal-close {
  flex-shrink: 0;
  margin-top: 1px;
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

/* ── Icon btn (local copy so component is self-contained) ─────────────────── */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
  transition: background .1s, color .1s;
}
.icon-btn:hover { background: #f3f4f6; color: #111827; }

/* ── Transitions ──────────────────────────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity .2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to     { opacity: 0; }

.modal-scale-enter-active,
.modal-scale-leave-active { transition: opacity .2s ease, transform .2s ease; }
.modal-scale-enter-from,
.modal-scale-leave-to     { opacity: 0; transform: scale(.96) translateY(8px); }
</style>