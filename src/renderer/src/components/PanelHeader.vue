<script setup lang="ts">
withDefaults(defineProps<{ label: string; dotColor: string; progress?: number | null }>(), {
  progress: null
})
</script>

<template>
  <div class="header-row">
    <span class="dot" :style="{ backgroundColor: dotColor }" />
    <span class="label">{{ label }}</span>
    <span class="double-line">
      <span class="line-row">
        <span class="line-track" :class="{ dimmed: progress !== null }" />
        <span
          v-if="progress !== null"
          class="line-fill"
          :style="{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }"
        />
      </span>
      <span class="line-row">
        <span class="line-track" :class="{ dimmed: progress !== null }" />
        <span
          v-if="progress !== null"
          class="line-fill"
          :style="{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }"
        />
      </span>
    </span>
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

.double-line {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 12px;
}

.line-row {
  position: relative;
  height: 1.5px;
  width: 100%;
}

.line-track {
  position: absolute;
  inset: 0;
  background: var(--color-ink);
}

.line-track.dimmed {
  opacity: 0.25;
}

.line-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--color-ink);
  transition: width 0.3s linear;
}
</style>
