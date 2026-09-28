<script setup lang="ts">
import type { SnackType } from '../../../shared/types'
import pollenImg from '../assets/snacks/snack-pollen.webp'
import honeyDropImg from '../assets/snacks/snack-honey-drop.webp'
import honeyJarImg from '../assets/snacks/snack-honey-jar.webp'

defineProps<{ snack: SnackType }>()

// Real illustrated assets for pollen/honey-drop/honey-jar; flower still uses
// the pixel-style SVG fallback until its matching asset is provided.
const imageForSnack: Partial<Record<SnackType, string>> = {
  pollen: pollenImg,
  'honey-drop': honeyDropImg,
  'honey-jar': honeyJarImg
}
</script>

<template>
  <img
    v-if="imageForSnack[snack]"
    :src="imageForSnack[snack]"
    :alt="snack"
    class="snack-icon snack-icon-image"
  />

  <!-- Simple pixel-style SVG fallback for snacks without a real asset yet (flower). -->
  <svg v-else viewBox="0 0 16 16" shape-rendering="crispEdges" class="snack-icon">
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
</template>

<style scoped>
.snack-icon {
  width: 56px;
  height: 56px;
}

.snack-icon-image {
  object-fit: contain;
}

svg.snack-icon {
  image-rendering: pixelated;
}
</style>
