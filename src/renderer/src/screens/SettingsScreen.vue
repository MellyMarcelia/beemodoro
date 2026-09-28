<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings, SnackType, VaultStatus } from '../../../shared/types'
import { SNACK_LABELS, SNACK_ORDER } from '../../../shared/types'

// The Settings popup: pick your Obsidian vault folder and tweak how long
// each snack and the break last. Tells App.vue "close" when you hit the X.
defineEmits<{ close: [] }>()

const vaultStatus = ref<VaultStatus | null>(null)
const settings = ref<Settings | null>(null)
const loadError = ref<string | null>(null)

// Grabs the current vault + durations when the popup opens. If something
// breaks, show the error instead of a blank screen.
async function loadAll(): Promise<void> {
  loadError.value = null
  try {
    vaultStatus.value = await window.api.getVaultStatus()
    settings.value = await window.api.getSettings()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load settings:', error)
  }
}

onMounted(loadAll)

// Opens the folder picker. If you cancel, nothing changes.
async function chooseFolder(): Promise<void> {
  loadError.value = null
  try {
    const result = await window.api.chooseVaultFolder()
    if (result) vaultStatus.value = result
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to choose vault folder:', error)
  }
}

// These two save a new number right away, but ignore junk like 0, negatives or empty boxes.
async function updateSnackDuration(snack: SnackType, minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  settings.value = await window.api.setSnackDuration(snack, minutes)
}

async function updateBreakMinutes(minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  settings.value = await window.api.setBreakMinutes(minutes)
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="title">Settings</span>
      <button class="close-button" aria-label="Close settings" @click="$emit('close')">
        &times;
      </button>
    </div>

    <p v-if="loadError" class="warning-banner">Something went wrong: {{ loadError }}</p>
    <template v-else-if="vaultStatus">
      <p v-if="!vaultStatus.path" class="warning-banner">
        Choose your Obsidian vault so focus sessions get logged
      </p>
      <p v-else-if="!vaultStatus.exists" class="warning-banner">
        Your vault folder can't be found, choose it again
      </p>
    </template>

    <div class="section">
      <p class="section-label">Obsidian vault folder</p>
      <p class="vault-path">{{ vaultStatus?.path ?? 'not chosen yet' }}</p>
      <button class="choose-button" @click="chooseFolder">Choose vault folder</button>
    </div>

    <div v-if="settings" class="section">
      <p class="section-label">Snack durations (minutes)</p>
      <div v-for="snack in SNACK_ORDER" :key="snack" class="duration-row">
        <span>{{ SNACK_LABELS[snack] }}</span>
        <input
          type="number"
          min="1"
          :value="settings.snackDurations[snack]"
          @change="updateSnackDuration(snack, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div v-if="settings" class="section">
      <p class="section-label">Break length (minutes)</p>
      <input
        type="number"
        min="1"
        :value="settings.breakMinutes"
        @change="updateBreakMinutes(Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  background: var(--color-panel);
  border: var(--outline-width-thick) solid var(--color-ink);
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  text-transform: uppercase;
  font-size: 18px;
  letter-spacing: 0.02em;
}

.close-button {
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: var(--color-ink);
}

.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-ink);
  padding: 8px 12px;
  font-size: 12px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: var(--outline-width) solid var(--color-ink);
  padding-top: 12px;
}

.section-label {
  text-transform: uppercase;
  font-size: 13px;
  color: var(--color-text-muted);
}

.vault-path {
  font-size: 12px;
  word-break: break-word;
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  padding: 6px 8px;
}

.choose-button {
  align-self: flex-start;
  padding: 8px 16px;
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-honey);
  cursor: pointer;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
}

.duration-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.duration-row input,
.section > input {
  width: 70px;
  border: var(--outline-width) solid var(--color-ink);
  padding: 4px 8px;
  font-family: var(--font-display);
  font-size: 13px;
  background: #fff8ea;
}
</style>
