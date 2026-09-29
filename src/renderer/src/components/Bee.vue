<script setup lang="ts">
import { computed } from 'vue'
import type { BeeMood } from '../../../shared/types'
// The bee's little animations, one per mood.
import beeFocus from '../assets/bee/bee-focus.webp'
import beeHappy from '../assets/bee/bee-happy.webp'
import beeHappy2 from '../assets/bee/bee-happy-2.webp'
import beeSad from '../assets/bee/bee-sad.webp'
import beeScared from '../assets/bee/bee-scared.webp'

// The bee mascot: shows a different animation + speech bubble depending on its mood.
const props = defineProps<{ mood: BeeMood }>()

// Which animation goes with which mood. "idle" has none because the bee
// isn't shown then (the "what will you focus on?" box is shown instead).
const assetForMood: Partial<Record<BeeMood, string>> = {
  focus: beeFocus,
  paused: beeScared,
  break: beeHappy2,
  completed: beeHappy,
  cancelled: beeSad
}

// The animation for the mood right now (nothing if there isn't one).
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
    <!-- Restart the animation from the beginning whenever the mood changes -->
    <img v-if="asset" :key="asset" :src="asset" class="bee-gif" :class="mood" alt="" />

    <!-- The speech bubble with the bee's words -->
    <div class="speech-bubble">
      <span>{{ moodText[mood] }}</span>
    </div>
  </div>
</template>

<style scoped>
/* The bee with its speech bubble underneath, both centred. */
.bee-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

/* Up to 260px wide, but shrinks with the window so it never spills out of the panel. */
.bee-gif {
  flex: 0 1 260px;
  min-height: 0;
  width: 260px;
  max-width: 100%;
  object-fit: contain;
}

/* The white speech bubble under the bee, with a thick dark outline. */
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
  /* Snips the corners off so the bubble looks pixelated instead of rounded. */
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
