<script setup lang="ts">
// The title strip at the top of each panel: coloured dot, label, an optional
// progress bar, and a slot on the right for a button (like "Hive").
import { computed, ref, watch } from 'vue'

// What each panel tells this strip when it uses it.
const props = defineProps<{
  label: string // the title text, like "Focus Time"
  dotColor: string // the colour of the little square at the start
  // How full the progress bar is, from 0 (empty) to 1 (full). Leave it out
  // for a header with no bar.
  progress?: number
  progressColor?: string // colour of the filled part (orange if left out)
}>()

// Keeps the progress between 0 and 1 so the bar never overflows.
const clamped = computed(() => Math.min(1, Math.max(0, props.progress ?? 0)))

// The bar slides smoothly as it fills up, but snaps straight back to empty
// when it restarts (e.g. when a break begins) instead of sliding backwards.
const animate = ref(true)
watch(clamped, (next, prev) => {
  animate.value = next >= prev
})
</script>

<template>
  <div class="header-row">
    <span class="dot" :style="{ backgroundColor: dotColor }" />
    <span class="label">{{ label }}</span>
    <!-- The progress bar (only if the panel asked for one). The "aria" bits let
         screen readers for blind users announce how full it is. -->
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
    <!-- No bar? An empty filler takes its place so the button still sits on the far right -->
    <span v-else class="spacer" />
    <!-- An empty spot where the panel can put its own button (like "Hive") -->
    <slot name="action" />
  </div>
</template>

<style scoped>
/* The strip itself: always the same height, a thick line underneath, everything in one row. */
.header-row {
  height: 64px;
  min-height: 64px;
  border-bottom: var(--outline-width-thick) solid var(--color-ink);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
}

/* The small coloured square at the start of the strip. */
.dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* The panel's title text, kept on one line. */
.label {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 15px;
  white-space: nowrap;
}

/* Empty filler that pushes the button all the way to the right. */
.spacer {
  flex: 1;
}

/* The empty track of the progress bar: a long rounded pill shape. */
.progress-bar {
  flex: 1;
  min-width: 24px;
  height: 16px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-icon-cell);
  overflow: hidden;
}

/* The coloured part inside the track that grows as time passes. */
.progress-fill {
  display: block;
  height: 100%;
}

/* Makes it glide smoothly instead of jumping forward once a second. */
.progress-fill.animate {
  transition: width 1s linear;
}
</style>
