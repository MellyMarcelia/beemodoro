<script setup lang="ts">
// One honeycomb cell in the Hive (one per past session). Filled with the
// snack's colour, or grey with a crack through it if the session was cancelled.
withDefaults(defineProps<{ fill: string; cracked?: boolean }>(), { cracked: false })
</script>

<template>
  <svg viewBox="0 0 100 115" class="hex" :class="{ cracked }">
    <!-- The six-sided shape itself, drawn by joining up its six corner points -->
    <polygon
      points="50,2 97,28 97,86 50,113 3,86 3,28"
      :fill="cracked ? 'var(--color-cell-cracked)' : fill"
      stroke="var(--color-ink)"
      stroke-width="4"
    />
    <!-- The zig-zag crack line, only drawn for cancelled sessions -->
    <path
      v-if="cracked"
      d="M 40 20 L 55 45 L 42 55 L 62 95"
      stroke="var(--color-ink)"
      stroke-width="3"
      fill="none"
    />
  </svg>
</template>

<style scoped>
/* The size of each hexagon in the Hive. */
.hex {
  width: 40px;
  height: 46px;
  display: block;
}
</style>
