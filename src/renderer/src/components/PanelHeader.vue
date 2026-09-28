<script setup lang="ts">
defineProps<{ label: string; dotColor: string }>()
</script>

<template>
  <div class="header-row">
    <span class="dot" :style="{ backgroundColor: dotColor }" />
    <span class="label">{{ label }}</span>
    <span class="double-line">
      <span class="line" />
      <span class="line" />
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

.line {
  height: 1.5px;
  background: var(--color-ink);
  width: 100%;
}
</style>
