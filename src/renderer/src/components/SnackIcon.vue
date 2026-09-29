<script setup lang="ts">
import type { SnackType } from '../../../shared/types'
// The four snack pictures.
import pollenImg from '../assets/snacks/snack-pollen.webp'
import honeyDropImg from '../assets/snacks/snack-honey-drop.webp'
import flowerImg from '../assets/snacks/snack-flower.webp'
import honeyJarImg from '../assets/snacks/snack-honey-jar.webp'
import { prepareSnackDragImage } from '../snackDragImage'

// The picture for one snack. Once it loads, we also get its drag copy ready
// (see snackDragImage.ts).
defineProps<{ snack: SnackType }>()

// Which picture goes with which snack.
const imageForSnack: Record<SnackType, string> = {
  pollen: pollenImg,
  'honey-drop': honeyDropImg,
  flower: flowerImg,
  'honey-jar': honeyJarImg
}
</script>

<template>
  <!-- The picture. As soon as it has loaded, make its drag copy -->
  <img
    :src="imageForSnack[snack]"
    :alt="snack"
    class="snack-icon"
    draggable="false"
    @load="prepareSnackDragImage($event.target as HTMLImageElement)"
  />
</template>

<style scoped>
/* Every snack picture is the same size. The last two lines stop the picture itself from being dragged or highlighted (the box around it gets dragged instead, see App.vue). */
.snack-icon {
  width: 76px;
  height: 76px;
  object-fit: contain;
  -webkit-user-drag: none;
  user-select: none;
}
</style>
