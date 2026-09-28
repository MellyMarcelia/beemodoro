<script setup lang="ts">
import type { SnackType } from '../../../shared/types'

defineProps<{ snack: SnackType }>()
</script>

<template>
  <!-- Simple pixel-style SVGs: flat shapes on a grid, no gradients/curves beyond squares. -->
  <svg
    v-if="snack === 'pollen'"
    viewBox="0 0 16 16"
    shape-rendering="crispEdges"
    class="snack-icon"
  >
    <rect x="6" y="2" width="4" height="2" fill="#e9a23b" />
    <rect x="4" y="4" width="8" height="2" fill="#f4d784" />
    <rect x="3" y="6" width="10" height="4" fill="#f4d784" />
    <rect x="4" y="10" width="8" height="2" fill="#e9a23b" />
    <rect x="6" y="12" width="4" height="2" fill="#1f1a1c" />
  </svg>

  <svg
    v-else-if="snack === 'honey-drop'"
    viewBox="0 0 16 16"
    shape-rendering="crispEdges"
    class="snack-icon"
  >
    <rect x="7" y="1" width="2" height="2" fill="#e9a23b" />
    <rect x="6" y="3" width="4" height="2" fill="#e9a23b" />
    <rect x="5" y="5" width="6" height="2" fill="#f4d784" />
    <rect x="4" y="7" width="8" height="4" fill="#f4d784" />
    <rect x="5" y="11" width="6" height="2" fill="#e9a23b" />
    <rect x="6" y="13" width="4" height="1" fill="#1f1a1c" />
  </svg>

  <svg
    v-else-if="snack === 'flower'"
    viewBox="0 0 16 16"
    shape-rendering="crispEdges"
    class="snack-icon"
  >
    <rect x="7" y="7" width="2" height="2" fill="#e9a23b" />
    <rect x="7" y="3" width="2" height="3" fill="#cc9594" />
    <rect x="7" y="10" width="2" height="3" fill="#cc9594" />
    <rect x="3" y="7" width="3" height="2" fill="#cc9594" />
    <rect x="10" y="7" width="3" height="2" fill="#cc9594" />
    <rect x="4" y="4" width="3" height="3" fill="#eba9a6" />
    <rect x="9" y="4" width="3" height="3" fill="#eba9a6" />
    <rect x="4" y="9" width="3" height="3" fill="#eba9a6" />
    <rect x="9" y="9" width="3" height="3" fill="#eba9a6" />
  </svg>

  <svg v-else viewBox="0 0 16 16" shape-rendering="crispEdges" class="snack-icon">
    <!-- honey-jar -->
    <rect x="5" y="1" width="6" height="2" fill="#1f1a1c" />
    <rect x="6" y="3" width="4" height="2" fill="#8dbf5a" />
    <rect x="4" y="5" width="8" height="8" fill="#e9a23b" />
    <rect x="4" y="5" width="8" height="2" fill="#f4d784" />
    <rect x="4" y="13" width="8" height="1" fill="#1f1a1c" />
  </svg>
</template>

<style scoped>
.snack-icon {
  width: 56px;
  height: 56px;
  image-rendering: pixelated;
}
</style>
