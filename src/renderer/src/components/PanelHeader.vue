<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  label: string
  dotColor: string
  // 0–1 fill of the header progress bar. Leave undefined for a plain
  // header with no bar.
  progress?: number
  progressColor?: string
}>()

const clamped = computed(() => Math.min(1, Math.max(0, props.progress ?? 0)))

// Animate forward progress smoothly, but jump straight back when the bar
// resets (session → break, break → idle) instead of sliding backwards.
const animate = ref(true)
watch(clamped, (next, prev) => {
  animate.value = next >= prev
})
</script>

<template>
  <div class="header-row">
    <span class="dot" :style="{ backgroundColor: dotColor }" />
    <span class="label">{{ label }}</span>
    <span
      v-if="progress !== undefined"
      class="progress-bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(clamped * 100)"
    >
      <span
        class="progress-fill"
        :class="{ animate }"
        :style="{
          width: `${clamped * 100}%`,
          backgroundColor: progressColor ?? 'var(--color-snack-honey-drop)'
        }"
      />
    </span>
    <span v-else class="spacer" />
    <slot name="action" />
  </div>
</template>

<style scoped>
.header-row {
  height: 64px;
  min-height: 64px;
  border-bottom: var(--outline-width-thick) solid var(--color-ink);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
}

.dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.label {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 15px;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.progress-bar {
  flex: 1;
  min-width: 24px;
  height: 16px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-icon-cell);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
}

.progress-fill.animate {
  transition: width 1s linear;
}
</style>
