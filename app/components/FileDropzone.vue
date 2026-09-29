<template>
  <!--
    Drag/drop + click-to-browse file picker with client-side validation and
    an upload-progress state, extracted from the old upload.vue/UploadModal.vue
    (both hand-rolled the same thing). Keyboard-reachable and announced as a
    button - the previous versions were a bare <div> with a click handler and
    no tabindex/role, invisible to keyboard/screen-reader use entirely.
  -->
  <div
    v-if="!uploading"
    class="file-dropzone"
    :class="{ dragging: isDragging, disabled }"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled"
    :aria-label="disabled ? disabledReason || 'File upload disabled' : 'Drop a file here or press Enter to browse'"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <input ref="fileInput" type="file" :accept="accept" hidden :disabled="disabled" @change="onFileInput" />
    <template v-if="disabled">
      <p class="file-dropzone-main">{{ disabledReason || 'Upload disabled' }}</p>
    </template>
    <template v-else>
      <p class="file-dropzone-main">Drag your file here, or click to browse</p>
      <p class="hint">{{ acceptLabel }}, up to {{ (maxSizeMb / 1024).toFixed(1) }}GB</p>
    </template>
  </div>

  <div v-else class="file-dropzone-progress">
    <IngestProgress :pct="progress" variant="success" />
    <span class="hint">Uploading {{ fileName }}… {{ progress }}%</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  accept?: string
  maxSizeMb?: number
  disabled?: boolean
  disabledReason?: string
  uploading?: boolean
  progress?: number
  fileName?: string
}>(), {
  accept: '.xlsx,.csv',
  maxSizeMb: 5120,
  disabled: false,
  disabledReason: '',
  uploading: false,
  progress: 0,
  fileName: '',
})

const emit = defineEmits<{
  /** A file passed client-side validation and is ready to upload. */
  file: [File]
  /** Client-side validation failed - extension or size. */
  error: [string]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const acceptLabel = computed(() => props.accept.split(',').map(s => s.trim()).join(' or '))

function open() {
  if (props.disabled) return
  fileInput.value?.click()
}

function onDragOver() {
  if (!props.disabled) isDragging.value = true
}

function validate(file: File): string | null {
  const lower = file.name.toLowerCase()
  const exts = props.accept.split(',').map(s => s.trim().toLowerCase())
  if (!exts.some(ext => lower.endsWith(ext))) {
    return `Please choose a file of type: ${acceptLabel.value}.`
  }
  const maxBytes = props.maxSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    return `That file is larger than the ${(props.maxSizeMb / 1024).toFixed(1)}GB limit.`
  }
  return null
}

function handleFile(file: File) {
  const err = validate(file)
  if (err) emit('error', err)
  else emit('file', file)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (props.disabled) return
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFileInput(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) handleFile(file)
  target.value = '' // allow re-selecting the same filename after a failed attempt
}
</script>

<style scoped>
.file-dropzone {
  border: 1px dashed var(--border-interactive); border-radius: var(--r-md); padding: 40px 24px;
  text-align: center; cursor: pointer; transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard);
}
.file-dropzone:hover, .file-dropzone:focus-visible { border-color: var(--primary); background: var(--info-bg); }
.file-dropzone:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.file-dropzone.dragging { border-color: var(--success-fg); background: var(--success-bg); }
.file-dropzone.disabled { cursor: not-allowed; opacity: 0.6; }
.file-dropzone.disabled:hover { border-color: var(--border-interactive); background: none; }
.file-dropzone-main { font-size: 14px; color: var(--fg-2); margin: 0 0 6px; }
.hint { font-size: 11px; color: var(--fg-3); }

.file-dropzone-progress { padding: 24px 0; display: flex; flex-direction: column; gap: 8px; }
</style>
