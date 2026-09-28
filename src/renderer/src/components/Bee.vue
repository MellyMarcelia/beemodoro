<script setup lang="ts">
import { computed } from 'vue'
import type { BeeMood } from '../../../shared/types'
import beeFocus from '../assets/bee/bee-focus.webp'
import beeHappy from '../assets/bee/bee-happy.webp'
import beeHappy2 from '../assets/bee/bee-happy-2.webp'
import beeSad from '../assets/bee/bee-sad.webp'
import beeScared from '../assets/bee/bee-scared.webp'

const props = defineProps<{ mood: BeeMood }>()

// Every mood that can actually render the Bee component has a matching GIF.
// ('idle' has no asset because the idle state shows the "what will you focus
// on?" prompt instead of the bee — this mapping never gets used for it.)
const assetForMood: Partial<Record<BeeMood, string>> = {
  focus: beeFocus,
  paused: beeScared,
  break: beeHappy2,
  completed: beeHappy,
  cancelled: beeSad
}

const asset = computed(() => assetForMood[props.mood] ?? null)

const moodText: Record<BeeMood, string> = {
  idle: 'ready!',
  focus: 'buzz buzz...',
  paused: 'zzzz...',
  break: 'sip sip...',
  completed: 'yay!',
  cancelled: 'oh no...'
}
</script>

<template>
  <div class="bee-area">
    <img v-if="asset" :key="asset" :src="asset" class="bee-gif" :class="mood" alt="" />

    <div class="speech-bubble">
      <span>{{ moodText[mood] }}</span>
    </div>
  </div>
</template>

<style scoped>
.bee-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.bee-gif {
  width: 260px;
  height: 260px;
  object-fit: contain;
}

.speech-bubble {
  position: relative;
  background: #ffffff;
  border: 4px solid var(--color-ink);
  padding: 10px 20px;
  font-family: var(--font-display);
  text-transform: lowercase;
  font-size: 16px;
  letter-spacing: 0.02em;
  /* Pixel-notched corners via clip-path, no border-radius. */
  clip-path: polygon(
    8px 0,
    calc(100% - 8px) 0,
    100% 8px,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    8px 100%,
    0 calc(100% - 8px),
    0 8px
  );
}
</style>
