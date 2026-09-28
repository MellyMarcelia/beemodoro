<script setup lang="ts">
import { computed } from 'vue'
import type { BeeMood } from '../../../shared/types'
import beeFocus from '../assets/bee/bee-focus.webp'
import beeHappy from '../assets/bee/bee-happy.webp'
import beeHappy2 from '../assets/bee/bee-happy-2.webp'
import beeSad from '../assets/bee/bee-sad.webp'
import beeScared from '../assets/bee/bee-scared.webp'

// The bee mascot: shows a different animation + speech bubble depending on its mood.
const props = defineProps<{ mood: BeeMood }>()

// Every mood that can actually render the Bee component has a matching GIF.
// ('idle' has no asset because the idle state shows the "what will you focus
// on?" prompt instead of the bee; this mapping never gets used for it.)
const assetForMood: Partial<Record<BeeMood, string>> = {
  focus: beeFocus,
  paused: beeScared,
  break: beeHappy2,
  completed: beeHappy,
  cancelled: beeSad
}

const asset = computed(() => assetForMood[props.mood] ?? null)

// What the bee says in its speech bubble for each mood.
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
    <!-- :key makes the GIF restart from the beginning whenever the mood changes -->
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
  justify-content: center;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

/* Up to 260px, but shrinks with the panel so it never spills past its borders. */
.bee-gif {
  flex: 0 1 260px;
  min-height: 0;
  width: 260px;
  max-width: 100%;
  object-fit: contain;
}

.speech-bubble {
  position: relative;
  flex-shrink: 0;
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
