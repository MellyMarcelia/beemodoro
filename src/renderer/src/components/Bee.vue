<script setup lang="ts">
import { computed } from 'vue'
import type { BeeMood } from '../../../shared/types'
import beeFocus from '../assets/bee/bee-focus.gif'
import beeHappy from '../assets/bee/bee-happy.gif'
import beeSad from '../assets/bee/bee-sad.gif'

const props = defineProps<{ mood: BeeMood }>()

// Only moods with a real GIF asset get one; idle/paused/break use a plain
// CSS animation on a simple pixel-style bee shape instead (see <style>).
const assetForMood: Partial<Record<BeeMood, string>> = {
  focus: beeFocus,
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
    <div v-else class="bee-css" :class="mood" aria-hidden="true">
      <div class="bee-body">
        <div class="bee-stripe" />
        <div class="bee-stripe" />
        <div class="bee-wing bee-wing-left" />
        <div class="bee-wing bee-wing-right" />
      </div>
    </div>

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
  image-rendering: pixelated;
}

.bee-css {
  width: 260px;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bee-body {
  position: relative;
  width: 140px;
  height: 96px;
  background: #f4d784;
  border: 4px solid var(--color-ink);
}

.bee-stripe {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 24px;
  background: var(--color-ink);
}

.bee-stripe:nth-child(1) {
  left: 40px;
}

.bee-stripe:nth-child(2) {
  left: 84px;
}

.bee-wing {
  position: absolute;
  top: -30px;
  width: 44px;
  height: 30px;
  background: #fceeea;
  border: 3px solid var(--color-ink);
}

.bee-wing-left {
  left: 10px;
}

.bee-wing-right {
  right: 10px;
}

.bee-css.idle .bee-body {
  animation: bob 1.6s ease-in-out infinite;
}

.bee-css.paused .bee-body {
  opacity: 0.7;
  animation: none;
}

.bee-css.paused .bee-wing {
  opacity: 0.4;
}

.bee-css.break .bee-body {
  animation: rest 2.4s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes rest {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(4px) scale(0.98);
  }
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
