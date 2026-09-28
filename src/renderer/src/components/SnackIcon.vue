<script setup lang="ts">
import type { SnackType } from '../../../shared/types'
import pollenImg from '../assets/snacks/snack-pollen.webp'
import honeyDropImg from '../assets/snacks/snack-honey-drop.webp'
import flowerImg from '../assets/snacks/snack-flower.webp'
import honeyJarImg from '../assets/snacks/snack-honey-jar.webp'

defineProps<{ snack: SnackType }>()

const imageForSnack: Record<SnackType, string> = {
  pollen: pollenImg,
  'honey-drop': honeyDropImg,
  flower: flowerImg,
  'honey-jar': honeyJarImg
}
</script>

<template>
  <img :src="imageForSnack[snack]" :alt="snack" class="snack-icon" />
</template>

<style scoped>
.snack-icon {
  width: 56px;
  height: 56px;
  object-fit: contain;
}
</style>
