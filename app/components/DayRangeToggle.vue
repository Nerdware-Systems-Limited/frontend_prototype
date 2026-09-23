<template>
  <!--
    DayRangeToggle - the "7d / 30d / 90d" quick-range button group used in
    page-header actions. Was hand-built with near-identical markup+CSS on
    9 separate pages; this is the one shared version.
  -->
  <div class="day-filter">
    <button
      v-for="opt in options" :key="opt" type="button"
      class="btn" :class="{ 'btn-active': modelValue === opt }"
      @click="select(opt)"
    >{{ opt }}{{ suffix }}</button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number | null
  options: number[]
  /** Appended after the number, e.g. "d" -> "30d", "d OTP" -> "30d OTP". */
  suffix?: string
  /** Clicking the already-active option clears the selection instead of re-selecting it. */
  deselectable?: boolean
}>(), {
  suffix: 'd',
  deselectable: false,
})

const emit = defineEmits<{
  'update:modelValue': [number | null]
}>()

function select(opt: number) {
  if (props.deselectable && props.modelValue === opt) {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', opt)
  }
}
</script>

<style scoped>
.day-filter { display: flex; gap: 4px; }
</style>
