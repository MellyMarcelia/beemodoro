<script setup lang="ts">
withDefaults(defineProps<{ fill: string; cracked?: boolean }>(), { cracked: false })
</script>

<template>
  <svg viewBox="0 0 100 115" class="hex" :class="{ cracked }">
    <polygon
      points="50,2 97,28 97,86 50,113 3,86 3,28"
      :fill="cracked ? 'var(--color-cell-cracked)' : fill"
      stroke="var(--color-ink)"
      stroke-width="4"
    />
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
.hex {
  width: 40px;
  height: 46px;
  display: block;
}
</style>
